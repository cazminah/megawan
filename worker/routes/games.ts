import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { DURATIONS, type ArcadeGame, type ArcadeResponse, type ArchivedSeason, type Game, type InterestLevel, type PublicUser } from "../../shared/types";
import { limited, me, requireUser, router, toPublic } from "../app";
import { archivedInterests, games, interests, users } from "../db/schema";
import { fetchGame, IgdbNotConfigured, SEARCH_VERSION, searchGames } from "../igdb/client";
import type { Db } from "../db/client";

/**
 * past seasons for the arcade: each game appears once, under the latest season
 * it was voted on in, and only while it has no votes this time round.
 */
export function buildArchive(byGame: Map<number, ArcadeGame>, rows: (typeof archivedInterests.$inferSelect)[]): ArchivedSeason[] {
  const seasonAt = new Map<string, number>();
  const latest = new Map<number, string>(); // game → its most recent season
  for (const r of rows) {
    seasonAt.set(r.season, Math.max(seasonAt.get(r.season) ?? 0, r.archivedAt));
  }
  for (const r of rows) {
    const cur = latest.get(r.gameId);
    if (!cur || seasonAt.get(r.season)! > seasonAt.get(cur)!) latest.set(r.gameId, r.season);
  }
  const seasons = new Map<string, Map<number, ArcadeGame>>();
  for (const r of rows) {
    const game = byGame.get(r.gameId);
    if (!game || game.interests.length || latest.get(r.gameId) !== r.season) continue;
    if (!seasons.has(r.season)) seasons.set(r.season, new Map());
    const gs = seasons.get(r.season)!;
    if (!gs.has(r.gameId)) gs.set(r.gameId, { ...game, interests: [] });
    const duration = r.durationMin !== null && r.durationMax !== null ? { min: r.durationMin, max: r.durationMax } : null;
    gs.get(r.gameId)!.interests.push({ userId: r.userId, level: r.level as InterestLevel, duration, updatedAt: r.archivedAt });
  }
  return [...seasons.entries()]
    .map(([season, gs]) => ({ season, archivedAt: seasonAt.get(season)!, games: [...gs.values()] }))
    .sort((a, b) => b.archivedAt - a.archivedAt);
}

const durationIndex = z.number().int().min(0).max(DURATIONS.length - 1);
export const interestBody = z.object({
  level: z.number().int().min(1, "pick a level from 1 to 5").max(5, "pick a level from 1 to 5"),
  duration: z
    .object({ min: durationIndex, max: durationIndex })
    .refine((d) => d.min <= d.max, "duration's shortest can't be longer than its longest")
    .nullable()
    .optional(),
});

const STALE_AFTER = 30 * 24 * 60 * 60 * 1000; // re-pull IGDB data a month after we cached it
// bump when the shape of a cached Game changes; older rows get re-fetched quietly
const GAME_DATA_VERSION = 3; // 2: heroImageId, no store links / time-to-beat · 3: themes, trailer, free-to-play
const REFRESH_PER_LOAD = 4; // IGDB allows 4 req/s — keep the background top-up gentle

type StoredGame = Game & { _v?: number };
// fields added after v1 — filled in for rows that haven't been refreshed yet
const GAME_DEFAULTS = { heroImageId: null, themes: [], trailerYoutubeId: null, freeToPlay: false } satisfies Partial<Game>;
const pack = (g: Game) => JSON.stringify({ ...g, _v: GAME_DATA_VERSION } satisfies StoredGame);
const unpack = (data: string) => {
  const { _v, ...game } = JSON.parse(data) as StoredGame;
  return { game: game as Game, outdated: (_v ?? 1) < GAME_DATA_VERSION };
};

/** re-fetch games whose cached data is from an older version (runs after the response) */
async function refreshOutdated(db: Db, env: Env, ids: number[]) {
  for (const id of ids) {
    try {
      const game = await fetchGame(db, env, id);
      if (game) await db.update(games).set({ data: pack(game), fetchedAt: Date.now() }).where(eq(games.igdbId, id));
    } catch (e) {
      console.error("refresh failed", id, e);
      return; // IGDB unhappy (or no keys) — try again on a later load
    }
  }
}

