import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DEFAULT_ICONS, ICON_COLORS, type Avatar as AvatarT, type Me, type PaletteName } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { Button, ErrorNote, Field } from "../components/ui";
import { api } from "../lib/api";
import { iconLabel, loadIconIndex, searchIcons } from "../lib/icons";
import { navigate } from "../lib/router";
import { ColourModeToggle } from "../components/ColourMode";

const MAX_UPLOAD = 8 * 1024 * 1024; // before we shrink it — the server caps the shrunk one at 2 MB

/** centre-crop to a square and shrink to 256px webp in the browser */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (blob?.type === "image/webp") return blob;
  // safari < 17 can't encode webp — png is fine at 256px
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("couldn't read that image"))), "image/png"));
}

function AvatarEditor({ me, onSaved }: { me: Me; onSaved: (m: Me) => void }) {
  const start = me.avatar.kind === "icon" ? me.avatar : { kind: "icon" as const, icon: DEFAULT_ICONS[0], color: ICON_COLORS[0] };
  const [tab, setTab] = useState<"icon" | "upload">(me.avatar.kind === "upload" ? "upload" : "icon");
  const [icon, setIcon] = useState<string>(start.icon);
  const [color, setColor] = useState<string>(start.color);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadIconIndex().then((i) => setAll(i.icons)).catch((e: Error) => setError(e.message));
  }, []);

  const results = useMemo(() => {
    if (!all) return [];
    return q.trim() ? searchIcons(all, q) : [...DEFAULT_ICONS];
  }, [all, q]);

  const preview: AvatarT = tab === "icon" ? { kind: "icon", icon, color } : me.avatar;
  const dirty = tab === "icon" && (me.avatar.kind !== "icon" || me.avatar.icon !== icon || me.avatar.color !== color);

  const run = async (fn: () => Promise<Me>) => {
    setBusy(true); setError(null); setSaved(false);
    try { onSaved(await fn()); setSaved(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("that's not an image");
    if (file.size > MAX_UPLOAD) return setError("that image is huge — try one under 8 MB");
    await run(async () => api.uploadAvatar(await shrink(file)));
  };

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar avatar={preview} size={96} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">your avatar</h2>
          <p className="text-sm text-dim">shows up on every game you're keen on, ringed in your interest colour.</p>
          <div className="mt-3 flex rounded-xl border border-line bg-bg p-0.5 text-sm" role="tablist">
            {(["icon", "upload"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg px-3 py-1.5 font-medium ${tab === t ? "bg-panel-2 text-ink" : "text-faint hover:text-ink"}`}
              >
                {t === "icon" ? "pick an icon" : "upload a picture"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "icon" ? (
        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">colour</p>
            <div className="flex flex-wrap gap-2">
              {ICON_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`colour ${c}`}
                  aria-pressed={color === c}
                  className="h-8 w-8 rounded-full transition hover:scale-110"
                  style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--color-panel), 0 0 0 5px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`search ${all ? all.length.toLocaleString() : "4,000+"} icons — try "ghost", "dragon", "duck"`}
              aria-label="search icons"
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-keen focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-faint">
              {q.trim() ? `${results.length === 150 ? "150+" : results.length} match${results.length === 1 ? "" : "es"}` : "a few favourites to start you off"}
            </p>
          </div>
          <ul className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2 overflow-y-auto pr-1">
            {results.map((id) => (
              <li key={id}>
                <button
                  onClick={() => setIcon(id)}
                  title={iconLabel(id)}
                  aria-label={iconLabel(id)}
                  aria-pressed={icon === id}
                  className={`grid aspect-square w-full place-items-center rounded-xl border-2 bg-avatar transition hover:border-keen/70 ${icon === id ? "border-keen" : "border-transparent"}`}
                >
                  <span
                    className="icon-mask block h-3/4 w-3/4"
                    style={{ backgroundColor: color, maskImage: `url(/icons/${id}.svg)`, WebkitMaskImage: `url(/icons/${id}.svg)` }}
                  />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-3">
            {saved && !dirty && <span className="text-sm text-keen">saved ✓</span>}
            <Button disabled={!dirty || busy} onClick={() => run(() => api.updateMe({ avatar: { kind: "icon", icon, color } }))}>
              {busy ? "saving…" : "use this icon"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <label className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center hover:border-keen/60">
            <span className="font-medium">{busy ? "uploading…" : "choose a picture"}</span>
            <span className="mt-1 text-xs text-faint">png, jpeg or webp · cropped to a square in your browser</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {saved && <p className="text-sm text-keen">uploaded ✓</p>}
        </div>
      )}
      <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
    </section>
  );
}

function EmailForm({ me, onSaved }: { me: Me; onSaved: (m: Me) => void }) {
  const [email, setEmail] = useState(me.email ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setMsg(null);
    try { onSaved(await api.updateMe({ email: email || null })); setMsg("saved ✓"); } catch (err) { setError((err as Error).message); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-lg font-bold">email</h2>
      <Field label="email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="only for passphrase resets. leave blank to remove it." />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-keen">{msg}</span>}
        <Button variant="ghost" type="submit">save email</Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setMsg(null);
    try { await api.changePassword(current, next); setMsg("changed ✓ (other devices are logged out)"); setCurrent(""); setNext(""); }
    catch (err) { setError((err as Error).message); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-lg font-bold">change passphrase</h2>
      <Field label="current passphrase" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <Field label="new passphrase" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} hint="8+ characters · don't reuse one from anywhere important" required />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-keen">{msg}</span>}
        <Button variant="ghost" type="submit">change it</Button>
      </div>
    </form>
  );
}

function ColourModeSection({ onSaved }: { onSaved: (m: Me) => void }) {
  const [error, setError] = useState<string | null>(null);
  const save = async (palette: PaletteName) => {
    setError(null);
    try { onSaved(await api.updateMe({ palette })); } catch (e) { setError((e as Error).message); }
  };
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-panel p-5">
      <h2 className="font-display text-lg font-bold">colours</h2>
      <ColourModeToggle onChange={save} />
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}

function ArcadeButton() {
  return (
    <Button onClick={() => navigate("/")} className="px-6 py-3 text-base">
      to the arcade →
    </Button>
  );
}

export function Profile({ me, onSaved }: { me: Me; onSaved: (m: Me) => void }) {
  const welcome = new URLSearchParams(window.location.search).has("welcome");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{welcome ? `welcome, ${me.username} 👋` : me.username}</h1>
          <p className="mt-1 text-sm text-dim">
            {welcome ? "we gave you a random avatar — make it yours (or don't), then head in." : "your account bits."}
          </p>
        </div>
        {welcome && <ArcadeButton />}
      </div>
      <AvatarEditor me={me} onSaved={onSaved} />
      {welcome ? (
        <div className="flex justify-center pt-2 pb-4"><ArcadeButton /></div>
      ) : (
        <>
          <ColourModeSection onSaved={onSaved} />
          <EmailForm me={me} onSaved={onSaved} />
          <PasswordForm />
        </>
      )}
    </div>
  );
}
