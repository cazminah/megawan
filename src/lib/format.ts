// turning game metadata into short labels for cards, rows and the detail view

import type { Game } from "../../shared/types";

type PlayerInfo = Pick<Game, "onlineMax" | "offlineMax" | "onlineCoop" | "offlineCoop" | "gameModes">;

export function maxPlayers(g: Pick<Game, "onlineMax" | "offlineMax">) {
  return Math.max(g.onlineMax ?? 0, g.offlineMax ?? 0) || null;
}

const has = (g: PlayerInfo, mode: string) => g.gameModes.includes(mode);

/**
 * the short players label for cards + rows: "1–4", "2–8", "1", or — when IGDB has
 * no player counts (common) — the mode: "co-op", "multiplayer", "MMO", "solo".
 * `solo` tells the caller which icon to use (one person vs a group).
 */
export function playersShort(g: PlayerInfo): { text: string; solo: boolean } | null {
  const max = maxPlayers(g);
  if (max && max > 1) return { text: `${has(g, "Single player") ? 1 : 2}–${max}`, solo: false };
  if (has(g, "Massively Multiplayer Online (MMO)")) return { text: "MMO", solo: false };
  if (has(g, "Battle Royale")) return { text: "battle royale", solo: false };
  if (has(g, "Co-operative") || g.onlineCoop || g.offlineCoop) return { text: "co-op", solo: false };
  if (has(g, "Multiplayer") || has(g, "Split screen")) return { text: "multiplayer", solo: false };
  if (has(g, "Single player")) return { text: "1", solo: true };
  return null;
}

/** the spelled-out version for the detail view: "1–4 players · up to 4 online · co-op · split screen" */
export function playersLong(g: PlayerInfo) {
  const short = playersShort(g);
  if (!short) return null;
  const parts: string[] = [];
  if (/^\d/.test(short.text)) parts.push(short.solo ? "single player" : `${short.text} players`);
  else parts.push(short.text);
  if (g.onlineMax && g.onlineMax > 1) parts.push(`up to ${g.onlineMax} online`);
  if (g.offlineMax && g.offlineMax > 1) parts.push(`up to ${g.offlineMax} local`);
  if ((g.onlineCoop || g.offlineCoop || has(g, "Co-operative")) && short.text !== "co-op") parts.push("co-op");
  if (has(g, "Split screen")) parts.push("split screen");
  return parts.join(" · ");
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