export const gameRoutes = router()
  .use(requireUser)

  .get("/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) return c.json([]);
    const over = await limited(c.env.SEARCH_LIMIT, `search:${me(c).id}`);
    if (over) return over;

    // search results are the same for everyone, so share them through the edge cache
    const cacheKey = new Request(new URL(`/__cache/search/v${SEARCH_VERSION}?q=${encodeURIComponent(q.toLowerCase())}`, c.req.url));
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(hit.body, hit);

    try {
      const results = await searchGames(c.get("db"), c.env, q);
      const res = Response.json(results, { headers: { "Cache-Control": "public, max-age=86400" } });
      c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch (e) {
      if (e instanceof IgdbNotConfigured) return c.json({ error: "game search isn't set up yet (missing IGDB keys)" }, 503);
      console.error(e);
      return c.json({ error: "game search is having a moment, try again" }, 502);
    }
  })

  // the whole arcade in one go: every game anyone rated, who rated it, how much
  .get("/arcade", async (c) => {
    const db = c.get("db");
    const [gameRows, interestRows, userRows, archivedRows] = await Promise.all([
      db.select().from(games).all(),
      db.select().from(interests).all(),
      db.select().from(users).all(),
      db.select().from(archivedInterests).all(),
    ]);
    const byGame = new Map<number, ArcadeGame>();
    const outdated: number[] = [];
    for (const g of gameRows) {
      const { game, outdated: old } = unpack(g.data);
      if (old) outdated.push(g.igdbId);
      byGame.set(g.igdbId, { ...GAME_DEFAULTS, ...game, addedAt: g.addedAt, interests: [] });
    }
    if (outdated.length) c.executionCtx.waitUntil(refreshOutdated(db, c.env, outdated.slice(0, REFRESH_PER_LOAD)));
    for (const i of interestRows) {
      const duration = i.durationMin !== null && i.durationMax !== null ? { min: i.durationMin, max: i.durationMax } : null;
      byGame.get(i.gameId)?.interests.push({ userId: i.userId, level: i.level as InterestLevel, duration, updatedAt: i.updatedAt });
    }
    const people: Record<string, PublicUser> = {};
    for (const u of userRows) people[u.id] = toPublic(u);
    const current = [...byGame.values()].filter((g) => g.interests.length);
    const body: ArcadeResponse = { games: current, users: people, archive: buildArchive(byGame, archivedRows) };
    return c.json(body);
  })

  .put("/:igdbId/interest", async (c) => {
    const igdbId = z.coerce.number().int().positive().safeParse(c.req.param("igdbId"));
    const body = interestBody.safeParse(await c.req.json().catch(() => null));
    if (!igdbId.success || !body.success) return c.json({ error: body.error?.issues[0]?.message ?? "bad game id" }, 400);
    const { level, duration } = body.data;
    const db = c.get("db");
    const now = Date.now();

    // make sure we have (fresh enough) game data before pointing an interest at it
    const cached = await db.select({ fetchedAt: games.fetchedAt, data: games.data }).from(games).where(eq(games.igdbId, igdbId.data)).get();
    if (!cached || now - cached.fetchedAt > STALE_AFTER || unpack(cached.data).outdated) {
      try {
        const game = await fetchGame(db, c.env, igdbId.data);
        if (!game) return c.json({ error: "IGDB doesn't know that game" }, 404);
        await db
          .insert(games)
          .values({ igdbId: game.igdbId, data: pack(game), fetchedAt: now, addedAt: now })
          .onConflictDoUpdate({ target: games.igdbId, set: { data: pack(game), fetchedAt: now } });
      } catch (e) {
        if (!cached) {
          if (e instanceof IgdbNotConfigured) return c.json({ error: "game search isn't set up yet (missing IGDB keys)" }, 503);
          console.error(e);
          return c.json({ error: "couldn't reach IGDB, try again" }, 502);
        }
        // stale but present — fine, refresh next time
      }
    }

    // duration: omitted → leave as is, null → clear, {min,max} → set
    const dur = duration === undefined ? {} : { durationMin: duration?.min ?? null, durationMax: duration?.max ?? null };
    await db
      .insert(interests)
      .values({ userId: me(c).id, gameId: igdbId.data, level, updatedAt: now, ...dur })
      .onConflictDoUpdate({ target: [interests.userId, interests.gameId], set: { level, updatedAt: now, ...dur } });
    return c.json({ ok: true });
  })

  .delete("/:igdbId/interest", async (c) => {
    const igdbId = z.coerce.number().int().positive().safeParse(c.req.param("igdbId"));
    if (!igdbId.success) return c.json({ error: "bad game id" }, 400);
    await c
      .get("db")
      .delete(interests)
      .where(and(eq(interests.userId, me(c).id), eq(interests.gameId, igdbId.data)));
    return c.json({ ok: true });
  });

