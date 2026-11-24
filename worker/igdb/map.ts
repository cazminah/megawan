// turns raw IGDB responses into our own Game / SearchHit shapes.
// pure functions, no fetches — easy to test against a fixture.

import type { Game, SearchHit } from "../../shared/types";

export interface RawPlatform { name?: string; abbreviation?: string }
export interface RawMultiplayer {
  onlinemax?: number;
  offlinemax?: number;
  onlinecoopmax?: number;
  offlinecoopmax?: number;
  onlinecoop?: boolean;
  offlinecoop?: boolean;
  splitscreen?: boolean;
  lancoop?: boolean;
}
export interface RawImage { image_id?: string; width?: number; height?: number }

export interface RawGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  url?: string;
  first_release_date?: number; // unix seconds
  cover?: { image_id?: string };
  artworks?: RawImage[];
  screenshots?: RawImage[];
  platforms?: RawPlatform[];
  genres?: { name?: string }[];
  themes?: { name?: string }[];
  videos?: { video_id?: string; name?: string }[];
  keywords?: number[];
  game_modes?: { name?: string }[];
  multiplayer_modes?: RawMultiplayer[];
}

// "PC (Microsoft Windows)" is a mouthful — prefer short names where IGDB has them
export function platformName(p: RawPlatform) {
  return (p.abbreviation || p.name || "").trim();
}

const year = (unix?: number) => (unix ? new Date(unix * 1000).getUTCFullYear() : null);

const names = (xs?: { name?: string }[]) =>
  [...new Set((xs ?? []).map((x) => x.name?.trim()).filter((x): x is string => !!x))];

export function maxOf(modes: RawMultiplayer[] | undefined, ...keys: (keyof RawMultiplayer)[]) {
  let best: number | null = null;
  for (const m of modes ?? []) {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === "number" && v > 0 && (best === null || v > best)) best = v;
    }
  }
  return best;
}

// IGDB keyword id for "free-to-play" (looked up via /v4/keywords)
export const FREE_TO_PLAY_KEYWORD = 2385;

/** a YouTube id for the game's trailer: one named "trailer" if there is one, else the first video */
export function trailer(raw: RawGame) {
  const vids = (raw.videos ?? []).filter((v) => v.video_id && /^[\w-]{6,20}$/.test(v.video_id));
  return (vids.find((v) => /trailer/i.test(v.name ?? "")) ?? vids[0])?.video_id ?? null;
}

/** best wide image for a card: a landscape artwork, else the first screenshot, else none */
export function heroImage(raw: RawGame) {
  const wide = (raw.artworks ?? []).find((a) => a.image_id && (a.width ?? 16) >= (a.height ?? 9) * 1.2);
  return wide?.image_id ?? raw.screenshots?.find((s) => s.image_id)?.image_id ?? null;
}

export function toGame(raw: RawGame): Game {
  const modes = raw.multiplayer_modes;
  return {
    igdbId: raw.id,
    name: raw.name,
    slug: raw.slug ?? String(raw.id),
    coverImageId: raw.cover?.image_id ?? null,
    heroImageId: heroImage(raw),
    releaseYear: year(raw.first_release_date),
    summary: raw.summary ?? null,
    platforms: [...new Set((raw.platforms ?? []).map(platformName).filter(Boolean))],
    genres: names(raw.genres),
    themes: names(raw.themes),
    gameModes: names(raw.game_modes),
    onlineMax: maxOf(modes, "onlinemax", "onlinecoopmax"),
    offlineMax: maxOf(modes, "offlinemax", "offlinecoopmax"),
    onlineCoop: !!modes?.some((m) => m.onlinecoop),
    offlineCoop: !!modes?.some((m) => m.offlinecoop || m.splitscreen || m.lancoop),
    igdbUrl: raw.url ?? null,
    trailerYoutubeId: trailer(raw),
    freeToPlay: (raw.keywords ?? []).includes(FREE_TO_PLAY_KEYWORD),
  };
}

export function toSearchHit(raw: RawGame): SearchHit {
  return {
    igdbId: raw.id,
    name: raw.name,
    coverImageId: raw.cover?.image_id ?? null,
    releaseYear: year(raw.first_release_date),
    platforms: [...new Set((raw.platforms ?? []).map(platformName).filter(Boolean))],
  };
}

/** strip anything that could break out of the apicalypse `search "…"` string */
export function cleanQuery(q: string) {
  return q.replace(/["\\;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
