import { countdown, eventDateLabel, eventTimeLabel } from "../../shared/time";
import { useEventStart, useNow } from "../lib/event";

/**
 * "Mon 7 Dec 2026 | in 12 days 4 hrs" in the header. `compact` is the phone
 * version: "7 Dec · 12d 4h". nothing shows when there's no date, or once the
 * day is over.
 */
export function Countdown({ compact = false }: { compact?: boolean }) {
  const startsAt = useEventStart(true);
  const now = useNow();
  if (!startsAt) return null;
  const c = countdown(startsAt, now);
  if (c.phase === "over") return null;
  const date = eventDateLabel(startsAt);
  const title = `megaWAN: ${date}, ${eventTimeLabel(startsAt)} (UK time)`;
  const on = c.phase === "on";

  if (compact) {
    return (
      <p title={title} className="text-center text-xs text-dim">
        {date.replace(/^\w+ /, "").replace(/ \d{4}$/, "")} ·{" "}
        <span className={on ? "hype-text font-bold" : "font-semibold text-ink"}>{c.short}</span>
      </p>
    );
  }
  return (
    <p title={title} className="flex items-center gap-3 whitespace-nowrap text-sm text-dim">
      <span className="font-medium text-ink">{date}</span>
      <span aria-hidden="true" className="text-line">‖</span>
      {on ? <span className="hype-text font-display text-base font-bold">{c.text}</span> : <span>{c.text}</span>}
    </p>
  );
}
