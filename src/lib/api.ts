import type { AdminGame, AdminSeason, AdminUser, ArcadeResponse, Duration, InterestLevel, Me, PaletteName, SearchHit } from "../../shared/types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, raw?: Blob): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: raw ? { "Content-Type": raw.type } : body !== undefined ? { "Content-Type": "application/json" } : {},
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `something broke (${res.status})`, res.status);
  return data as T;
}

export const api = {
  me: () => call<Me | null>("GET", "/me"),
  register: (b: { username: string; password: string; email?: string; palette?: PaletteName; availability?: number }) => call<Me>("POST", "/auth/register", b),
  login: (b: { username: string; password: string }) => call<Me>("POST", "/auth/login", b),
  logout: () => call<{ ok: true }>("POST", "/auth/logout"),
  forgot: (username: string) => call<{ message: string }>("POST", "/auth/forgot", { username }),
  reset: (token: string, password: string) => call<Me>("POST", "/auth/reset", { token, password }),
  updateMe: (b: { email?: string | null; avatar?: { kind: "icon"; icon: string; color: string }; palette?: PaletteName; availability?: number }) => call<Me>("PATCH", "/me", b),
  uploadAvatar: (img: Blob) => call<Me>("PUT", "/me/avatar", undefined, img),
  changePassword: (current: string, next: string) => call<{ ok: true }>("POST", "/me/password", { current, next }),
  search: (q: string) => call<SearchHit[]>("GET", `/games/search?q=${encodeURIComponent(q)}`),
  arcade: () => call<ArcadeResponse>("GET", "/games/arcade"),
  setInterest: (igdbId: number, level: InterestLevel, duration?: Duration | null) =>
    call<{ ok: true }>("PUT", `/games/${igdbId}/interest`, { level, duration }),
  clearInterest: (igdbId: number) => call<{ ok: true }>("DELETE", `/games/${igdbId}/interest`),
  adminUsers: () => call<AdminUser[]>("GET", "/admin/users"),
  adminGames: () => call<AdminGame[]>("GET", "/admin/games"),
  adminResetAvatar: (userId: string) => call<{ ok: true }>("POST", `/admin/users/${encodeURIComponent(userId)}/reset-avatar`),
  adminDeleteUser: (userId: string) => call<{ ok: true }>("DELETE", `/admin/users/${encodeURIComponent(userId)}`),
  adminDeleteGame: (igdbId: number) => call<{ ok: true }>("DELETE", `/admin/games/${igdbId}`),
  event: () => call<{ startsAt: number | null }>("GET", "/event"),
  adminSetEvent: (startsAt: number | null) => call<{ startsAt: number | null }>("PUT", "/admin/event", { startsAt }),
  adminSeasons: () => call<AdminSeason[]>("GET", "/admin/seasons"),
  adminArchive: (season: string) => call<{ ok: true; archived: number }>("POST", "/admin/archive", { season }),
  adminRestoreSeason: (season: string) => call<{ ok: true }>("POST", `/admin/seasons/${encodeURIComponent(season)}/restore`),
};
