import { useCallback, useEffect, useState } from "react";
import type { ArcadeGame, ArcadeResponse, Duration, InterestLevel, Me, SearchHit } from "../../shared/types";
import { api } from "./api";

/** what changes when someone votes. duration: undefined = leave it, null = clear it */
export interface InterestPatch {
  level: InterestLevel | null; // null = remove the vote entirely
  duration?: Duration | null;
}

export type SetInterest = (igdbId: number, patch: InterestPatch, hit?: SearchHit) => Promise<void>;

/** the arcade's data, plus vote changes that show instantly and roll back on failure */
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

  const setInterest = useCallback<SetInterest>(
    async (igdbId, { level, duration }, hit) => {
      if (!me) return;
      const before = data;
      const isNew = !data?.games.some((g) => g.igdbId === igdbId);
      // optimistic: patch our own vote straight in
      setData((d) => {
        if (!d) return d;
        const users = { ...d.users, [me.id]: me };
        let games = d.games.map((g) => {
          if (g.igdbId !== igdbId) return g;
          const old = g.interests.find((i) => i.userId === me.id);
          const others = g.interests.filter((i) => i.userId !== me.id);
          if (!level) return { ...g, interests: others };
          const dur = duration === undefined ? (old?.duration ?? null) : duration;
          return { ...g, interests: [...others, { userId: me.id, level, duration: dur, updatedAt: Date.now() }] };
        });
        games = games.filter((g) => g.interests.length);
        if (isNew && level && hit) {
          // brand-new game: show a placeholder card until the real data lands
          const placeholder: ArcadeGame = {
            igdbId, name: hit.name, slug: String(igdbId), coverImageId: hit.coverImageId, heroImageId: null,
            releaseYear: hit.releaseYear, summary: null, platforms: hit.platforms, genres: [], gameModes: [],
            onlineMax: null, offlineMax: null, onlineCoop: false, offlineCoop: false, igdbUrl: null, addedAt: Date.now(),
            interests: [{ userId: me.id, level, duration: duration ?? null, updatedAt: Date.now() }],
          };
          games = [...games, placeholder];
        }
        return { users, games };
      });
      try {
        if (level) await api.setInterest(igdbId, level, duration);
        else await api.clearInterest(igdbId);
        if (isNew) await reload(); // fetch the full game details
      } catch (e) {
        setData(before);
        throw e;
      }
    },
    [data, me, reload],
  );

  return { data, error, reload, setInterest };
}
