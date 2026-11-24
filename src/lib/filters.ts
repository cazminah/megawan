// pure filtering + sorting for the arcade, kept out of the components so it's testable

import { hypeScore, type ArcadeGame } from "../../shared/types";
import { maxPlayers } from "./format";

export type Sort = "hype" | "people" | "recent" | "az";
export type Multi = "any" | "online" | "local" | "coop";
export type MaxLength = "any" | "5" | "15" | "40";

export interface Filters {
  text: string;
  platforms: string[]; // match any
  genres: string[]; // match any
  multi: Multi;
  minPlayers: number; // 0 = any
  maxLength: MaxLength;
  unratedByMe: boolean;
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = {
  text: "",
  platforms: [],
  genres: [],
  multi: "any",
  minPlayers: 0,
  maxLength: "any",
  unratedByMe: false,
  sort: "hype",
};

export function applyFilters(games: ArcadeGame[], f: Filters, myId: string | null) {
  const text = f.text.trim().toLowerCase();
  const maxSecs = f.maxLength === "any" ? null : Number(f.maxLength) * 3600;
  const out = games.filter((g) => {
    if (text && !g.name.toLowerCase().includes(text)) return false;
    if (f.platforms.length && !g.platforms.some((p) => f.platforms.includes(p))) return false;
    if (f.genres.length && !g.genres.some((x) => f.genres.includes(x))) return false;
    if (f.multi === "online" && !((g.onlineMax ?? 0) > 1 || g.onlineCoop)) return false;
    if (f.multi === "local" && !((g.offlineMax ?? 0) > 1 || g.offlineCoop)) return false;
    if (f.multi === "coop" && !(g.onlineCoop || g.offlineCoop)) return false;
    if (f.minPlayers && (maxPlayers(g) ?? 1) < f.minPlayers) return false;
    if (maxSecs !== null && !(g.ttbNormally && g.ttbNormally <= maxSecs)) return false;
    if (f.unratedByMe && myId && g.interests.some((i) => i.userId === myId)) return false;
    return true;
  });
  const by: Record<Sort, (a: ArcadeGame, b: ArcadeGame) => number> = {
    hype: (a, b) => hypeScore(b.interests) - hypeScore(a.interests) || b.interests.length - a.interests.length,
    people: (a, b) => b.interests.length - a.interests.length || hypeScore(b.interests) - hypeScore(a.interests),
    recent: (a, b) => b.addedAt - a.addedAt,
    az: () => 0,
  };
  return out.sort((a, b) => by[f.sort](a, b) || a.name.localeCompare(b.name));
}

/** every value of a field across the arcade, most common first */
export function facet(games: ArcadeGame[], pick: (g: ArcadeGame) => string[]) {
  const counts = new Map<string, number>();
  for (const g of games) for (const v of pick(g)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

export function activeFilterCount(f: Filters) {
  return (
    f.platforms.length + f.genres.length + (f.multi !== "any" ? 1 : 0) + (f.minPlayers ? 1 : 0) +
    (f.maxLength !== "any" ? 1 : 0) + (f.unratedByMe ? 1 : 0)
  );
}
