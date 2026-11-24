import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DURATIONS, INTEREST_LEVELS, type ArcadeGame, type Duration, type InterestLevel, type Me, type PublicUser, type SearchHit } from "../../shared/types";
import { AddGameDialog } from "../components/AddGameDialog";
import { Avatar } from "../components/Avatar";
import { GameDetail, GameGrid, GameTable } from "../components/GameViews";
import { TierIcon } from "../components/TierIcon";
import { Button, Chip, ErrorNote, Modal } from "../components/ui";
import { useArcade } from "../lib/arcade";
import { useFlip } from "../lib/flip";
import { MODE_LABELS, modeLabel, shortGenre } from "../lib/format";
import {
  activeFilterCount, applyFilters, DEFAULT_FILTERS, explainTokens, facet, groupGames,
  type Filters, type GroupBy, type Sort, type TokenKind,
} from "../lib/filters";

type View = "grid" | "list";

function remembered<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc — fine */ }
}

const SORTS: Record<Sort, string> = { hype: "most hyped", people: "most people", recent: "newest added", year: "release year", az: "a–z" };
const GROUPS: Record<GroupBy, string> = { none: "no grouping", genre: "group: genre", size: "group: group size", keenness: "group: keenness" };
const KIND_LABEL: Record<TokenKind, string> = { year: "year", platform: "platform", genre: "genre", theme: "theme", mode: "mode", name: "name" };

const selectCls = "rounded-xl border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-keen focus:outline-none";
const legendCls = "mb-2 text-xs font-semibold uppercase tracking-wide text-faint";

