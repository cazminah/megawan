import { INTEREST_LEVELS, type InterestLevel } from "../../shared/types";

const ORDER: InterestLevel[] = [1, 2, 3]; // left → right, meh → perish

/**
 * a three-notch slider. it's really a radio group (arrow keys work), drawn as a
 * gradient track so it reads as "how much".
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
  const current = value ? INTEREST_LEVELS[value] : null;
  return (
    <div className={busy ? "pointer-events-none opacity-60" : ""}>
      <div
        role="radiogroup"
        aria-label="how keen are you?"
        className="relative flex items-center justify-between px-2 py-3"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = value ? ORDER.indexOf(value) : -1;
          const next = ORDER[Math.min(2, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)))]!;
          onChange(next);
        }}
      >
        <div className="hype-gradient absolute inset-x-4 top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-40" />
        {value && (
          <div
            className="hype-gradient absolute left-4 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all"
            style={{ width: `calc((100% - 2rem) * ${ORDER.indexOf(value) / 2})` }}
          />
        )}
        {ORDER.map((l) => {
          const lv = INTEREST_LEVELS[l];
          const on = value === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={lv.label}
              tabIndex={on || (!value && l === 2) ? 0 : -1}
              onClick={() => onChange(l)}
              className="relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 transition-transform hover:scale-110"
              style={{
                borderColor: lv.color,
                background: on ? lv.color : "var(--color-panel)",
                boxShadow: on ? `0 0 16px ${lv.color}` : "none",
                transform: on ? "scale(1.15)" : undefined,
              }}
            >
              <span className="sr-only">{lv.label}</span>
              {on && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between px-0.5 text-[11px] leading-tight text-faint">
        {ORDER.map((l) => (
          <span key={l} className="w-1/3 text-center first:text-left last:text-right" style={value === l ? { color: INTEREST_LEVELS[l].color } : undefined}>
            {INTEREST_LEVELS[l].label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex min-h-6 items-center justify-between text-sm">
        <span className="font-display font-semibold" style={{ color: current?.color ?? "var(--color-dim)" }}>
          {current ? current.label : "how keen are you?"}
        </span>
        {value && onClear && (
          <button type="button" onClick={onClear} className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline">
            nah, remove me
          </button>
        )}
      </div>
    </div>
  );
}
