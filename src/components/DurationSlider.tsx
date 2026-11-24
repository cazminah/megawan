import { useRef } from "react";
import { DURATIONS, type Duration } from "../../shared/types";

const LAST = DURATIONS.length - 1;
const pct = (i: number) => (i / LAST) * 100;

/**
 * two handles on five notches. they start stacked (a single value):
 * - click/tap a notch: a single value jumps there; a range moves its nearest end
 * - drag a handle: if the handles are stacked, the one you drag peels off in the
 *   direction you drag and you've got a range; otherwise it moves that end
 * each handle is its own keyboard slider (arrow keys), and they can't cross.
 */
export function DurationSlider({ value, onChange, accent }: { value: Duration; onChange: (d: Duration) => void; accent: string }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ end: "min" | "max" | "both" | null; start: number; moved: boolean } | null>(null);

  const indexAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * LAST);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const i = indexAt(e.clientX);
    const onHandle = (e.target as HTMLElement).dataset.end as "min" | "max" | undefined;
    const stacked = value.min === value.max;
    // stacked + grabbed the handle → we only know which end once they move.
    // stacked + grabbed elsewhere → move the single value. range → nearest end.
    const end = stacked
      ? i === value.min ? null : "both"
      : onHandle ?? (Math.abs(i - value.min) <= Math.abs(i - value.max) ? "min" : "max");
    drag.current = { end, start: i, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const i = indexAt(e.clientX);
    if (i === d.start && !d.moved) return;
    d.moved = true;
    if (!d.end) d.end = i < value.min ? "min" : "max"; // peel off the stack
    if (d.end === "both") onChange({ min: i, max: i });
    else if (d.end === "min") onChange({ min: Math.min(i, value.max), max: value.max });
    else onChange({ min: value.min, max: Math.max(i, value.min) });
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // a plain click on a notch
    const i = d.start;
    if (value.min === value.max || d.end === "both") onChange({ min: i, max: i });
    else if (d.end === "min") onChange({ min: Math.min(i, value.max), max: value.max });
    else onChange({ min: value.min, max: Math.max(i, value.min) });
  };

  const key = (end: "min" | "max") => (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    if (end === "min") onChange({ min: Math.min(value.max, Math.max(0, value.min + step)), max: value.max });
    else onChange({ min: value.min, max: Math.max(value.min, Math.min(LAST, value.max + step)) });
  };

  const handle = (end: "min" | "max") => {
    const i = value[end];
    return (
      <span
        role="slider"
        tabIndex={0}
        data-end={end}
        aria-label={end === "min" ? "shortest" : "longest"}
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={i}
        aria-valuetext={DURATIONS[i]}
        onKeyDown={key(end)}
        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-bg shadow-[0_0_0_2px_currentColor] active:cursor-grabbing"
        style={{ left: `${pct(i)}%`, background: accent, color: accent }}
      />
    );
  };

  return (
    <div className="select-none px-2.5">
      <div
        ref={track}
        className="relative h-8 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(value.min)}%`, width: `${pct(value.max) - pct(value.min)}%`, background: accent }}
        />
        {DURATIONS.map((_, i) => (
          <span key={i} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line" style={{ left: `${pct(i)}%` }} />
        ))}
        {handle("min")}
        {handle("max")}
      </div>
      <div className="relative h-4 text-[11px] text-faint">
        {DURATIONS.map((d, i) => (
          <span
            key={d}
            className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-[-25%] last:translate-x-[-75%]"
            style={{ left: `${pct(i)}%`, color: i >= value.min && i <= value.max ? "var(--color-ink)" : undefined }}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
