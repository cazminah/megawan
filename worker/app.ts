import { Hono, type Context, type MiddlewareHandler } from "hono";
import type { Db } from "./db/client";
import type { users } from "./db/schema";
import { isPalette, type Avatar, type Me, type PublicUser } from "../shared/types";

export type UserRow = typeof users.$inferSelect;

export type AppEnv = {
  Bindings: Env;
  Variables: { db: Db; user: UserRow | null };
};

export const router = () => new Hono<AppEnv>();
export type Ctx = Context<AppEnv>;

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return c.json({ error: "log in first" }, 401);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")?.isAdmin) return c.json({ error: "admins only" }, 403);
  await next();
};

/** the user, for handlers behind requireUser */
export const me = (c: Ctx) => c.get("user")!;

export const parseAvatar = (raw: string): Avatar => JSON.parse(raw) as Avatar;

export const toPublic = (u: UserRow): PublicUser => ({
  id: u.id,
  username: u.username,
  avatar: parseAvatar(u.avatar),
});

export const toMe = (u: UserRow): Me => ({ ...toPublic(u), email: u.email, isAdmin: !!u.isAdmin, palette: isPalette(u.palette) ? u.palette : "default" });

/** rate-limit by key; returns a 429 response if over, else null */
export async function limited(limiter: RateLimit, key: string) {
  const { success } = await limiter.limit({ key });
  return success ? null : Response.json({ error: "slow down a sec and try again" }, { status: 429 });
}

export const clientIp = (c: Ctx) => c.req.header("cf-connecting-ip") ?? "local";
