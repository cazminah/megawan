import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { sessions, users } from "../db/schema";
import type { Db } from "../db/client";
import { randomToken, sha256Hex } from "./tokens";

export const COOKIE = "mw_session";
const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 30 * DAY;
const REFRESH_WHEN_UNDER = 15 * DAY;

export async function createSession(db: Db, userId: string, now = Date.now()) {
  const token = randomToken();
  const expiresAt = now + SESSION_TTL;
  await db.insert(sessions).values({ id: await sha256Hex(token), userId, expiresAt });
  return { token, expiresAt };
}

/** the user behind a cookie token, sliding the expiry forward when it's getting old */
export async function validateSession(db: Db, token: string, now = Date.now()) {
  const id = await sha256Hex(token);
  const row = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;
  if (row.session.expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  let expiresAt = row.session.expiresAt;
  const refreshed = expiresAt - now < REFRESH_WHEN_UNDER;
  if (refreshed) {
    expiresAt = now + SESSION_TTL;
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
  }
  return { user: row.user, expiresAt, refreshed };
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
}

export function setSessionCookie(c: Context, token: string, expiresAt: number) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export const readSessionCookie = (c: Context) => getCookie(c, COOKIE);
export const clearSessionCookie = (c: Context) => deleteCookie(c, COOKIE, { path: "/" });
