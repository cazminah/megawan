// the event start time, shared between the header countdown and the admin form
// (so saving a new date updates the header straight away), plus a clock that
// ticks once a minute.

import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api";

let startsAt: number | null | undefined; // undefined = not loaded yet
const listeners = new Set<() => void>();

export function setEventStart(v: number | null) {
  startsAt = v;
  listeners.forEach((l) => l());
}

export function useEventStart(enabled: boolean) {
  const value = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => startsAt,
  );
  useEffect(() => {
    if (enabled && startsAt === undefined) api.event().then((r) => setEventStart(r.startsAt)).catch(() => setEventStart(null));
  }, [enabled]);
  return value ?? null;
}

/** Date.now(), refreshed every `ms` (and when the tab comes back into view) */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [ms]);
  return now;
}
