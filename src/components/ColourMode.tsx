import { INTEREST_LEVELS, LEVELS, type PaletteName } from "../../shared/types";
import { applyPalette, usePalette } from "../lib/palette";
import { TierIcon } from "./TierIcon";

/**
 * "colour-blind friendly colours" switch with a live preview of the five tiers.
 * `onChange` lets the profile page also save it to the account.
 */
export function ColourModeToggle({ onChange, compact }: { onChange?: (p: PaletteName) => void; compact?: boolean }) {
  const palette = usePalette();
  const on = palette === "colorblind";
  const flip = () => {
    const next: PaletteName = on ? "default" : "colorblind";
    applyPalette(next);
    onChange?.(next);
  };
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={flip}
        className="flex w-full items-center justify-between gap-3 text-left text-sm"
      >
        <span>
          <span className="font-medium text-ink">colour-blind friendly colours</span>
          {!compact && <span className="block text-xs text-faint">a blue → yellow scale that stays clear with red–green colour blindness</span>}
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-keen" : "bg-line"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>
      <div className="flex items-center justify-between rounded-xl border border-line bg-bg/60 px-3 py-2" aria-hidden="true">
        {LEVELS.map((l) => (
          <span key={l} className="flex flex-col items-center gap-1">
            <span className="grid h-8 w-8 place-items-center rounded-full border-2" style={{ borderColor: INTEREST_LEVELS[l].color }}>
              <TierIcon name={INTEREST_LEVELS[l].icon} color={INTEREST_LEVELS[l].color} size={16} />
            </span>
            {!compact && <span className="text-[10px] font-semibold" style={{ color: INTEREST_LEVELS[l].text }}>{INTEREST_LEVELS[l].label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
