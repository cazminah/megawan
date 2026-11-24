import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { INTEREST_LEVELS, LEVELS, durationLabel, type ArcadeGame, type ArcadeInterest, type Duration, type InterestLevel, type PublicUser } from "../../shared/types";
import type { InterestPatch, SetInterest } from "../lib/arcade";
import { playersLong, playersShort, primaryGenre, shortGenre } from "../lib/format";
import { Avatar, AvatarStack } from "./Avatar";
import { InterestPicker } from "./InterestPicker";
import { TierIcon } from "./TierIcon";
import { Chip, Cover, HeroImage } from "./ui";

export interface ViewProps {
  games: ArcadeGame[];
  users: Record<string, PublicUser>;
  myId: string;
  onSet: SetInterest;
  onOpen: (g: ArcadeGame) => void;
  /** a picker opened/closed — the arcade freezes its order while one is open */
  onEditing?: (igdbId: number, open: boolean) => void;
}

const peopleOf = (g: ArcadeGame, users: Record<string, PublicUser>) =>
  g.interests.flatMap((i) => (users[i.userId] ? [{ user: users[i.userId]!, level: i.level }] : []));

/** the little "+" / your-level button that pops THE picker */
function RateButton({ game, myId, onSet, onEditing }: { game: ArcadeGame; myId: string; onSet: SetInterest; onEditing?: ViewProps["onEditing"] }) {
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

  // tell the arcade when we open/close (skipping the first render)
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    onEditing?.(game.igdbId, open);
  }, [open, game.igdbId, onEditing]);

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

