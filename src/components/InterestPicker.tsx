import { INTEREST_LEVELS, LEVELS, durationLabel, type Duration, type InterestLevel } from "../../shared/types";
import { DurationSlider } from "./DurationSlider";
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
                  borderColor: on ? lv.color : `${lv.color}88`,
                  background: on ? lv.color : "var(--color-bg)",
                  boxShadow: on ? `0 0 ${l === 5 ? 22 : 12}px ${lv.color}aa` : "none",
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

/** optional "how long are you up for?" — faded until you switch it on */
function DurationSection({
  level,
  duration,
  onDuration,
}: {
  level: InterestLevel | null;
  duration: Duration | null;
  onDuration: (d: Duration | null) => void;
}) {
  const accent = level ? INTEREST_LEVELS[level].color : "var(--color-dim)";
  if (!duration) {
    return (
      <button
        type="button"
        disabled={!level}
        onClick={() => onDuration({ min: 1, max: 1 })}
        className="mt-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-sm text-faint opacity-70 transition hover:opacity-100 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        <TierIcon name="timer" color="currentColor" size={18} />
        <span className="flex-1">how long are you up for? <span className="text-xs">(optional)</span></span>
        <span aria-hidden="true" className="text-lg leading-none">＋</span>
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-line bg-bg/60 px-2 pb-2 pt-2.5">
      <div className="mb-1 flex items-center justify-between px-1 text-sm">
        <span>
          <span className="text-faint">up for </span>
          <span className="font-semibold">{durationLabel(duration)}</span>
        </span>
        <button
          type="button"
          onClick={() => onDuration(null)}
          aria-label="clear how long you're up for"
          className="rounded-md px-1.5 text-faint hover:bg-panel-2 hover:text-ink"
        >
          ✕
        </button>
      </div>
      <DurationSlider value={duration} onChange={onDuration} accent={accent} />
      <p className="mt-1 px-1 text-[11px] text-faint">drag the ends apart for a range</p>
    </div>
  );
}
