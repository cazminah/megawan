import { INTEREST_LEVELS, LEVELS, type InterestLevel } from "../../shared/types";
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
}: {
  value: InterestLevel | null;
  onChange: (l: InterestLevel) => void;
  onClear?: () => void;
  busy?: boolean;
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
