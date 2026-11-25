import { useCallback, useEffect, useState } from "react";
import type { ArcadeResponse, Duration, Game, InterestLevel, Me, SearchHit } from "../../shared/types";
import { api } from "./api";

/** what changes when someone votes. duration: undefined = leave it, null = clear it */
export interface InterestPatch {
  level: InterestLevel | null; // null = remove the vote entirely
  duration?: Duration | null;
}

/** `seed` is what to show while a brand-new game loads: a search hit, or a full game (from the archive) */
export type SetInterest = (igdbId: number, patch: InterestPatch, seed?: SearchHit | Game) => Promise<void>;

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
    async (igdbId, { level, duration }, seed) => {
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
        if (isNew && level && seed) {
          // brand-new (or brought back) game: show it straight away, real data follows
          const vote = { userId: me.id, level, duration: duration ?? null, updatedAt: Date.now() };
          const base: Game =
            "gameModes" in seed
              ? seed
              : {
                  igdbId, name: seed.name, slug: String(igdbId), coverImageId: seed.coverImageId, heroImageId: null,
                  themes: [], trailerYoutubeId: null, freeToPlay: false, releaseYear: seed.releaseYear, summary: null,
                  platforms: seed.platforms, genres: [], gameModes: [], onlineMax: null, offlineMax: null,
                  onlineCoop: false, offlineCoop: false, igdbUrl: null,
                };
          games = [...games, { ...base, addedAt: Date.now(), interests: [vote] }];
        }
        // a game with votes this time round leaves the archive
        const archive = level
          ? d.archive.map((s) => ({ ...s, games: s.games.filter((g) => g.igdbId !== igdbId) })).filter((s) => s.games.length)
          : d.archive;
        return { users, games, archive };
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
