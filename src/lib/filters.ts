// pure filtering, sorting and grouping for the arcade — kept out of the
// components so it's testable

import { INTEREST_LEVELS, LEVELS, hypeScore, type ArcadeGame, type InterestLevel } from "../../shared/types";
import { maxPlayers, primaryGenre, shortGenre } from "./format";

export type Sort = "hype" | "people" | "recent" | "year" | "az";
export type GroupBy = "none" | "genre" | "size" | "keenness";
export type MyVote = "any" | "voted" | "not-voted";

export interface Filters {
  text: string;
  platforms: string[]; // match any
  genres: string[]; // short names, match any of the game's genres
  themes: string[]; // match any
  players: number; // "works for N of us" — 0 = any
  gameModes: string[]; // IGDB game_modes, match any
  duration: number | null; // index into DURATIONS: someone's up for that long
  people: string[]; // user ids: games every one of them has voted on
  minHeadcount: number; // 0 = any
  myVote: MyVote;
  freeToPlay: boolean;
  sort: Sort;
  groupBy: GroupBy;
}

export const DEFAULT_FILTERS: Filters = {
  text: "",
  platforms: [],
  genres: [],
  themes: [],
  players: 0,
  gameModes: [],
  duration: null,
  people: [],
  minHeadcount: 0,
  myVote: "any",
  freeToPlay: false,
  sort: "hype",
  groupBy: "none",
};

/** filters that count towards the "filters · N" badge (text, sort and grouping don't) */
export function activeFilterCount(f: Filters) {
  return (
    f.platforms.length + f.genres.length + f.themes.length + f.people.length + f.gameModes.length +
    (f.players ? 1 : 0) + (f.duration !== null ? 1 : 0) +
    (f.minHeadcount ? 1 : 0) + (f.myVote !== "any" ? 1 : 0) + (f.freeToPlay ? 1 : 0)
  );
}

// ---- the "find in the arcade" box ------------------------------------------
// every typed word has to hit something: name, year, platform, genre, theme or mode.

export type TokenKind = "year" | "platform" | "genre" | "theme" | "mode" | "name";

const mode = (m: string) => (g: ArcadeGame) => g.gameModes.includes(m);
const MODE_WORDS: Record<string, (g: ArcadeGame) => boolean> = {
  "co-op": mode("Co-operative"),
  coop: mode("Co-operative"),
  multiplayer: (g) => g.gameModes.includes("Multiplayer") || (maxPlayers(g) ?? 0) > 1,
  split: mode("Split screen"),
  splitscreen: mode("Split screen"),
  mmo: mode("Massively Multiplayer Online (MMO)"),
  "battle-royale": mode("Battle Royale"),
  royale: mode("Battle Royale"),
  solo: mode("Single player"),
  singleplayer: mode("Single player"),
  f2p: (g) => g.freeToPlay,
  free: (g) => g.freeToPlay,
};

export function tokenize(text: string) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9|&']+/).filter(Boolean);
const hitsAny = (t: string, values: string[]) =>
  values.some((v) => v.toLowerCase() === t || words(v).some((w) => w.startsWith(t)));

/** what a single word matches on this game (most specific first), or null */
export function tokenHit(g: ArcadeGame, t: string): TokenKind | null {
  if (/^\d{4}$/.test(t)) return g.releaseYear === Number(t) ? "year" : null;
  if (hitsAny(t, g.platforms)) return "platform";
  if (hitsAny(t, [...g.genres, ...g.genres.map(shortGenre)])) return "genre";
  if (hitsAny(t, g.themes)) return "theme";
  if (MODE_WORDS[t]?.(g)) return "mode";
  if (g.name.toLowerCase().includes(t)) return "name";
  return null;
}

/** for the chips under the search box: what each word is being read as (null = matches nothing) */
export function explainTokens(games: ArcadeGame[], text: string): { token: string; kind: TokenKind | null }[] {
  const order: TokenKind[] = ["year", "platform", "genre", "theme", "mode", "name"];
  return tokenize(text).map((token) => {
    const kinds = new Set(games.map((g) => tokenHit(g, token)));
    return { token, kind: order.find((k) => kinds.has(k)) ?? null };
  });
}

// ---- filtering + sorting ----------------------------------------------------

