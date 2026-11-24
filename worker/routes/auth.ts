import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { USERNAME_RE, randomAvatar } from "../../shared/types";
import { clientIp, limited, router, toMe } from "../app";
import { resetTokens, sessions, users } from "../db/schema";
import { dummyHash, hashPassword, verifyPassword } from "../auth/hash";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionCookie,
  setSessionCookie,
} from "../auth/session";
import { randomToken, sha256Hex } from "../auth/tokens";
import { resetMail, sendMail } from "../email";

export const password = z.string().min(8, "passphrase needs 8+ characters").max(200);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "username: 3–24 of a–z, 0–9, _ or -");
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("that email doesn't look right")
  .or(z.literal("").transform(() => null))
  .nullable()
  .optional();

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "invalid input";
const RESET_TTL = 60 * 60 * 1000;

export const auth = router()
  .post("/register", async (c) => {
    const over = await limited(c.env.AUTH_LIMIT, `register:${clientIp(c)}`);
    if (over) return over;
    const parsed = z.object({ username, password, email }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: firstError(parsed.error) }, 400);
    const db = c.get("db");
    const { username: name, password: pw, email: mail } = parsed.data;

    const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, name)).get();
    if (taken) return c.json({ error: "that username's taken" }, 409);

    const user = {
      id: crypto.randomUUID(),
      username: name,
      email: mail ?? null,
      passwordHash: await hashPassword(pw),
      avatar: JSON.stringify(randomAvatar()),
      createdAt: Date.now(),
    };
    try {
      await db.insert(users).values(user);
    } catch {
      return c.json({ error: "that username's taken" }, 409); // lost a race to the unique index
    }
    const s = await createSession(db, user.id);
    setSessionCookie(c, s.token, s.expiresAt);
    return c.json(toMe(user), 201);
  })

  .post("/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ username: z.string().trim().toLowerCase().max(24), password: z.string().max(200) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "wrong username or passphrase" }, 400);
    const over =
      (await limited(c.env.AUTH_LIMIT, `login-ip:${clientIp(c)}`)) ??
      (await limited(c.env.AUTH_LIMIT, `login-user:${parsed.data.username}`));
    if (over) return over;

    const db = c.get("db");
    const user = await db.select().from(users).where(eq(users.username, parsed.data.username)).get();
    const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok) return c.json({ error: "wrong username or passphrase" }, 401);

    const s = await createSession(db, user.id);
    setSessionCookie(c, s.token, s.expiresAt);
    return c.json(toMe(user));
  })

  .post("/logout", async (c) => {
    const token = readSessionCookie(c);
    if (token) await deleteSession(c.get("db"), token);
    clearSessionCookie(c);
    return c.json({ ok: true });
  })

  // always says the same thing, so it can't be used to check who has an account
  .post("/forgot", async (c) => {
    const over = await limited(c.env.AUTH_LIMIT, `forgot:${clientIp(c)}`);
    if (over) return over;
    const parsed = z.object({ username: z.string().trim().toLowerCase().max(24) }).safeParse(await c.req.json().catch(() => null));
    const reply = c.json({ ok: true, message: "if that account has an email on it, a reset link is on its way" });
    if (!parsed.success) return reply;

    const db = c.get("db");
    const user = await db.select().from(users).where(eq(users.username, parsed.data.username)).get();
    if (!user?.email) return reply;

    const token = randomToken();
    await db.delete(resetTokens).where(eq(resetTokens.userId, user.id)); // one live link at a time
    await db.insert(resetTokens).values({ tokenHash: await sha256Hex(token), userId: user.id, expiresAt: Date.now() + RESET_TTL });
    const link = `${c.env.APP_URL}/reset?token=${encodeURIComponent(token)}`;
    const mail = resetMail(user.username, link);
    c.executionCtx.waitUntil(sendMail(c.env, { to: user.email, ...mail }).catch((e) => console.error("reset mail failed", e)));
    return reply;
  })

  .post("/reset", async (c) => {
    const over = await limited(c.env.AUTH_LIMIT, `reset:${clientIp(c)}`);
    if (over) return over;
    const parsed = z.object({ token: z.string().min(10).max(200), password }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: firstError(parsed.error) }, 400);

    const db = c.get("db");
    const tokenHash = await sha256Hex(parsed.data.token);
    const row = await db
      .select()
      .from(resetTokens)
      .where(and(eq(resetTokens.tokenHash, tokenHash), gt(resetTokens.expiresAt, Date.now())))
      .get();
    if (!row) return c.json({ error: "that reset link is expired or already used" }, 400);

    const passwordHash = await hashPassword(parsed.data.password);
    await db.batch([
      db.update(users).set({ passwordHash }).where(eq(users.id, row.userId)),
      db.delete(resetTokens).where(eq(resetTokens.userId, row.userId)),
      db.delete(sessions).where(eq(sessions.userId, row.userId)), // log out everywhere
    ]);
    const user = (await db.select().from(users).where(eq(users.id, row.userId)).get())!;
    const s = await createSession(db, user.id);
    setSessionCookie(c, s.token, s.expiresAt);
    return c.json(toMe(user));
  });
