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

  if (compact) {
    return (
      <p title={title} className="text-center font-display text-base font-bold tracking-tight">
        <span className="hype-text">{date.replace(/ \d{4}$/, "")}</span>
        <span aria-hidden="true" className="mx-2 text-line">‖</span>
        <span className="hype-text-rev">{c.short}</span>
      </p>
    );
  }
  return (
    <p title={title} className="flex items-center gap-3 whitespace-nowrap font-display text-lg font-bold tracking-tight lg:text-2xl">
      <span className="hype-text">{date}</span>
      <span aria-hidden="true" className="font-normal text-line">‖</span>
      <span className="hype-text-rev">{c.text}</span>
    </p>
  );
}
