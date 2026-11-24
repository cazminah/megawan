import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ArcadeGame, ArcadeResponse, Game, InterestLevel, PublicUser } from "../../shared/types";
import { limited, me, requireUser, router, toPublic } from "../app";
import { games, interests, users } from "../db/schema";
import { fetchGame, IgdbNotConfigured, searchGames } from "../igdb/client";

const STALE_AFTER = 30 * 24 * 60 * 60 * 1000; // re-pull IGDB data a month after we cached it

export const gameRoutes = router()
  .use(requireUser)

  .get("/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) return c.json([]);
    const over = await limited(c.env.SEARCH_LIMIT, `search:${me(c).id}`);
    if (over) return over;

    // search results are the same for everyone, so share them through the edge cache
    const cacheKey = new Request(new URL(`/__cache/search?q=${encodeURIComponent(q.toLowerCase())}`, c.req.url));
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
    const [gameRows, interestRows, userRows] = await Promise.all([
      db.select().from(games).all(),
      db.select().from(interests).all(),
      db.select().from(users).all(),
    ]);
    const byGame = new Map<number, ArcadeGame>();
    for (const g of gameRows) byGame.set(g.igdbId, { ...(JSON.parse(g.data) as Game), addedAt: g.addedAt, interests: [] });
    for (const i of interestRows) {
      byGame.get(i.gameId)?.interests.push({ userId: i.userId, level: i.level as InterestLevel, updatedAt: i.updatedAt });
    }
    const people: Record<string, PublicUser> = {};
    for (const u of userRows) people[u.id] = toPublic(u);
    const body: ArcadeResponse = { games: [...byGame.values()].filter((g) => g.interests.length), users: people };
    return c.json(body);
  })

  .put("/:igdbId/interest", async (c) => {
    const igdbId = z.coerce.number().int().positive().safeParse(c.req.param("igdbId"));
    const level = z.object({ level: z.number().int().min(1).max(5) }).safeParse(await c.req.json().catch(() => null));
    if (!igdbId.success || !level.success) return c.json({ error: "pick a level from 1 to 5" }, 400);
    const db = c.get("db");
    const now = Date.now();

    // make sure we have (fresh enough) game data before pointing an interest at it
    const cached = await db.select({ fetchedAt: games.fetchedAt }).from(games).where(eq(games.igdbId, igdbId.data)).get();
    if (!cached || now - cached.fetchedAt > STALE_AFTER) {
      try {
        const game = await fetchGame(db, c.env, igdbId.data);
        if (!game) return c.json({ error: "IGDB doesn't know that game" }, 404);
        await db
          .insert(games)
          .values({ igdbId: game.igdbId, data: JSON.stringify(game), fetchedAt: now, addedAt: now })
          .onConflictDoUpdate({ target: games.igdbId, set: { data: JSON.stringify(game), fetchedAt: now } });
      } catch (e) {
        if (!cached) {
          if (e instanceof IgdbNotConfigured) return c.json({ error: "game search isn't set up yet (missing IGDB keys)" }, 503);
          console.error(e);
          return c.json({ error: "couldn't reach IGDB, try again" }, 502);
        }
        // stale but present — fine, refresh next time
      }
    }

    await db
      .insert(interests)
      .values({ userId: me(c).id, gameId: igdbId.data, level: level.data.level, updatedAt: now })
      .onConflictDoUpdate({ target: [interests.userId, interests.gameId], set: { level: level.data.level, updatedAt: now } });
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

