import { useCallback, useEffect, useState } from "react";
import type { AdminGame, AdminUser, Me } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { Button, Cover, ErrorNote } from "../components/ui";
import { api } from "../lib/api";

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function Admin({ me }: { me: Me }) {
  const [people, setPeople] = useState<AdminUser[] | null>(null);
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, g] = await Promise.all([api.adminUsers(), api.adminGames()]);
      setPeople(u);
      setGames(g);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  // every action asks first, then reloads the lists
  const act = async (key: string, question: string, fn: () => Promise<unknown>) => {
    if (!window.confirm(question)) return;
    setBusy(key);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const th = "px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-faint";
  const td = "px-3 py-2 align-middle";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">admin</h1>
        <p className="mt-1 text-sm text-dim">tidy up people and games. every button asks before it does anything.</p>
      </div>
      <ErrorNote>{error}</ErrorNote>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">people <span className="text-sm font-normal text-faint">{people?.length ?? ""}</span></h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line"><tr><th className={th}>who</th><th className={th}>email</th><th className={th}>joined</th><th className={th}>votes</th><th className={th} /></tr></thead>
            <tbody>
              {!people && <tr><td colSpan={5} className="p-4"><div className="skeleton h-8 rounded-lg" /></td></tr>}
              {people?.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0">
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <Avatar avatar={u.avatar} size={28} />
                      <span className="font-medium">{u.username}</span>
                      {u.isAdmin && <span className="rounded-full bg-keen/20 px-2 py-0.5 text-[11px] text-keen">admin</span>}
                    </span>
                  </td>
                  <td className={`${td} text-dim`}>{u.email ?? "—"}</td>
                  <td className={`${td} text-dim`}>{day(u.createdAt)}</td>
                  <td className={`${td} text-dim`}>{u.votes}</td>
                  <td className={`${td} text-right`}>
                    <span className="inline-flex gap-1.5">
                      <Button
                        variant="ghost"
                        className="px-2.5 py-1 text-xs"
                        disabled={busy !== null}
                        onClick={() => act(`a-${u.id}`, `swap ${u.username}'s avatar for a random icon?${u.avatar.kind === "upload" ? " their uploaded picture gets deleted." : ""}`, () => api.adminResetAvatar(u.id))}
                      >
                        reset avatar
                      </Button>
                      {u.id !== me.id && (
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1 text-xs text-perish hover:border-perish"
                          disabled={busy !== null}
                          onClick={() => act(`d-${u.id}`, `delete ${u.username} and all ${u.votes} of their votes? this can't be undone.`, () => api.adminDeleteUser(u.id))}
                        >
                          delete
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">games <span className="text-sm font-normal text-faint">{games?.length ?? ""}</span></h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-line"><tr><th className={th}>game</th><th className={th}>added</th><th className={th}>votes</th><th className={th} /></tr></thead>
            <tbody>
              {!games && <tr><td colSpan={4} className="p-4"><div className="skeleton h-8 rounded-lg" /></td></tr>}
              {games?.map((g) => (
                <tr key={g.igdbId} className="border-b border-line/60 last:border-0">
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <Cover imageId={g.coverImageId} name="" className="h-10 w-7 shrink-0 rounded" />
                      <span className="font-medium">{g.name}</span>
                    </span>
                  </td>
                  <td className={`${td} text-dim`}>{day(g.addedAt)}</td>
                  <td className={`${td} text-dim`}>{g.votes}</td>
                  <td className={`${td} text-right`}>
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs text-perish hover:border-perish"
                      disabled={busy !== null}
                      onClick={() => act(`g-${g.igdbId}`, `remove ${g.name} and its ${g.votes} vote${g.votes === 1 ? "" : "s"} from the arcade? this can't be undone.`, () => api.adminDeleteGame(g.igdbId))}
                    >
                      remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
