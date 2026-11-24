import { useState, type FormEvent, type ReactNode } from "react";
import type { Me } from "../../shared/types";
import { Button, ErrorNote, Field } from "../components/ui";
import { api } from "../lib/api";
import { linkTo, navigate } from "../lib/router";

function Card({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="mb-6 text-center">
        <p className="hype-text font-display text-5xl font-bold tracking-tight">megaWAN</p>
        <p className="mt-2 text-sm text-dim">pick the games. find your squad. touch no grass.</p>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-6 shadow-[0_20px_60px_-30px_var(--color-keen)]">
        <h1 className="mb-5 font-display text-xl font-bold">{title}</h1>
        {children}
      </div>
      {footer && <div className="mt-4 text-center text-sm text-dim">{footer}</div>}
    </div>
  );
}

const A = ({ to, children }: { to: string; children: ReactNode }) => (
  <a href={to} onClick={linkTo(to)} className="font-medium text-keen hover:underline">{children}</a>
);

function useSubmit<T>(fn: () => Promise<T>, done: (r: T) => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { done(await fn()); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return { error, busy, submit };
}

export function Login({ onAuthed }: { onAuthed: (m: Me) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(() => api.login({ username, password }), (m) => { onAuthed(m); navigate("/", true); });
  return (
    <Card title="log in" footer={<>new here? <A to="/register">make an account</A></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <Field label="passphrase" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "logging in…" : "log in"}</Button>
        <p className="text-center text-sm"><A to="/forgot">forgot your passphrase?</A></p>
      </form>
    </Card>
  );
}

export function Register({ onAuthed }: { onAuthed: (m: Me) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const { error, busy, submit } = useSubmit(
    () => api.register({ username, password, email: email || undefined }),
    (m) => { onAuthed(m); navigate("/profile?welcome=1", true); },
  );
  return (
    <Card title="make an account" footer={<>already in? <A to="/login">log in</A></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          pattern="[a-z0-9_\-]{3,24}"
          hint="3–24 characters: a–z, 0–9, _ or -"
          required
          autoFocus
        />
        <Field label="passphrase" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="8+ characters · don't reuse one from anywhere important" required />
        <Field
          label="email (optional)"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="only used to reset your passphrase if you forget it"
        />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "creating…" : "let's go"}</Button>
      </form>
    </Card>
  );
}

export function Forgot() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { error, busy, submit } = useSubmit(() => api.forgot(username), (r) => setSent(r.message));
  return (
    <Card title="forgot your passphrase?" footer={<A to="/login">← back to log in</A>}>
      {sent ? (
        <p className="text-sm text-dim">{sent}. check your inbox (and spam). no email on your account? shout in the discord.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "sending…" : "send me a reset link"}</Button>
        </form>
      )}
    </Card>
  );
}

export function Reset({ onAuthed }: { onAuthed: (m: Me) => void }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(() => api.reset(token, password), (m) => { onAuthed(m); navigate("/", true); });
  return (
    <Card title="pick a new passphrase">
      {!token ? (
        <ErrorNote>this link's missing its token — open the one from your email again.</ErrorNote>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="new passphrase" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="8+ characters · don't reuse one from anywhere important" required autoFocus />
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "saving…" : "save + log in"}</Button>
        </form>
      )}
    </Card>
  );
}
