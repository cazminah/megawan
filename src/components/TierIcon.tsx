import { PATHS, type IconName } from "../lib/iconPaths";

export type { IconName };

export function TierIcon({ name, color, size = 20, className = "" }: { name: IconName; color: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 -960 960 960" width={size} height={size} aria-hidden="true" className={className}>
      <path d={PATHS[name]} fill={color} />
    </svg>
  );
}
