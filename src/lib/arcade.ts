import { useCallback, useEffect, useState } from "react";
import type { ArcadeResponse, InterestLevel, Me, SearchHit } from "../../shared/types";
import { api } from "./api";

/** the arcade's data, plus interest changes that show instantly and roll back on failure */
export function useArcade(me: Me | null) {
  const [data, setData] = useState<ArcadeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api.arcade());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (me) void reload();
  }, [me, reload]);

  // pick up other people's votes when you come back to the tab
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && me && void reload();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [me, reload]);

  const setLevel = useCallback(
    async (igdbId: number, level: InterestLevel | null, hit?: SearchHit) => {
      if (!me) return;
      const before = data;
      // optimistic: patch our own vote straight in
      setData((d) => {
        if (!d) return d;
        const users = { ...d.users, [me.id]: me };
        const exists = d.games.some((g) => g.igdbId === igdbId);
        let games = d.games.map((g) => {
          if (g.igdbId !== igdbId) return g;
          const others = g.interests.filter((i) => i.userId !== me.id);
          return { ...g, interests: level ? [...others, { userId: me.id, level, updatedAt: Date.now() }] : others };
        });
        games = games.filter((g) => g.interests.length);
        if (!exists && level && hit) {
          // brand-new game: show a placeholder card until the real data lands
          games = [
            ...games,
            {
              igdbId, name: hit.name, slug: String(igdbId), coverImageId: hit.coverImageId, releaseYear: hit.releaseYear,
              summary: null, platforms: hit.platforms, genres: [], gameModes: [], onlineMax: null, offlineMax: null,
              onlineCoop: false, offlineCoop: false, ttbHastily: null, ttbNormally: null, ttbCompletely: null,
              storeLinks: [], igdbUrl: null, addedAt: Date.now(),
              interests: [{ userId: me.id, level, updatedAt: Date.now() }],
            },
          ];
        }
        return { users, games };
      });
      try {
        if (level) await api.setInterest(igdbId, level);
        else await api.clearInterest(igdbId);
        if (hit || !data?.games.some((g) => g.igdbId === igdbId)) await reload(); // fetch the full game details
      } catch (e) {
        setData(before);
        throw e;
      }
    },
    [data, me, reload],
  );

  return { data, error, reload, setLevel };
}
