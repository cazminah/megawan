// the event runs on UK time, whoever's looking. these helpers convert between
// "7 Dec, 09:00 in London" and a UTC timestamp (handling GMT/BST), and turn
// "time until it starts" into the header countdown text.

export const EVENT_TZ = "Europe/London";

const parts = (ms: number) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(f.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
};

/** "2026-12-07" + "09:00" (london wall time) → utc ms */
export function londonToUtc(date: string, time: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const [y, mo, d, h, mi] = [dm[1], dm[2], dm[3], tm[1], tm[2]].map(Number) as [number, number, number, number, number];
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // guess it's utc, see what london makes of that, and correct by the difference
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = parts(guess);
    guess += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  }
  return guess;
}

/** utc ms → { date: "2026-12-07", time: "09:00" } in london (for the admin form) */
export function utcToLondon(ms: number) {
  const p = parts(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}` };
}

/** "Mon 7 Dec 2026" */
export const eventDateLabel = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .format(new Date(ms)).replace(",", "");

/** "9:00" style start time, uk */
export const eventTimeLabel = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ms));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export type CountdownState =
  | { phase: "before"; text: string; short: string }
  | { phase: "on"; text: string; short: string }
  | { phase: "over" };

/**
 * before: "in 12 days 4 hrs" (short "12d 4h"), last day "in 4 hrs 20 mins", last hour "in 20 mins"
 * on:     from the start time until midnight (uk) that day — "it's on!"
 * over:   after that day — the header hides it
 */
export function countdown(startsAt: number, now: number): CountdownState {
  if (now < startsAt) {
    const mins = Math.ceil((startsAt - now) / 60_000);
    const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    if (d > 0) return { phase: "before", text: `in ${plural(d, "day")} ${plural(h, "hr")}`, short: `${d}d ${h}h` };
    if (h > 0) return { phase: "before", text: `in ${plural(h, "hr")} ${plural(m, "min")}`, short: `${h}h ${m}m` };
    return { phase: "before", text: `in ${plural(m, "min")}`, short: `${m}m` };
  }
  const start = utcToLondon(startsAt).date, today = utcToLondon(now).date;
  if (today === start) return { phase: "on", text: "it's on!", short: "it's on!" };
  return { phase: "over" };
}
