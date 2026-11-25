import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { ICON_COLORS, ICON_NAME_RE, PALETTE_NAMES, type Avatar } from "../../shared/types";
import { me, parseAvatar, requireUser, router, toMe } from "../app";
import { sessions, users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/hash";
import { sha256Hex, randomToken } from "../auth/tokens";
import { readSessionCookie } from "../auth/session";
import { CONTENT_TYPES, MAX_AVATAR_BYTES, sniffImage } from "../avatars";
import { availability, email, password } from "./auth";

const iconAvatar = z.object({
  kind: z.literal("icon"),
  icon: z.string().regex(ICON_NAME_RE),
  color: z.enum(ICON_COLORS, "pick one of the preset colours"),
});

export const meRoutes = router()
  .get("/", (c) => {
    const u = c.get("user");
    return c.json(u ? toMe(u) : null);
  })

  .use(requireUser)

  .patch("/", async (c) => {
    const parsed = z
      .object({ email, avatar: iconAvatar.optional(), palette: z.enum(PALETTE_NAMES).optional(), availability: availability.optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, 400);
    const user = me(c);
    const patch: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.email !== undefined) patch.email = parsed.data.email;
    if (parsed.data.palette) patch.palette = parsed.data.palette;
    if (parsed.data.availability !== undefined) patch.availability = parsed.data.availability;
    if (parsed.data.avatar) {
      // icon files are static assets; make sure the one asked for actually exists.
      // (a missing file still comes back 200 — the SPA fallback serves index.html —
      // so check it's really an svg, not just the status)
      const res = await c.env.ASSETS.fetch(new URL(`/icons/${parsed.data.avatar.icon}.svg`, c.req.url));
      const isSvg = res.ok && (res.headers.get("content-type") ?? "").includes("image/svg+xml");
      await res.body?.cancel();
      if (!isSvg) return c.json({ error: "no such icon" }, 400);
      await dropUpload(c.env, parseAvatar(user.avatar));
      patch.avatar = JSON.stringify(parsed.data.avatar satisfies Avatar);
    }
    if (!Object.keys(patch).length) return c.json(toMe(user));
    await c.get("db").update(users).set(patch).where(eq(users.id, user.id));
    return c.json(toMe({ ...user, ...patch }));
  })

  .put("/avatar", async (c) => {
    const user = me(c);
    // read the body before answering, even when it's too big — replying mid-upload
    // makes some clients (and the local dev proxy) error out instead of showing the 413.
    // cloudflare caps request bodies at 100 MB, so this can't be abused much.
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.byteLength > MAX_AVATAR_BYTES) return c.json({ error: "image too big (2 MB max)" }, 413);
    const kind = sniffImage(bytes);
    if (!kind) return c.json({ error: "that's not a png, jpeg or webp" }, 415);

    const key = `${user.id}-${randomToken(9)}.${kind}`;
    await c.env.AVATARS.put(key, bytes, { httpMetadata: { contentType: CONTENT_TYPES[kind] } });
    await dropUpload(c.env, parseAvatar(user.avatar));
    const avatar: Avatar = { kind: "upload", key };
    await c.get("db").update(users).set({ avatar: JSON.stringify(avatar) }).where(eq(users.id, user.id));
    return c.json(toMe({ ...user, avatar: JSON.stringify(avatar) }));
  })

  .post("/password", async (c) => {
    const parsed = z.object({ current: z.string().max(200), next: password }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, 400);
    const user = me(c);
    if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
      return c.json({ error: "current passphrase's wrong" }, 401);
    }
    const db = c.get("db");
    await db.update(users).set({ passwordHash: await hashPassword(parsed.data.next) }).where(eq(users.id, user.id));
    // log out every other device, keep this one
    const token = readSessionCookie(c);
    if (token) {
      await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, await sha256Hex(token))));
    }
    return c.json({ ok: true });
  });

async function dropUpload(env: Env, old: Avatar) {
  if (old.kind === "upload") await env.AVATARS.delete(old.key).catch(() => {});
}
