import { DURATIONS, INTEREST_LEVELS, LEVELS, alpha, durationLabel, type Duration, type InterestLevel } from "../../shared/types";
import { TierIcon } from "./TierIcon";

const TRACK = `linear-gradient(90deg, ${LEVELS.map((l) => INTEREST_LEVELS[l].color).join(", ")})`;

/**
 * the one interest picker: five notches on a dim → bright track, an icon and a
 * word or two each. it's a radio group underneath (arrow keys work).
 */
export function InterestPicker({
  value,
  onChange,
  onClear,
  busy,
  duration,
  onDuration,
}: {
  value: InterestLevel | null;
  onChange: (l: InterestLevel) => void;
  onClear?: () => void;
  busy?: boolean;
  duration?: Duration | null;
  onDuration?: (d: Duration | null) => void; // leave out to hide the duration bit
}) {
  const idx = value ? LEVELS.indexOf(value) : -1;
  return (
    <div className={busy ? "pointer-events-none opacity-60" : ""}>
      <div
        role="radiogroup"
        aria-label="how keen are you?"
        className="relative grid grid-cols-5"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const next = LEVELS[Math.min(4, Math.max(0, (idx < 0 ? 1 : idx) + (e.key === "ArrowRight" ? 1 : -1)))]!;
          onChange(next);
          (e.currentTarget.querySelectorAll("button")[LEVELS.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
        }}
      >
        {/* track: faint all the way, solid up to the chosen notch */}
        <div className="absolute inset-x-[10%] top-[19px] h-1 rounded-full opacity-25" style={{ background: TRACK }} />
        {idx > 0 && (
          <div className="absolute left-[10%] top-[19px] h-1 overflow-hidden rounded-full" style={{ width: `${idx * 20}%` }}>
            <div className="h-full" style={{ background: TRACK, width: `${(4 / idx) * 100}%` }} />
          </div>
        )}
        {LEVELS.map((l) => {
          const lv = INTEREST_LEVELS[l];
          const on = value === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={lv.label}
              tabIndex={on || (!value && l === 3) ? 0 : -1}
              onClick={() => onChange(l)}
              className="group relative z-10 flex flex-col items-center gap-1.5 outline-none"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full border-2 transition group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-white/60"
                style={{
                  borderColor: on ? lv.color : alpha(lv.color, 55),
                  background: on ? lv.color : "var(--color-bg)",
                  boxShadow: on ? `0 0 ${l === 5 ? 22 : 12}px ${alpha(lv.color, 65)}` : "none",
                  transform: on ? "scale(1.12)" : undefined,
                }}
              >
                <TierIcon name={lv.icon} color={on ? "#0b1020" : lv.color} size={22} />
              </span>
              <span
                className="text-center text-[11px] font-semibold leading-tight"
                style={{ color: on ? lv.text : "var(--color-faint)" }}
              >
                {lv.label}
              </span>
            </button>
          );
        })}
      </div>
      {onDuration && <DurationSection level={value} duration={duration ?? null} onDuration={onDuration} />}
      {value && onClear && (
        <div className="mt-2 text-right">
          <button type="button" onClick={onClear} className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline">
            nah, remove me
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * optional "how long are you up for?": three segments (a bit · few hours · all day).
 * faded until you tap one. tap one = that; with one picked, tap another = the
 * range between them; tap again = start over from that one. ✕ clears it.
 */
function DurationSection({
  level,
  duration,
  onDuration,
}: {
  level: InterestLevel | null;
  duration: Duration | null;
  onDuration: (d: Duration | null) => void;
}) {
  const accent = level ? INTEREST_LEVELS[level].color : "#6670a8";
  const on = (i: number) => !!duration && i >= duration.min && i <= duration.max;
  const tap = (i: number) => {
    if (duration && duration.min === duration.max && i !== duration.min) {
      onDuration({ min: Math.min(i, duration.min), max: Math.max(i, duration.max) });
    } else {
      onDuration({ min: i, max: i });
    }
  };
  return (
    <div className={`mt-4 transition ${!level ? "pointer-events-none opacity-30" : duration ? "" : "opacity-50 hover:opacity-90"}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-faint">
          {duration ? (
            <>up for <span className="font-semibold text-ink">{durationLabel(duration)}</span></>
          ) : (
            <>how long are you up for? <span className="opacity-70">(optional)</span></>
          )}
        </span>
        {duration && (
          <button type="button" onClick={() => onDuration(null)} aria-label="clear how long you're up for" className="rounded-md px-1.5 text-faint hover:bg-panel-2 hover:text-ink">
            ✕
          </button>
        )}
      </div>
      <div role="group" aria-label="how long are you up for?" className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line">
        {DURATIONS.map((d, i) => (
          <button
            key={d.label}
            type="button"
            aria-pressed={on(i)}
            onClick={() => tap(i)}
            className="flex items-center justify-center gap-1.5 px-1.5 py-2 text-xs font-semibold transition"
            style={{ background: on(i) ? alpha(accent, 18) : undefined, color: on(i) ? "var(--color-ink)" : "var(--color-faint)" }}
          >
            <TierIcon name={d.icon} color={on(i) ? accent : "currentColor"} size={18} />
            <span className="whitespace-nowrap">
              {d.label}
              {d.hint && <span className="ml-1 font-normal opacity-70">{d.hint}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
