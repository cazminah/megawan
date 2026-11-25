// the event's start time (utc ms), for the header countdown. stored in the
// kv table — no schema of its own. admins set it from /admin.

import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { kv } from "../db/schema";
import { requireUser, router } from "../app";

export const EVENT_KEY = "event_starts_at";

export async function getEventStart(db: Db) {
  const row = await db.select().from(kv).where(eq(kv.key, EVENT_KEY)).get();
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function setEventStart(db: Db, startsAt: number | null) {
  if (startsAt === null) {
    await db.delete(kv).where(eq(kv.key, EVENT_KEY));
    return;
  }
  const value = String(startsAt);
  await db.insert(kv).values({ key: EVENT_KEY, value }).onConflictDoUpdate({ target: kv.key, set: { value } });
}

export const eventRoutes = router()
  .use(requireUser)
  .get("/", async (c) => c.json({ startsAt: await getEventStart(c.get("db")) }));
