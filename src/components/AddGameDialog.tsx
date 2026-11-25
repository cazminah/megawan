import { useEffect, useRef, useState } from "react";
import type { Duration, InterestLevel, SearchHit } from "../../shared/types";
import { api } from "../lib/api";
import { InterestPicker } from "./InterestPicker";
import { Button, Cover, ErrorNote, Modal } from "./ui";

export function AddGameDialog({
  open,
  onClose,
  onSave,
  existing,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (hit: SearchHit, level: InterestLevel, duration: Duration | null | undefined) => Promise<void>;
  existing: Map<number, InterestLevel | null>; // games already in the arcade → my level there
  preset?: SearchHit | null; // jump straight to the picker for this game (bringing one back from the archive)
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [level, setLevel] = useState<InterestLevel | null>(null);
  const [duration, setDuration] = useState<Duration | null | undefined>(undefined); // undefined = untouched
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ(""); setHits([]); setPicked(preset ?? null); setLevel(preset ? 3 : null); setDuration(undefined); setError(null);
    setTimeout(() => input.current?.focus(), 0);
  }, [open, preset]);

  // debounced search, ignoring responses that arrive out of order
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setSearching(false); return; }
    setSearching(true);
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.search(term);
        if (!stale) { setHits(res); setError(null); }
      } catch (e) {
        if (!stale) setError((e as Error).message);
      } finally {
        if (!stale) setSearching(false);
      }
    }, 280);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  const save = async () => {
    if (!picked || !level) return;
    setSaving(true);
    try {
      await onSave(picked, level, duration);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={preset ? "bring it back" : picked ? "how keen are you?" : "add a game"}>
      {!picked ? (
        <div className="space-y-3">
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search for a game…"
            aria-label="search for a game"
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-ink placeholder:text-faint focus:border-keen focus:outline-none"
          />
          <ErrorNote>{error}</ErrorNote>
          <ul className="max-h-[55dvh] space-y-1 overflow-y-auto" aria-busy={searching}>
            {searching && !hits.length && [0, 1, 2].map((i) => <li key={i} className="skeleton h-16 rounded-xl" />)}
            {!searching && q.trim().length >= 2 && !hits.length && !error && (
              <li className="px-2 py-6 text-center text-sm text-faint">nothing found — try another spelling?</li>
            )}
            {hits.map((h) => {
              const mine = existing.get(h.igdbId);
              return (
                <li key={h.igdbId}>
                  <button
                    onClick={() => { setPicked(h); setLevel(mine ?? 3); setDuration(undefined); }} // new games start on "keen"
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-panel-2"
                  >
                    <Cover imageId={h.coverImageId} name="" className="h-14 w-10 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.name}</span>
                      <span className="block truncate text-xs text-faint">
                        {[h.releaseYear, h.platforms.slice(0, 4).join(", ")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {existing.has(h.igdbId) && <span className="shrink-0 text-xs text-keen">in the arcade</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Cover imageId={picked.coverImageId} name="" className="h-20 w-15 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight">{picked.name}</p>
              <p className="text-sm text-faint">{picked.releaseYear}</p>
            </div>
          </div>
          <InterestPicker value={level} onChange={setLevel} busy={saving} duration={duration ?? null} onDuration={setDuration} />
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-between gap-2">
            {preset ? <span /> : <Button variant="quiet" onClick={() => setPicked(null)}>← back</Button>}
            <Button onClick={save} disabled={!level || saving}>{saving ? "adding…" : preset ? "bring it back" : "add to the arcade"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
