// admin tools: tidy up people and games. admins are set by hand in the D1
// console (`UPDATE users SET is_admin = 1 WHERE username = '…'`), see DEPLOY.md.

import { count, desc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { randomAvatar, type AdminGame, type AdminSeason, type AdminUser, type Game } from "../../shared/types";
import { me, parseAvatar, requireAdmin, requireUser, router, toPublic } from "../app";
import { archivedInterests, games, interests, resetTokens, sessions, users } from "../db/schema";
import { setEventStart } from "./event";

const id = z.string().uuid();
const gameId = z.coerce.number().int().positive();
const season = z.string().trim().min(1).max(24);

async function dropUpload(env: Env, avatar: string) {
  const a = parseAvatar(avatar);
  if (a.kind === "upload") await env.AVATARS.delete(a.key).catch(() => {});
}

export const adminRoutes = router()
  .use(requireUser, requireAdmin)

  .get("/users", async (c) => {
    const db = c.get("db");
    const [rows, votes] = await Promise.all([
      db.select().from(users).all(),
      db.select({ userId: interests.userId, n: count() }).from(interests).groupBy(interests.userId).all(),
    ]);
    const byUser = new Map(votes.map((v) => [v.userId, v.n]));
    const out: AdminUser[] = rows
      .map((u) => ({ ...toPublic(u), email: u.email, isAdmin: !!u.isAdmin, createdAt: u.createdAt, votes: byUser.get(u.id) ?? 0 }))
      .sort((a, b) => b.createdAt - a.createdAt);
    return c.json(out);
  })

  // swap a dodgy uploaded picture (or icon) for a random icon
  .post("/users/:id/reset-avatar", async (c) => {
    const uid = id.safeParse(c.req.param("id"));
    if (!uid.success) return c.json({ error: "bad user id" }, 400);
    const db = c.get("db");
    const user = await db.select().from(users).where(eq(users.id, uid.data)).get();
    if (!user) return c.json({ error: "no such user" }, 404);
    await dropUpload(c.env, user.avatar);
    await db.update(users).set({ avatar: JSON.stringify(randomAvatar()) }).where(eq(users.id, user.id));
    return c.json({ ok: true });
  })

  // delete someone entirely: their votes, sessions, reset links and uploaded avatar go too
  .delete("/users/:id", async (c) => {
    const uid = id.safeParse(c.req.param("id"));
    if (!uid.success) return c.json({ error: "bad user id" }, 400);
    if (uid.data === me(c).id) return c.json({ error: "you can't delete yourself from here" }, 400);
    const db = c.get("db");
    const user = await db.select().from(users).where(eq(users.id, uid.data)).get();
    if (!user) return c.json({ error: "no such user" }, 404);
    await dropUpload(c.env, user.avatar);
    await db.batch([
      db.delete(interests).where(eq(interests.userId, user.id)),
      db.delete(archivedInterests).where(eq(archivedInterests.userId, user.id)),
      db.delete(sessions).where(eq(sessions.userId, user.id)),
      db.delete(resetTokens).where(eq(resetTokens.userId, user.id)),
      db.delete(users).where(eq(users.id, user.id)),
    ]);
    return c.json({ ok: true });
  })

  .get("/games", async (c) => {
    const db = c.get("db");
    const [rows, votes] = await Promise.all([
      db.select().from(games).all(),
      db.select({ gameId: interests.gameId, n: count() }).from(interests).groupBy(interests.gameId).all(),
    ]);
    const byGame = new Map(votes.map((v) => [v.gameId, v.n]));
    const out: AdminGame[] = rows
      .map((g) => {
        const data = JSON.parse(g.data) as Game;
        return { igdbId: g.igdbId, name: data.name, coverImageId: data.coverImageId, addedAt: g.addedAt, votes: byGame.get(g.igdbId) ?? 0 };
      })
      .sort((a, b) => b.addedAt - a.addedAt);
    return c.json(out);
  })

  // remove a game and every vote on it
  .delete("/games/:id", async (c) => {
    const gid = gameId.safeParse(c.req.param("id"));
    if (!gid.success) return c.json({ error: "bad game id" }, 400);
    const db = c.get("db");
    await db.batch([
      db.delete(interests).where(eq(interests.gameId, gid.data)),
      db.delete(archivedInterests).where(eq(archivedInterests.gameId, gid.data)),
      db.delete(games).where(eq(games.igdbId, gid.data)),
    ]);
    return c.json({ ok: true });
  })

  // ---- the event date (header countdown) ----

  .put("/event", async (c) => {
    const parsed = z
      .object({ startsAt: z.number().int().min(Date.UTC(2020, 0, 1)).max(Date.UTC(2100, 0, 1)).nullable() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "pick a date and time" }, 400);
    await setEventStart(c.get("db"), parsed.data.startsAt);
    return c.json({ startsAt: parsed.data.startsAt });
  })

  // ---- seasons (archiving the arcade after an event) ----

  .get("/seasons", async (c) => {
    const rows = await c
      .get("db")
      .select({
        season: archivedInterests.season,
        archivedAt: max(archivedInterests.archivedAt),
        games: sql<number>`count(distinct ${archivedInterests.gameId})`,
        votes: count(),
      })
      .from(archivedInterests)
      .groupBy(archivedInterests.season)
      .orderBy(desc(max(archivedInterests.archivedAt)))
      .all();
    const out: AdminSeason[] = rows.map((r) => ({ season: r.season, archivedAt: r.archivedAt ?? 0, games: r.games, votes: r.votes }));
    return c.json(out);
  })

  // move every current vote into a season — the arcade starts fresh
  .post("/archive", async (c) => {
    const parsed = season.safeParse((await c.req.json().catch(() => null))?.season);
    if (!parsed.success) return c.json({ error: "give the season a short name, like 2026" }, 400);
    const db = c.get("db");
    const current = await db.select({ n: count() }).from(interests).get();
    if (!current?.n) return c.json({ error: "there are no votes to archive" }, 400);
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO archived_interests (season, user_id, game_id, level, duration_min, duration_max, archived_at)
         SELECT ?1, user_id, game_id, level, duration_min, duration_max, ?2 FROM interests WHERE true
         ON CONFLICT (season, user_id, game_id) DO UPDATE SET
           level = excluded.level, duration_min = excluded.duration_min,
           duration_max = excluded.duration_max, archived_at = excluded.archived_at`,
      ).bind(parsed.data, now),
      c.env.DB.prepare(`DELETE FROM interests`),
    ]);
    return c.json({ ok: true, archived: current.n });
  })

  // undo an archive: put a season's votes back (current votes win if both exist)
  .post("/seasons/:season/restore", async (c) => {
    const parsed = season.safeParse(c.req.param("season"));
    if (!parsed.success) return c.json({ error: "bad season" }, 400);
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO interests (user_id, game_id, level, duration_min, duration_max, updated_at)
         SELECT user_id, game_id, level, duration_min, duration_max, archived_at FROM archived_interests WHERE season = ?1
         ON CONFLICT (user_id, game_id) DO NOTHING`,
      ).bind(parsed.data),
      c.env.DB.prepare(`DELETE FROM archived_interests WHERE season = ?1`).bind(parsed.data),
    ]);
    return c.json({ ok: true });
  });
