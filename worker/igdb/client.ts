// talks to IGDB. IGDB refuses browser requests, so the frontend goes through us.
// docs: https://api-docs.igdb.com/

import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { kv } from "../db/schema";
import { cleanQuery, toGame, toSearchHit, type RawGame } from "./map";

const TOKEN_KEY = "igdb_token";
const API = "https://api.igdb.com/v4";

export class IgdbNotConfigured extends Error {}

interface Creds { IGDB_CLIENT_ID?: string; IGDB_CLIENT_SECRET?: string }

async function fetchToken(env: Creds) {
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", env.IGDB_CLIENT_ID!);
  url.searchParams.set("client_secret", env.IGDB_CLIENT_SECRET!);
  url.searchParams.set("grant_type", "client_credentials");
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`twitch token ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
}

async function getToken(db: Db, env: Creds, force = false) {
  if (!force) {
    const row = await db.select().from(kv).where(eq(kv.key, TOKEN_KEY)).get();
    // treat it as stale a day early so we never send one that's about to die
    if (row && (row.expiresAt ?? 0) > Date.now() + 86_400_000) return row.value;
  }
  const { token, expiresAt } = await fetchToken(env);
  await db
    .insert(kv)
    .values({ key: TOKEN_KEY, value: token, expiresAt })
    .onConflictDoUpdate({ target: kv.key, set: { value: token, expiresAt } });
  return token;
}

async function query<T>(db: Db, env: Creds, endpoint: string, body: string): Promise<T> {
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) throw new IgdbNotConfigured();
  const send = async (token: string) =>
    fetch(`${API}/${endpoint}`, {
      method: "POST",
      headers: { "Client-ID": env.IGDB_CLIENT_ID!, Authorization: `Bearer ${token}`, Accept: "application/json" },
      body,
    });
  let res = await send(await getToken(db, env));
  if (res.status === 401) res = await send(await getToken(db, env, true)); // token revoked → retry once
  if (!res.ok) throw new Error(`igdb ${endpoint} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function searchGames(db: Db, env: Creds, q: string) {
  const term = cleanQuery(q);
  if (term.length < 2) return [];
  const raw = await query<RawGame[]>(
    db,
    env,
    "games",
    `search "${term}"; fields name,cover.image_id,first_release_date,platforms.name,platforms.abbreviation; where version_parent = null; limit 12;`,
  );
  return raw.map(toSearchHit);
}

const GAME_FIELDS = [
  "name", "slug", "summary", "url", "first_release_date", "cover.image_id",
  "platforms.name", "platforms.abbreviation", "genres.name", "game_modes.name",
  "multiplayer_modes.onlinemax", "multiplayer_modes.offlinemax",
  "multiplayer_modes.onlinecoopmax", "multiplayer_modes.offlinecoopmax",
  "multiplayer_modes.onlinecoop", "multiplayer_modes.offlinecoop",
  "multiplayer_modes.splitscreen", "multiplayer_modes.lancoop",
].join(",");

export async function fetchGame(db: Db, env: Creds, igdbId: number) {
  const id = Math.trunc(igdbId);
  const games = await query<RawGame[]>(db, env, "games", `fields ${GAME_FIELDS}; where id = ${id}; limit 1;`);
  const raw = games[0];
  return raw ? toGame(raw) : null;
}
