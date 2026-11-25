import { lt } from "drizzle-orm";
import { secureHeaders } from "hono/secure-headers";
import { router, type AppEnv } from "./app";
import { getDb } from "./db/client";
import { resetTokens, sessions } from "./db/schema";
import { clearSessionCookie, readSessionCookie, setSessionCookie, validateSession } from "./auth/session";
import { AVATAR_KEY_RE } from "./avatars";
import { auth } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { gameRoutes } from "./routes/games";
import { adminRoutes } from "./routes/admin";
import { eventRoutes } from "./routes/event";
import { Hono } from "hono";

const api = router()
  .route("/auth", auth)
  .route("/me", meRoutes)
  .route("/games", gameRoutes)
  .route("/admin", adminRoutes)
  .route("/event", eventRoutes)
  .notFound((c) => c.json({ error: "not found" }, 404));

const app = new Hono<AppEnv>()
  .use(secureHeaders({ crossOriginResourcePolicy: "same-origin" }))

  // every request: attach the db and (if the cookie's good) the user
  .use(async (c, next) => {
    const db = getDb(c.env.DB);
    c.set("db", db);
    c.set("user", null);
    const token = readSessionCookie(c);
    if (token) {
      const session = await validateSession(db, token);
      if (session) {
        c.set("user", session.user);
        if (session.refreshed) setSessionCookie(c, token, session.expiresAt);
      } else {
        clearSessionCookie(c);
      }
    }
    await next();
  })

  // reject cross-site writes (belt + braces on top of SameSite=Lax cookies)
  .use("/api/*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origin = c.req.header("origin");
      if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "bad origin" }, 403);
    }
    await next();
  })

  .route("/api", api)

  .get("/avatars/:key", async (c) => {
    const key = c.req.param("key");
    if (!AVATAR_KEY_RE.test(key)) return c.notFound();
    const obj = await c.env.AVATARS.get(key);
    if (!obj) return c.notFound();
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
        // keys change on every upload, so the old url can be cached forever
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

export default {
  fetch: app.fetch,
  async scheduled(_event, env) {
    const db = getDb(env.DB);
    const now = Date.now();
    await db.batch([
      db.delete(sessions).where(lt(sessions.expiresAt, now)),
      db.delete(resetTokens).where(lt(resetTokens.expiresAt, now)),
    ]);
  },
} satisfies ExportedHandler<Env>;
