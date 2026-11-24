import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { INTEREST_LEVELS, LEVELS, type ArcadeGame, type Duration, type InterestLevel, type PublicUser } from "../../shared/types";
import type { InterestPatch, SetInterest } from "../lib/arcade";
import { players } from "../lib/format";
import { AvatarStack } from "./Avatar";
import { InterestPicker } from "./InterestPicker";
import { TierIcon } from "./TierIcon";
import { Chip, Cover } from "./ui";

export interface ViewProps {
  games: ArcadeGame[];
  users: Record<string, PublicUser>;
  myId: string;
  onSet: SetInterest;
  onOpen: (g: ArcadeGame) => void;
}

const peopleOf = (g: ArcadeGame, users: Record<string, PublicUser>) =>
  g.interests.flatMap((i) => (users[i.userId] ? [{ user: users[i.userId]!, level: i.level }] : []));

/** the little "+" / your-level button that pops THE picker */
function RateButton({ game, myId, onSet }: { game: ArcadeGame; myId: string; onSet: SetInterest }) {
  const vote = game.interests.find((i) => i.userId === myId);
  const mine = vote?.level ?? null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // the duration slider updates this draft live and saves after a short pause,
  // so dragging across five notches is one request, not five
  const [draft, setDraft] = useState<Duration | null | undefined>(undefined);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const duration = draft === undefined ? (vote?.duration ?? null) : draft;

  // the popover lives in a portal on <body> (cards clip + transform their children),
  // so place it by hand: above the button if it fits, else below, kept on screen
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return setPos(null);
    const b = btn.current.getBoundingClientRect();
    const p = pop.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, b.right - p.width), window.innerWidth - p.width - 8);
    const top = b.top - p.height - 8 >= 8 ? b.top - p.height - 8 : Math.max(8, Math.min(b.bottom + 8, window.innerHeight - p.height - 8));
    setPos({ left, top });
  }, [open, mine, duration !== null]);

  const save = (patch: InterestPatch) => {
    setError(null);
    return onSet(game.igdbId, patch).catch((e: Error) => setError(e.message));
  };

  const flush = () => {
    if (!pending.current) return;
    clearTimeout(pending.current);
    pending.current = null;
    if (mine && draft !== undefined) void save({ level: mine, duration: draft });
  };

  const close = () => {
    flush();
    setOpen(false);
    setDraft(undefined);
  };

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && (close(), btn.current?.focus());
    const away = () => close();
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", away, { passive: true });
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", away);
      window.removeEventListener("resize", away);
    };
  });

  const setLevel = async (l: InterestLevel | null) => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    setBusy(true);
    try {
      await save(l ? { level: l, ...(draft !== undefined ? { duration: draft } : {}) } : { level: null });
      if (!l) close();
    } finally { setBusy(false); }
  };

  const setDuration = (d: Duration | null) => {
    setDraft(d);
    if (!mine) return;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      void save({ level: mine, duration: d });
    }, 450);
  };

  const color = mine ? INTEREST_LEVELS[mine].color : undefined;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={btn}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={mine ? `your interest: ${INTEREST_LEVELS[mine].label} — change` : "say how keen you are"}
        className="grid h-9 w-9 place-items-center rounded-full border-2 text-lg font-bold transition hover:scale-110"
        style={{ borderColor: color ?? "var(--color-line)", background: color ? `${color}26` : "var(--color-panel-2)", color: "var(--color-dim)" }}
      >
        {mine ? <TierIcon name={INTEREST_LEVELS[mine].icon} color={color!} size={20} /> : "+"}
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label={`how keen are you on ${game.name}?`}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-panel p-4 shadow-2xl"
            style={pos ?? { left: -9999, top: 0, visibility: "hidden" }}
          >
            <p className="mb-3 truncate font-display text-sm font-semibold">{game.name}</p>
            <InterestPicker
              value={mine}
              onChange={setLevel}
              onClear={() => setLevel(null)}
              busy={busy}
              duration={duration}
              onDuration={setDuration}
            />
            {error && <p role="alert" className="mt-2 text-xs text-perish">{error}</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function GameGrid({ games, users, myId, onSet, onOpen }: ViewProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((g) => {
        const top = g.interests.reduce<InterestLevel>((m, i) => (i.level > m ? i.level : m), 1);
        const pl = players(g);
        return (
          <li key={g.igdbId}>
            <article
              onClick={() => onOpen(g)}
              className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-keen/60"
              style={{ boxShadow: `0 10px 30px -18px ${INTEREST_LEVELS[top].color}` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <Cover imageId={g.coverImageId} name={g.name} className="h-full w-full transition group-hover:scale-[1.03]" />
                {pl && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                    👥 {pl}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div>
                  <h3 className="line-clamp-2 font-display font-bold leading-tight">
                    <button className="text-left" onClick={(e) => { e.stopPropagation(); onOpen(g); }}>{g.name}</button>
                  </h3>
                  <p className="mt-0.5 text-xs text-faint">
                    {g.releaseYear}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.platforms.slice(0, 3).map((p) => <Chip key={p}>{p}</Chip>)}
                  {g.platforms.length > 3 && <Chip>+{g.platforms.length - 3}</Chip>}
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
                  <AvatarStack people={peopleOf(g, users)} max={4} size={28} />
                  <RateButton game={g} myId={myId} onSet={onSet} />
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export function GameTable({ games, users, myId, onSet, onOpen }: ViewProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-faint">
          <tr>
            <th className="px-3 py-3 font-medium">game</th>
            <th className="px-3 py-3 font-medium">year</th>
            <th className="px-3 py-3 font-medium">platforms</th>
            <th className="px-3 py-3 font-medium">players</th>
            <th className="px-3 py-3 font-medium">genres</th>
            <th className="px-3 py-3 font-medium">who's in</th>
            <th className="px-3 py-3"><span className="sr-only">your interest</span></th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.igdbId} onClick={() => onOpen(g)} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-panel-2/60">
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <Cover imageId={g.coverImageId} name="" className="h-12 w-9 shrink-0 rounded-md" />
                  <button className="text-left font-display font-semibold leading-tight" onClick={(e) => { e.stopPropagation(); onOpen(g); }}>
                    {g.name}
                  </button>
                </div>
              </td>
              <td className="px-3 py-2 text-dim">{g.releaseYear ?? "—"}</td>
              <td className="max-w-48 px-3 py-2 text-dim">{g.platforms.join(", ") || "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-dim">{players(g) ?? "solo"}</td>
              <td className="max-w-40 px-3 py-2 text-dim">{g.genres.slice(0, 3).join(", ") || "—"}</td>
              <td className="px-3 py-2"><AvatarStack people={peopleOf(g, users)} max={6} size={26} /></td>
              <td className="px-3 py-2"><RateButton game={g} myId={myId} onSet={onSet} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GameDetail({ game, users, myId, onSet }: { game: ArcadeGame } & Omit<ViewProps, "games" | "onOpen">) {
  const mine = game.interests.find((i) => i.userId === myId)?.level ?? null;
  const [busy, setBusy] = useState(false);
  const set = async (l: InterestLevel | null) => { setBusy(true); try { await onSet(game.igdbId, { level: l }); } finally { setBusy(false); } };
  const levels = [...LEVELS].reverse();

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <Cover imageId={game.coverImageId} name={game.name} className="aspect-[3/4] w-28 shrink-0 self-start rounded-xl sm:w-36" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-faint">{[game.releaseYear, game.genres.join(", ")].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-1">{game.platforms.map((p) => <Chip key={p}>{p}</Chip>)}</div>
          <p className="pt-1 text-sm"><span className="text-faint">players</span> <span className="font-medium">{players(game) ?? "solo"}</span></p>
          {game.igdbUrl && (
            <a href={game.igdbUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-faint underline-offset-2 hover:text-ink hover:underline">
              more on IGDB ↗
            </a>
          )}
        </div>
      </div>

      {game.summary && <p className="line-clamp-5 text-sm leading-relaxed text-dim">{game.summary}</p>}

      <div className="rounded-2xl border border-line bg-bg/60 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">you</p>
        <InterestPicker value={mine} onChange={set} onClear={() => set(null)} busy={busy} />
      </div>

      <div className="space-y-3">
        {levels.map((l) => {
          const people = game.interests.filter((i) => i.level === l && users[i.userId]);
          if (!people.length) return null;
          return (
            <div key={l}>
              <p className="mb-1.5 text-sm font-semibold" style={{ color: INTEREST_LEVELS[l].color }}>
                {INTEREST_LEVELS[l].label} · {people.length}
              </p>
              <ul className="flex flex-wrap gap-2">
                {people.map((i) => (
                  <li key={i.userId} className="flex items-center gap-1.5 rounded-full bg-panel-2 py-1 pl-1 pr-3 text-sm">
                    <AvatarStack people={[{ user: users[i.userId]!, level: l }]} size={24} />
                    {users[i.userId]!.username}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

    </div>
  );
}
