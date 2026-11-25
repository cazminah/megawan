import { AVAILABILITY, availabilityText } from "../../shared/types";
import { TierIcon } from "./TierIcon";

const LIT = "var(--color-ink)";
const DIM = "var(--color-line)";

/** three tiny icons (sunrise · sun · moon), lit where they're around */
export function AvailabilityIcons({ mask, size = 16, className = "" }: { mask: number; size?: number; className?: string }) {
  const text = availabilityText(mask);
  return (
    <span role="img" aria-label={`around ${text}`} title={`around ${text}`} className={`inline-flex shrink-0 items-center gap-0.5 ${className}`}>
      {AVAILABILITY.map((a) => (
        <TierIcon key={a.bit} name={a.icon} color={mask & a.bit ? LIT : DIM} size={size} />
      ))}
    </span>
  );
}

/**
 * three independent toggles — any combination, but never none (the last one
 * on can't be switched off).
 */
export function AvailabilityPicker({ value, onChange }: { value: number; onChange: (mask: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="when are you around?" className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line">
        {AVAILABILITY.map((a) => {
          const on = !!(value & a.bit);
          const last = on && (value & ~a.bit) === 0;
          return (
            <button
              key={a.bit}
              type="button"
              aria-pressed={on}
              aria-disabled={last}
              title={last ? "pick at least one" : undefined}
              onClick={() => !last && onChange(value ^ a.bit)}
              className={`flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold transition ${
                on ? "bg-keen/20 text-ink" : "text-faint hover:text-ink"
              } ${last ? "cursor-not-allowed" : ""}`}
            >
              <TierIcon name={a.icon} color={on ? LIT : "currentColor"} size={20} />
              {a.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-faint">
        around <span className="font-semibold text-dim">{availabilityText(value)}</span> · tap to toggle, at least one
      </p>
    </div>
  );
}
