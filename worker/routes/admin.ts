// admin tools: tidy up people and games. admins are set by hand in the D1
// console (`UPDATE users SET is_admin = 1 WHERE username = '…'`), see DEPLOY.md.

import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { randomAvatar, type AdminGame, type AdminUser, type Game } from "../../shared/types";
import { me, parseAvatar, requireAdmin, requireUser, router, toPublic } from "../app";
import { games, interests, resetTokens, sessions, users } from "../db/schema";

const id = z.string().uuid();
const gameId = z.coerce.number().int().positive();

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
    await db.batch([db.delete(interests).where(eq(interests.gameId, gid.data)), db.delete(games).where(eq(games.igdbId, gid.data))]);
    return c.json({ ok: true });
  });