function Segmented<T extends string | number | null>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex divide-x divide-line overflow-hidden rounded-xl border border-line bg-panel text-sm">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-medium ${value === o.value ? "bg-keen/20 text-ink" : "text-faint hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Arcade({ me }: { me: Me }) {
  const { data, error, setInterest } = useArcade(me);
  const [view, setView] = useState<View>(() => remembered("mw:view", ["grid", "list"] as const, "grid"));
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    sort: remembered("mw:sort", Object.keys(SORTS) as Sort[], "hype"),
    groupBy: remembered("mw:group", Object.keys(GROUPS) as GroupBy[], "none"),
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => remember("mw:view", view), [view]);
  useEffect(() => remember("mw:sort", filters.sort), [filters.sort]);
  useEffect(() => remember("mw:group", filters.groupBy), [filters.groupBy]);

  const games = data?.games ?? [];
  const users = data?.users ?? {};
  const sorted = useMemo(() => applyFilters(games, filters, me.id), [games, filters, me.id]);

  // while a picker is open, keep the cards where they are (votes would otherwise
  // re-sort them out from under the popover). on close they glide into place.
  const [frozen, setFrozen] = useState<number[] | null>(null);
  const [touched, setTouched] = useState<number | null>(null);
  const lastOrder = useRef<number[]>([]);
  const shown = useMemo(() => {
    if (!frozen) return sorted;
    const rank = new Map(frozen.map((id, i) => [id, i]));
    return [...sorted].sort((a, b) => (rank.get(a.igdbId) ?? 1e9) - (rank.get(b.igdbId) ?? 1e9));
  }, [sorted, frozen]);
  const frozenGroups = useRef<Map<number, string> | null>(null);
  const groups = useMemo(() => {
    const gs = groupGames(shown, filters.groupBy);
    if (!frozen || !frozenGroups.current) return gs;
    // keep each game in the group it was in when the picker opened
    const keep = frozenGroups.current;
    const all = new Map(gs.map((g) => [g.key, { ...g, games: [] as ArcadeGame[] }]));
    for (const g of shown) {
      const key = keep.get(g.igdbId) ?? gs.find((x) => x.games.includes(g))!.key;
      if (!all.has(key)) all.set(key, { key, label: key, games: [] });
      all.get(key)!.games.push(g);
    }
    return [...all.values()].filter((g) => g.games.length);
  }, [shown, filters.groupBy, frozen]);
  lastOrder.current = shown.map((g) => g.igdbId);
  const lastGroups = useRef(groups);
  lastGroups.current = groups;
  const onEditing = useCallback((igdbId: number, open: boolean) => {
    if (open) {
      frozenGroups.current = new Map(lastGroups.current.flatMap((gr) => gr.games.map((g) => [g.igdbId, gr.key] as const)));
      setFrozen(lastOrder.current);
    } else {
      frozenGroups.current = null;
      setFrozen(null);
      setTouched(igdbId);
    }
  }, []);

  const results = useRef<HTMLDivElement>(null);
  useFlip(results);
  // after a reshuffle, keep the card you just voted on in view
  useEffect(() => {
    if (touched === null) return;
    const t = setTimeout(() => {
      results.current?.querySelector(`[data-flip="${touched}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setTouched(null);
    }, 380);
    return () => clearTimeout(t);
  }, [touched]);

  const platforms = useMemo(() => facet(games, (g) => g.platforms), [games]);
  const genres = useMemo(() => facet(games, (g) => g.genres.map(shortGenre)), [games]);
  const themes = useMemo(() => facet(games, (g) => g.themes), [games]);
  const modes = useMemo(() => {
    const present = new Set(games.flatMap((g) => g.gameModes));
    return MODE_LABELS.map(([k]) => k).filter((k) => present.has(k));
  }, [games]);
  const voters = useMemo(() => {
    const ids = new Set(games.flatMap((g) => g.interests.map((i) => i.userId)));
    return [...ids].map((id) => users[id]).filter((u): u is PublicUser => !!u).sort((a, b) => a.username.localeCompare(b.username));
  }, [games, users]);
  const chips = useMemo(() => explainTokens(games, filters.text), [games, filters.text]);
  const existing = useMemo(
    () => new Map(games.map((g) => [g.igdbId, g.interests.find((i) => i.userId === me.id)?.level ?? null] as const)),
    [games, me.id],
  );
  const open = games.find((g) => g.igdbId === openId) ?? null;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggle = (k: "platforms" | "genres" | "themes" | "people" | "gameModes", v: string) =>
    setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
  const nActive = activeFilterCount(filters);
  const clearFilters = () => setFilters((f) => ({ ...DEFAULT_FILTERS, text: f.text, sort: f.sort, groupBy: f.groupBy }));

  const onAdd = (hit: SearchHit, level: InterestLevel, duration: Duration | null | undefined) => setInterest(hit.igdbId, { level, duration }, hit);
  const viewProps = { users, myId: me.id, onSet: setInterest, onEditing, onOpen: (g: ArcadeGame) => setOpenId(g.igdbId) };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">the arcade</h1>
          <p className="mt-1 text-sm text-dim">
            {games.length ? `${games.length} game${games.length === 1 ? "" : "s"} people want to play` : "every game anyone's keen on lands here"}
          </p>
        </div>
        <Button onClick={() => setAdding(true)} className="px-5">＋ add game</Button>
      </div>

      {/* toolbar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filters.text}
            onChange={(e) => set("text", e.target.value)}
            placeholder="find in the arcade — try “2020 shooter pc” or “party switch”"
            aria-label="find in the arcade"
            className="min-w-0 flex-1 basis-64 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm placeholder:text-faint focus:border-keen focus:outline-none"
          />
          <select value={filters.sort} onChange={(e) => set("sort", e.target.value as Sort)} className={selectCls} aria-label="sort">
            {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={filters.groupBy} onChange={(e) => set("groupBy", e.target.value as GroupBy)} className={selectCls} aria-label="group by">
            {Object.entries(GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Button variant="ghost" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className={`py-2 ${nActive ? "border-keen" : ""}`}>
            filters{nActive ? ` · ${nActive}` : ""}
          </Button>
          <Segmented label="view" value={view} onChange={setView} options={[{ value: "grid", label: "▦ grid" }, { value: "list", label: "☰ list" }]} />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs" aria-live="polite">
            {chips.map(({ token, kind }, i) => (
              <span
                key={`${token}-${i}`}
                className={`rounded-full border px-2 py-0.5 ${kind ? "border-line bg-panel-2/60 text-dim" : "border-perish/40 text-perish"}`}
              >
                {token} <span className="opacity-60">· {kind ? KIND_LABEL[kind] : "no match"}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {showFilters && (
        <div className="space-y-4 rounded-2xl border border-line bg-panel p-4">
          {platforms.length > 0 && (
            <fieldset>
              <legend className={legendCls}>platform</legend>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((p) => <Chip key={p} active={filters.platforms.includes(p)} onClick={() => toggle("platforms", p)}>{p}</Chip>)}
              </div>
            </fieldset>
          )}
          {genres.length > 0 && (
            <fieldset>
              <legend className={legendCls}>genre</legend>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((p) => <Chip key={p} active={filters.genres.includes(p)} onClick={() => toggle("genres", p)}>{p}</Chip>)}
              </div>
            </fieldset>
          )}
          {modes.length > 0 && (
            <fieldset>
              <legend className={legendCls}>mode</legend>
              <div className="flex flex-wrap gap-1.5">
                {modes.map((m) => <Chip key={m} active={filters.gameModes.includes(m)} onClick={() => toggle("gameModes", m)}>{modeLabel(m)}</Chip>)}
              </div>
            </fieldset>
          )}
          {themes.length > 0 && (
            <fieldset>
              <legend className={legendCls}>theme</legend>
              <div className="flex flex-wrap gap-1.5">
                {themes.map((p) => <Chip key={p} active={filters.themes.includes(p)} onClick={() => toggle("themes", p)}>{p}</Chip>)}
              </div>
            </fieldset>
          )}
          {voters.length > 1 && (
            <fieldset>
              <legend className={legendCls}>games these people are all in on</legend>
              <div className="flex flex-wrap gap-1.5">
                {voters.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={filters.people.includes(u.id)}
                    onClick={() => toggle("people", u.id)}
                    className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition ${
                      filters.people.includes(u.id) ? "border-keen bg-keen/20 text-ink" : "border-line text-dim hover:border-keen/60"
                    }`}
                  >
                    <Avatar avatar={u.avatar} size={22} />
                    {u.username}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <label className="flex items-center gap-2 text-sm text-dim">
              works for
              <select value={filters.players} onChange={(e) => set("players", Number(e.target.value))} className={selectCls}>
                <option value={0}>any number</option>
                {[2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => <option key={n} value={n}>{n} players</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-dim">
              at least
              <select value={filters.minHeadcount} onChange={(e) => set("minHeadcount", Number(e.target.value))} className={selectCls}>
                <option value={0}>anyone</option>
                {[2, 3, 4, 5, 8].map((n) => <option key={n} value={n}>{n} people in</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2 text-sm text-dim">
              someone's up for
              <Segmented
                label="someone's up for"
                value={filters.duration}
                onChange={(v) => set("duration", v)}
                options={[
                  { value: null, label: "any" },
                  ...DURATIONS.map((d, i) => ({ value: i as number | null, title: d.label, label: <><TierIcon name={d.icon} color="currentColor" size={16} /><span className="hidden sm:inline">{d.label}</span></> })),
                ]}
              />
            </div>
            <Segmented
              label="my votes"
              value={filters.myVote}
              onChange={(v) => set("myVote", v)}
              options={[{ value: "any", label: "all games" }, { value: "voted", label: "voted" }, { value: "not-voted", label: "not voted yet" }]}
            />
            <label className="flex items-center gap-2 text-sm text-dim">
              <input type="checkbox" checked={filters.freeToPlay} onChange={(e) => set("freeToPlay", e.target.checked)} className="accent-keen" />
              free-to-play
            </label>
            {nActive > 0 && (
              <button onClick={clearFilters} className="ml-auto text-sm text-faint hover:text-ink">clear filters</button>
            )}
          </div>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div ref={results} className="relative">
        {!data && !error ? (
          <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }, (_, i) => <li key={i} className="skeleton aspect-square rounded-2xl" />)}
          </ul>
        ) : !games.length ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-display text-xl font-bold">the arcade's empty</p>
            <p className="mt-1 max-w-sm text-sm text-dim">be the first — add a game you'd love to play on the day.</p>
            <Button className="mt-5" onClick={() => setAdding(true)}>＋ add game</Button>
          </div>
        ) : !shown.length ? (
          <div className="py-12 text-center text-sm text-faint">
            nothing matches that.{" "}
            {(nActive > 0 || filters.text) && (
              <button className="text-keen hover:underline" onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort, groupBy: f.groupBy }))}>
                clear search + filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((gr) => (
              <section key={gr.key} aria-label={gr.label || "games"}>
                {gr.label && (
                  <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                    {gr.level && <TierIcon name={INTEREST_LEVELS[gr.level].icon} color={INTEREST_LEVELS[gr.level].color} size={20} />}
                    <span style={gr.level ? { color: INTEREST_LEVELS[gr.level].text } : undefined}>{gr.label}</span>
                    <span className="text-sm font-normal text-faint">{gr.games.length}</span>
                  </h2>
                )}
                {view === "grid" ? <GameGrid games={gr.games} {...viewProps} /> : <GameTable games={gr.games} {...viewProps} />}
              </section>
            ))}
          </div>
        )}
      </div>

      <AddGameDialog open={adding} onClose={() => setAdding(false)} onSave={onAdd} existing={existing} />
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ""} wide>
        {open && data && <GameDetail game={open} users={data.users} myId={me.id} />}
      </Modal>
    </div>
  );
}
