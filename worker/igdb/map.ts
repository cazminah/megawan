// turns raw IGDB responses into our own Game / SearchHit shapes.
// pure functions, no fetches — easy to test against a fixture.

import type { Game, SearchHit, StoreLink } from "../../shared/types";

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
export interface RawGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  url?: string;
  first_release_date?: number; // unix seconds
  cover?: { image_id?: string };
  platforms?: RawPlatform[];
  genres?: { name?: string }[];
  game_modes?: { name?: string }[];
  multiplayer_modes?: RawMultiplayer[];
  websites?: { url?: string }[];
  external_games?: { url?: string }[];
}
export interface RawTimeToBeat { hastily?: number; normally?: number; completely?: number }

// "PC (Microsoft Windows)" is a mouthful — prefer short names where IGDB has them
export function platformName(p: RawPlatform) {
  return (p.abbreviation || p.name || "").trim();
}

const year = (unix?: number) => (unix ? new Date(unix * 1000).getUTCFullYear() : null);

const names = (xs?: { name?: string }[]) =>
  [...new Set((xs ?? []).map((x) => x.name?.trim()).filter((x): x is string => !!x))];

// work out the store from the link itself, so we don't depend on IGDB's
// website-type enum numbers staying put
const STORES: [RegExp, string][] = [
  [/(^|\.)store\.steampowered\.com$|(^|\.)steamcommunity\.com$/, "Steam"],
  [/(^|\.)epicgames\.com$/, "Epic"],
  [/(^|\.)gog\.com$/, "GOG"],
  [/(^|\.)itch\.io$/, "itch.io"],
  [/(^|\.)humblebundle\.com$/, "Humble"],
  [/(^|\.)xbox\.com$|(^|\.)microsoft\.com$/, "Xbox"],
  [/(^|\.)playstation\.com$/, "PlayStation"],
  [/(^|\.)nintendo\.(com|co\.uk)$/, "Nintendo"],
  [/(^|\.)apps\.apple\.com$/, "App Store"],
  [/(^|\.)play\.google\.com$/, "Google Play"],
];

export function storeLinks(urls: (string | undefined)[]): StoreLink[] {
  const seen = new Set<string>();
  const out: StoreLink[] = [];
  for (const raw of urls) {
    if (!raw) continue;
    let host: string;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      host = u.hostname.toLowerCase();
    } catch {
      continue;
    }
    // steamcommunity links are community hubs, not the shop page
    if (host.endsWith("steamcommunity.com")) continue;
    const store = STORES.find(([re]) => re.test(host))?.[1];
    if (!store || seen.has(store)) continue;
    seen.add(store);
    out.push({ store, url: raw.replace(/^http:/, "https:") });
  }
  return out;
}

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

export function toGame(raw: RawGame, ttb?: RawTimeToBeat | null): Game {
  const modes = raw.multiplayer_modes;
  return {
    igdbId: raw.id,
    name: raw.name,
    slug: raw.slug ?? String(raw.id),
    coverImageId: raw.cover?.image_id ?? null,
    releaseYear: year(raw.first_release_date),
    summary: raw.summary ?? null,
    platforms: [...new Set((raw.platforms ?? []).map(platformName).filter(Boolean))],
    genres: names(raw.genres),
    gameModes: names(raw.game_modes),
    onlineMax: maxOf(modes, "onlinemax", "onlinecoopmax"),
    offlineMax: maxOf(modes, "offlinemax", "offlinecoopmax"),
    onlineCoop: !!modes?.some((m) => m.onlinecoop),
    offlineCoop: !!modes?.some((m) => m.offlinecoop || m.splitscreen || m.lancoop),
    ttbHastily: ttb?.hastily || null,
    ttbNormally: ttb?.normally || null,
    ttbCompletely: ttb?.completely || null,
    storeLinks: storeLinks([
      ...(raw.websites ?? []).map((w) => w.url),
      ...(raw.external_games ?? []).map((e) => e.url),
    ]),
    igdbUrl: raw.url ?? null,
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
