import { useEffect, useMemo, useState } from "react";
import type { ArcadeGame, Duration, InterestLevel, Me, SearchHit } from "../../shared/types";
import { AddGameDialog } from "../components/AddGameDialog";
import { GameDetail, GameGrid, GameTable } from "../components/GameViews";
import { Button, Chip, ErrorNote, Modal } from "../components/ui";
import { useArcade } from "../lib/arcade";
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, facet, type Filters } from "../lib/filters";

type View = "grid" | "list";

function remembered<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc — fine */ }
}

const selectCls = "rounded-xl border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-keen focus:outline-none";

export function Arcade({ me }: { me: Me }) {
  const { data, error, setInterest } = useArcade(me);
  const [view, setView] = useState<View>(() => remembered<View>("mw:view", "grid"));
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => remember("mw:view", view), [view]);

  const games = data?.games ?? [];
  const shown = useMemo(() => applyFilters(games, filters, me.id), [games, filters, me.id]);
  const platforms = useMemo(() => facet(games, (g) => g.platforms), [games]);
  const genres = useMemo(() => facet(games, (g) => g.genres), [games]);
  const existing = useMemo(
    () => new Map(games.map((g) => [g.igdbId, g.interests.find((i) => i.userId === me.id)?.level ?? null] as const)),
    [games, me.id],
  );
  const open = games.find((g) => g.igdbId === openId) ?? null;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggle = (k: "platforms" | "genres", v: string) =>
    setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
  const nActive = activeFilterCount(filters);

  const onAdd = (hit: SearchHit, level: InterestLevel, duration: Duration | null | undefined) => setInterest(hit.igdbId, { level, duration }, hit);

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
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filters.text}
          onChange={(e) => set("text", e.target.value)}
          placeholder="find in the arcade…"
          aria-label="filter games by name"
          className="min-w-0 flex-1 basis-48 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm placeholder:text-faint focus:border-keen focus:outline-none"
        />
        <select value={filters.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])} className={selectCls} aria-label="sort">
          <option value="hype">most hyped</option>
          <option value="people">most people</option>
          <option value="recent">newest</option>
          <option value="az">a–z</option>
        </select>
        <Button variant="ghost" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="py-2">
          filters{nActive ? ` · ${nActive}` : ""}
        </Button>
        <div className="flex rounded-xl border border-line bg-panel p-0.5" role="group" aria-label="view">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? "bg-panel-2 text-ink" : "text-faint hover:text-ink"}`}
            >
              {v === "grid" ? "▦ grid" : "☰ list"}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="space-y-4 rounded-2xl border border-line bg-panel p-4">
          {platforms.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">platform</legend>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((p) => <Chip key={p} active={filters.platforms.includes(p)} onClick={() => toggle("platforms", p)}>{p}</Chip>)}
              </div>
            </fieldset>
          )}
          {genres.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">genre</legend>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((p) => <Chip key={p} active={filters.genres.includes(p)} onClick={() => toggle("genres", p)}>{p}</Chip>)}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select value={filters.multi} onChange={(e) => set("multi", e.target.value as Filters["multi"])} className={selectCls} aria-label="multiplayer">
              <option value="any">any multiplayer</option>
              <option value="online">online</option>
              <option value="local">local / couch</option>
              <option value="coop">co-op</option>
            </select>
            <select value={filters.minPlayers} onChange={(e) => set("minPlayers", Number(e.target.value))} className={selectCls} aria-label="minimum players">
              <option value={0}>any group size</option>
              {[2, 4, 6, 8, 16].map((n) => <option key={n} value={n}>{n}+ players</option>)}
            </select>
            <label className="flex items-center gap-2 px-1 text-sm text-dim">
              <input type="checkbox" checked={filters.unratedByMe} onChange={(e) => set("unratedByMe", e.target.checked)} className="accent-keen" />
              only ones i haven't rated
            </label>
            {nActive > 0 && (
              <button onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, text: filters.text })} className="ml-auto text-sm text-faint hover:text-ink">
                clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {!data && !error ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }, (_, i) => <li key={i} className="skeleton aspect-[3/5] rounded-2xl" />)}
        </ul>
      ) : !games.length ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <p className="font-display text-xl font-bold">the arcade's empty 👀</p>
          <p className="mt-1 max-w-sm text-sm text-dim">be the first — add a game you'd love to play on the day.</p>
          <Button className="mt-5" onClick={() => setAdding(true)}>＋ add game</Button>
        </div>
      ) : !shown.length ? (
        <p className="py-12 text-center text-sm text-faint">nothing matches those filters.</p>
      ) : view === "grid" ? (
        <GameGrid games={shown} users={data!.users} myId={me.id} onSet={setInterest} onOpen={(g: ArcadeGame) => setOpenId(g.igdbId)} />
      ) : (
        <GameTable games={shown} users={data!.users} myId={me.id} onSet={setInterest} onOpen={(g: ArcadeGame) => setOpenId(g.igdbId)} />
      )}

      <AddGameDialog open={adding} onClose={() => setAdding(false)} onSave={onAdd} existing={existing} />
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ""} wide>
        {open && data && <GameDetail game={open} users={data.users} myId={me.id} />}
      </Modal>
    </div>
  );
}
