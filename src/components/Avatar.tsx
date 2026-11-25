import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AVATAR_BG, INTEREST_LEVELS, availabilityText, durationLabel, type Avatar as AvatarT, type Duration, type InterestLevel, type PublicUser } from "../../shared/types";
import { TierIcon } from "./TierIcon";
import { AvailabilityIcons } from "./Availability";

interface Props {
  avatar: AvatarT;
  size?: number;
  level?: InterestLevel; // draws a ring in that interest's colour
  title?: string;
  className?: string;
}

export function Avatar({ avatar, size = 40, level, title, className = "" }: Props) {
  const ring = level ? INTEREST_LEVELS[level].color : null;
  const ringPx = size >= 48 ? 3 : 2;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: AVATAR_BG,
    boxShadow: ring ? `0 0 0 ${ringPx}px ${ring}` : "inset 0 0 0 1px #263166",
  };
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={style}
    >
      {avatar.kind === "upload" ? (
        <img src={`/avatars/${avatar.key}`} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          className="icon-mask block"
          style={{
            width: "70%",
            height: "70%",
            backgroundColor: avatar.color,
            maskImage: `url(/icons/${avatar.icon}.svg)`,
            WebkitMaskImage: `url(/icons/${avatar.icon}.svg)`,
          }}
        />
      )}
    </span>
  );
}

export interface StackPerson {
  user: PublicUser;
  level: InterestLevel;
  duration?: Duration | null;
}

/** small floating card (in a portal, so card edges can't clip it) above `anchor` */
function HoverCard({ anchor, children }: { anchor: DOMRect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - r.width / 2), window.innerWidth - r.width - 8);
    const top = anchor.top - r.height - 8 >= 8 ? anchor.top - r.height - 8 : anchor.bottom + 8;
    setPos({ left, top });
  }, [anchor]);
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[calc(100vw-1rem)] whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11px] leading-tight shadow-2xl"
      style={pos ?? { left: -9999, top: 0, visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}

function PersonLine({ p }: { p: StackPerson }) {
  const lv = INTEREST_LEVELS[p.level];
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <AvailabilityIcons mask={p.user.availability} size={12} />
      <span className="font-semibold text-ink">{p.user.username}</span>
      <TierIcon name={lv.icon} color={lv.color} size={12} />
      <span style={{ color: lv.text }}>{lv.label}</span>
      {p.duration && <span className="text-faint">· {durationLabel(p.duration)}</span>}
    </span>
  );
}

/** overlapping row of avatars, keenest first. hover one for who + how keen + how long */
export function AvatarStack({ people, max = 6, size = 30 }: { people: StackPerson[]; max?: number; size?: number }) {
  const sorted = [...people].sort((a, b) => b.level - a.level || a.user.username.localeCompare(b.user.username));
  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max);
  const [hover, setHover] = useState<{ key: string; rect: DOMRect } | null>(null);
  const on = (key: string) => (e: React.MouseEvent<HTMLElement>) => setHover({ key, rect: e.currentTarget.getBoundingClientRect() });
  const off = () => setHover(null);
  // a scroll moves the avatar out from under the card — just hide it
  useEffect(() => {
    if (!hover) return;
    window.addEventListener("scroll", off, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", off, { capture: true });
  }, [hover]);

  return (
    <div className="flex items-center pl-1">
      {shown.map((p) => (
        <span
          key={p.user.id}
          onMouseEnter={on(p.user.id)}
          onMouseLeave={off}
          aria-label={`${p.user.username} (around ${availabilityText(p.user.availability)}) — ${INTEREST_LEVELS[p.level].label}${p.duration ? `, up for ${durationLabel(p.duration)}` : ""}`}
          role="img"
          className="-ml-1.5 inline-grid"
        >
          <Avatar avatar={p.user.avatar} level={p.level} size={size} className="border-2 border-panel" />
          {hover?.key === p.user.id && <HoverCard anchor={hover.rect}><PersonLine p={p} /></HoverCard>}
        </span>
      ))}
      {rest.length > 0 && (
        <span
          onMouseEnter={on("rest")}
          onMouseLeave={off}
          aria-label={rest.map((p) => p.user.username).join(", ")}
          className="-ml-1.5 grid place-items-center rounded-full border-2 border-panel bg-panel-2 text-xs font-semibold text-dim"
          style={{ width: size, height: size }}
        >
          +{rest.length}
          {hover?.key === "rest" && (
            <HoverCard anchor={hover.rect}>
              <span className="flex flex-col gap-1">{rest.map((p) => <PersonLine key={p.user.id} p={p} />)}</span>
            </HoverCard>
          )}
        </span>
      )}
    </div>
  );
}