export function GameGrid({ games, users, myId, onSet, onOpen, onEditing }: ViewProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((g) => {
        const top = g.interests.reduce<InterestLevel>((m, i) => (i.level > m ? i.level : m), 1);
        const plats = g.platforms.length > 3 ? [...g.platforms.slice(0, 3), `+${g.platforms.length - 3}`] : g.platforms;
        return (
          <li key={g.igdbId} data-flip={g.igdbId}>
            {/* the whole card is a square: wide image on top, details underneath */}
            <article
              onClick={() => onOpen(g)}
              className="group flex aspect-square cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-keen/60"
              style={{ boxShadow: `0 10px 30px -18px ${INTEREST_LEVELS[top].color}` }}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <HeroImage game={g} className="h-full w-full transition group-hover:scale-[1.03]" />
              </div>
              <div className="flex shrink-0 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display font-bold leading-tight">
                    <button className="max-w-full truncate text-left" onClick={(e) => { e.stopPropagation(); onOpen(g); }}>{g.name}</button>
                  </h3>
                  <MetaRow game={g} platforms={plats} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <AvatarStack people={peopleOf(g, users)} max={5} size={26} />
                  <RateButton game={g} myId={myId} onSet={onSet} onEditing={onEditing} />
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export function GameTable({ games, users, myId, onSet, onOpen, onEditing }: ViewProps) {
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
            <tr key={g.igdbId} data-flip={g.igdbId} onClick={() => onOpen(g)} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-panel-2/60">
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
              <td className="whitespace-nowrap px-3 py-2 text-dim"><Players game={g} /></td>
              <td className="max-w-40 px-3 py-2 text-dim">{g.genres.slice(0, 3).map(shortGenre).join(", ") || "—"}</td>
              <td className="px-3 py-2"><AvatarStack people={peopleOf(g, users)} max={6} size={26} /></td>
              <td className="px-3 py-2"><RateButton game={g} myId={myId} onSet={onSet} onEditing={onEditing} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** players as metadata: a people icon + "1–4" (or "co-op" etc. when IGDB has no counts) */
function Players({ game }: { game: ArcadeGame }) {
  const p = playersShort(game);
  if (!p) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1" title={playersLong(game) ?? undefined}>
      <TierIcon name={p.solo ? "person" : "group"} color="currentColor" size={14} />
      {p.text}
    </span>
  );
}

/** year · platforms… (truncates) · players · genre (always visible, right-aligned) */
function MetaRow({ game, platforms }: { game: ArcadeGame; platforms: string[] }) {
  const genre = primaryGenre(game);
  return (
    <p className="mt-0.5 flex items-center gap-2 text-xs text-faint">
      <span className="min-w-0 flex-1 truncate">{[game.releaseYear, ...platforms].filter(Boolean).join(" · ")}</span>
      {playersShort(game) && <span className="shrink-0"><Players game={game} /></span>}
      {genre && <span className="shrink-0 text-dim">{genre}</span>}
    </p>
  );
}

/** two lines, with "more" to expand (IGDB has no shorter blurb than `summary`) */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <div className="text-sm leading-relaxed text-dim">
      <p ref={ref} className={open ? "" : "line-clamp-2"}>{text}</p>
      {(clamped || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 text-xs text-faint hover:text-ink">
          {open ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

/** collapsed by default; once opened it's still click-to-load, so nothing from
 *  youtube loads (or plays) until you ask for it */
function Trailer({ id, name }: { id: string; name: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setShown((s) => !s)}
        className="flex items-center gap-1.5 text-sm font-semibold text-dim hover:text-ink"
      >
        <span className={`inline-block text-xs transition-transform ${shown ? "rotate-90" : ""}`}>▶</span>
        trailer
      </button>
      {shown && <div className="mt-2"><TrailerPlayer id={id} name={name} /></div>}
    </div>
  );
}

function TrailerPlayer({ id, name }: { id: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-bg">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
          title={`${name} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 grid place-items-center" aria-label={`play the ${name} trailer`}>
          <img src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-90" />
          <span className="relative rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur">▶ trailer</span>
        </button>
      )}
    </div>
  );
}

/** longest first; no duration goes last */
function byDuration(a: ArcadeInterest, b: ArcadeInterest) {
  if (!a.duration || !b.duration) return a.duration ? -1 : b.duration ? 1 : 0;
  return b.duration.max - a.duration.max || b.duration.min - a.duration.min;
}

export function GameDetail({ game, users, myId }: { game: ArcadeGame; users: Record<string, PublicUser>; myId: string }) {
  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <Cover imageId={game.coverImageId} name={game.name} className="aspect-[3/4] w-24 shrink-0 self-start rounded-xl sm:w-32" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-faint">{[game.releaseYear, game.genres.join(", ")].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-1">{game.platforms.map((p) => <Chip key={p}>{p}</Chip>)}</div>
          {playersLong(game) && (
            <p className="flex items-center gap-1.5 text-sm text-dim">
              <TierIcon name={playersShort(game)?.solo ? "person" : "group"} color="currentColor" size={16} />
              {playersLong(game)}
            </p>
          )}
          {(game.themes.length > 0 || game.freeToPlay) && (
            <p className="text-xs text-faint">{[...(game.freeToPlay ? ["free-to-play"] : []), ...game.themes].join(" · ")}</p>
          )}
          {game.igdbUrl && (
            <a href={game.igdbUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-faint underline-offset-2 hover:text-ink hover:underline">
              more on IGDB ↗
            </a>
          )}
        </div>
      </div>

      {game.summary && <Summary text={game.summary} />}

      {game.trailerYoutubeId && <Trailer id={game.trailerYoutubeId} name={game.name} />}

      <section aria-label="who's in" className="border-t border-line pt-4">
        {/* least keen on the left → most keen on the right, same as the picker */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
          {LEVELS.map((l) => {
            const lv = INTEREST_LEVELS[l];
            const people = game.interests.filter((i) => i.level === l && users[i.userId]).sort(byDuration);
            return (
              <div key={l} className="min-w-0">
                <div className="mb-2 flex flex-col items-center gap-1 border-b-2 pb-2 text-center" style={{ borderColor: people.length ? lv.color : "var(--color-line)" }}>
                  <TierIcon name={lv.icon} color={people.length ? lv.color : "var(--color-faint)"} size={22} />
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: people.length ? lv.text : "var(--color-faint)" }}>
                    {lv.label}
                  </span>
                  <span className="text-[11px] text-faint">{people.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {people.map((i) => {
                    const u = users[i.userId]!;
                    return (
                      <li key={i.userId} className="flex min-w-0 items-center gap-1.5" title={`${u.username}${i.duration ? ` · up for ${durationLabel(i.duration)}` : ""}`}>
                        <Avatar avatar={u.avatar} level={l} size={22} />
                        <span className="min-w-0">
                          <span className={`block truncate text-xs ${i.userId === myId ? "font-bold text-ink" : "text-dim"}`}>{u.username}</span>
                          {i.duration && <span className="block truncate text-[10px] text-faint">{durationLabel(i.duration)}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
