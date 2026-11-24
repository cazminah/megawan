import { AVATAR_BG, INTEREST_LEVELS, type Avatar as AvatarT, type InterestLevel, type PublicUser } from "../../shared/types";

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

/** overlapping row of avatars, keenest first */
export function AvatarStack({
  people,
  max = 6,
  size = 30,
}: {
  people: { user: PublicUser; level: InterestLevel }[];
  max?: number;
  size?: number;
}) {
  const sorted = [...people].sort((a, b) => b.level - a.level || a.user.username.localeCompare(b.user.username));
  const shown = sorted.slice(0, max);
  const extra = sorted.length - shown.length;
  return (
    <div className="flex items-center pl-1">
      {shown.map(({ user, level }) => (
        <Avatar
          key={user.id}
          avatar={user.avatar}
          level={level}
          size={size}
          title={`${user.username} — ${INTEREST_LEVELS[level].label}`}
          className="-ml-1.5 border-2 border-panel"
        />
      ))}
      {extra > 0 && (
        <span
          className="-ml-1.5 grid place-items-center rounded-full border-2 border-panel bg-panel-2 text-xs font-semibold text-dim"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