export function applyFilters(games: ArcadeGame[], f: Filters, myId: string | null) {
  const tokens = tokenize(f.text);
  const out = games.filter((g) => {
    if (tokens.length && !tokens.every((t) => tokenHit(g, t))) return false;
    if (f.platforms.length && !g.platforms.some((p) => f.platforms.includes(p))) return false;
    if (f.genres.length && !g.genres.some((x) => f.genres.includes(shortGenre(x)))) return false;
    if (f.themes.length && !g.themes.some((x) => f.themes.includes(x))) return false;
    if (f.players && (maxPlayers(g) ?? 0) < f.players) return false;
    if (f.gameModes.length && !g.gameModes.some((m) => f.gameModes.includes(m))) return false;
    const d = f.duration;
    if (d !== null && !g.interests.some((i) => i.duration && i.duration.min <= d && d <= i.duration.max)) return false;
    if (f.people.length && !f.people.every((id) => g.interests.some((i) => i.userId === id))) return false;
    if (f.minHeadcount && g.interests.length < f.minHeadcount) return false;
    if (f.myVote !== "any" && myId) {
      const voted = g.interests.some((i) => i.userId === myId);
      if (voted !== (f.myVote === "voted")) return false;
    }
    if (f.freeToPlay && !g.freeToPlay) return false;
    return true;
  });
  const by: Record<Sort, (a: ArcadeGame, b: ArcadeGame) => number> = {
    hype: (a, b) => hypeScore(b.interests) - hypeScore(a.interests) || b.interests.length - a.interests.length,
    people: (a, b) => b.interests.length - a.interests.length || hypeScore(b.interests) - hypeScore(a.interests),
    recent: (a, b) => b.addedAt - a.addedAt,
    year: (a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0),
    az: () => 0,
  };
  return out.sort((a, b) => by[f.sort](a, b) || a.name.localeCompare(b.name));
}

/** every value of a field across the arcade, most common first */
export function facet(games: ArcadeGame[], pick: (g: ArcadeGame) => string[]) {
  const counts = new Map<string, number>();
  for (const g of games) for (const v of new Set(pick(g))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

// ---- grouping ---------------------------------------------------------------

export interface Group {
  key: string;
  label: string;
  level?: InterestLevel; // keenness groups get the tier icon + colour
  games: ArcadeGame[];
}

const SIZE_BUCKETS = [
  { key: "solo", label: "solo" },
  { key: "2-4", label: "2–4 players" },
  { key: "5-8", label: "5–8 players" },
  { key: "9+", label: "9+ players" },
  { key: "unknown", label: "group size unknown" },
] as const;

function sizeBucket(g: ArcadeGame) {
  const max = maxPlayers(g);
  if (max && max > 8) return "9+";
  if (max && max > 4) return "5-8";
  if (max && max > 1) return "2-4";
  if (g.gameModes.length && g.gameModes.every((m) => m === "Single player")) return "solo";
  return "unknown";
}

const topLevel = (g: ArcadeGame) => g.interests.reduce<InterestLevel>((m, i) => (i.level > m ? i.level : m), 1);

/** splits an already-sorted list into groups; each game lands in exactly one */
export function groupGames(games: ArcadeGame[], by: GroupBy): Group[] {
  if (by === "none") return [{ key: "all", label: "", games }];
  const keyOf = (g: ArcadeGame) =>
    by === "genre" ? (primaryGenre(g) ?? "other") : by === "size" ? sizeBucket(g) : String(topLevel(g));
  const map = new Map<string, ArcadeGame[]>();
  for (const g of games) {
    const k = keyOf(g);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(g);
  }
  if (by === "size") {
    return SIZE_BUCKETS.filter((b) => map.has(b.key)).map((b) => ({ key: b.key, label: b.label, games: map.get(b.key)! }));
  }
  if (by === "keenness") {
    return [...LEVELS].reverse().filter((l) => map.has(String(l))).map((l) => ({
      key: String(l), label: INTEREST_LEVELS[l].label, level: l, games: map.get(String(l))!,
    }));
  }
  // genre: biggest groups first, "other" last
  return [...map.entries()]
    .sort((a, b) => (a[0] === "other" ? 1 : b[0] === "other" ? -1 : b[1].length - a[1].length || a[0].localeCompare(b[0])))
    .map(([k, gs]) => ({ key: k, label: k, games: gs }));
}
