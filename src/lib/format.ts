// turning game metadata into short labels for cards, rows and the detail view

import type { Game } from "../../shared/types";

type PlayerInfo = Pick<Game, "onlineMax" | "gameModes">;

// it's an online event, so only online player counts matter (couch / LAN counts
// from IGDB's multiplayer_modes are ignored)
export function maxPlayers(g: Pick<Game, "onlineMax">) {
  return g.onlineMax && g.onlineMax > 0 ? g.onlineMax : null;
}

// IGDB game_modes → short labels, in display order
export const MODE_LABELS: [string, string][] = [
  ["Single player", "single player"],
  ["Multiplayer", "multiplayer"],
  ["Co-operative", "co-op"],
  ["Split screen", "split screen"],
  ["Massively Multiplayer Online (MMO)", "MMO"],
  ["Battle Royale", "battle royale"],
];
export const modeLabel = (m: string) => MODE_LABELS.find(([k]) => k === m)?.[1] ?? m.toLowerCase();
const has = (g: PlayerInfo, mode: string) => g.gameModes.includes(mode);

/**
 * the short players label for cards + rows: "1–4", "2–8", "1", or — when IGDB has
 * no online player count (common) — the mode: "MMO", "co-op", "multiplayer".
 * `solo` tells the caller which icon to use (one person vs a group).
 */
export function playersShort(g: PlayerInfo): { text: string; solo: boolean } | null {
  const max = maxPlayers(g);
  if (max && max > 1) return { text: `${has(g, "Single player") ? 1 : 2}–${max}`, solo: false };
  if (has(g, "Massively Multiplayer Online (MMO)")) return { text: "MMO", solo: false };
  if (has(g, "Battle Royale")) return { text: "battle royale", solo: false };
  if (has(g, "Co-operative")) return { text: "co-op", solo: false };
  if (has(g, "Multiplayer") || has(g, "Split screen")) return { text: "multiplayer", solo: false };
  if (has(g, "Single player")) return { text: "1", solo: true };
  return null;
}

/** detail view: "1–4 players · single player · multiplayer · co-op · split screen" */
export function playersLong(g: PlayerInfo) {
  const max = maxPlayers(g);
  const parts = [
    ...(max && max > 1 ? [`${has(g, "Single player") ? 1 : 2}–${max} players`] : []),
    ...MODE_LABELS.filter(([k]) => has(g, k)).map(([, l]) => l),
  ];
  return parts.length ? parts.join(" · ") : null;
}

// IGDB has no "main genre". Indie and Adventure are on a huge share of games,
// so skip them when there's anything more specific.
const VAGUE_GENRES = new Set(["Indie", "Adventure"]);
const SHORT_GENRES: Record<string, string> = {
  "Role-playing (RPG)": "RPG",
  "Real Time Strategy (RTS)": "RTS",
  "Turn-based strategy (TBS)": "TBS",
  "Hack and slash/Beat 'em up": "Beat 'em up",
  "Card & Board Game": "Card & Board",
  "Quiz/Trivia": "Trivia",
  "Point-and-click": "Point & click",
};

export const shortGenre = (g: string) => SHORT_GENRES[g] ?? g;

export function primaryGenre(g: Pick<Game, "genres">) {
  const pick = g.genres.find((x) => !VAGUE_GENRES.has(x)) ?? g.genres[0];
  return pick ? shortGenre(pick) : null;
}
