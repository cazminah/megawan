import { useEffect, useRef, useState } from "react";
import type { Me } from "../shared/types";
import { Avatar } from "./components/Avatar";
import { AvailabilityIcons } from "./components/Availability";
import { api } from "./lib/api";
import { applyPalette, currentPalette } from "./lib/palette";
import { linkTo, navigate, usePath } from "./lib/router";
import { Arcade } from "./pages/Arcade";
import { Forgot, Login, Register, Reset } from "./pages/Auth";
import { Credits } from "./pages/Credits";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";

const PUBLIC = ["/login", "/register", "/forgot", "/reset", "/credits"];

function UserMenu({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 rounded-full p-0.5 pr-3 hover:bg-panel-2">
        <Avatar avatar={me.avatar} size={34} />
        <span className="hidden text-sm font-medium sm:inline">{me.username}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-44 rounded-xl border border-line bg-panel p-1 shadow-2xl" onClick={() => setOpen(false)}>
          <a href="/profile" onClick={linkTo("/profile")} className={item}>profile</a>
          {me.isAdmin && <a href="/admin" onClick={linkTo("/admin")} className={item}>admin</a>}
          <button onClick={onLogout} className={item}>log out</button>
        </div>
      )}
    </div>
  );
}

export function App() {
  const path = usePath();
  const route = path.split("?")[0]!;
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = still checking

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  // your account's colour mode wins once you're logged in (it follows you between devices)
  useEffect(() => {
    if (me && me.palette !== currentPalette()) applyPalette(me.palette);
  }, [me]);

  // bounce between public + private pages depending on login state
  useEffect(() => {
    if (me === undefined) return;
    if (!me && !PUBLIC.includes(route)) navigate("/login", true);
    if (me && ["/login", "/register", "/forgot"].includes(route)) navigate("/", true);
  }, [me, route]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setMe(null);
    navigate("/login", true);
  };

  let page: React.ReactNode = null;
  if (me === undefined) page = <div className="skeleton mx-auto mt-24 h-40 max-w-sm rounded-2xl" />;
  else if (route === "/credits") page = <Credits />;
  else if (!me) {
    page =
      route === "/register" ? <Register onAuthed={setMe} /> :
      route === "/forgot" ? <Forgot /> :
      route === "/reset" ? <Reset onAuthed={setMe} /> :
      <Login onAuthed={setMe} />;
  } else if (route === "/profile") page = <Profile me={me} onSaved={setMe} />;
  else if (route === "/admin" && me.isAdmin) page = <Admin me={me} />;
  else if (route === "/reset") page = <Reset onAuthed={setMe} />;
  else page = <Arcade me={me} />;

  return (
    <div className="flex min-h-dvh flex-col">
      {me && (
        <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <a href="/" onClick={linkTo("/")} className="hype-text font-display text-2xl font-bold tracking-tight">megaWAN</a>
            <div className="flex items-center gap-3">
              <a href="/profile" onClick={linkTo("/profile")} className="hidden rounded-lg p-1 hover:bg-panel-2 sm:block" aria-label="your availability — change it in your profile">
                <AvailabilityIcons mask={me.availability} size={18} />
              </a>
              <UserMenu me={me} onLogout={logout} />
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{page}</main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-6 pt-2 text-center text-xs text-faint sm:px-6">
        game data from <a href="https://www.igdb.com" className="hover:text-ink" target="_blank" rel="noopener noreferrer">IGDB</a> ·
        icons from <a href="https://game-icons.net" className="hover:text-ink" target="_blank" rel="noopener noreferrer">game-icons.net</a> ·{" "}
        <a href="/credits" onClick={linkTo("/credits")} className="hover:text-ink">credits</a>
      </footer>
    </div>
  );
}
