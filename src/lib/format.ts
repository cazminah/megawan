export function hours(seconds: number | null) {
  if (!seconds) return null;
  const h = seconds / 3600;
  if (h < 1) return "<1h";
  return h < 10 ? `${Math.round(h * 2) / 2}h` : `${Math.round(h)}h`;
}

export function players(g: { onlineMax: number | null; offlineMax: number | null }) {
  const parts: string[] = [];
  if (g.onlineMax && g.onlineMax > 1) parts.push(`${g.onlineMax} online`);
  if (g.offlineMax && g.offlineMax > 1) parts.push(`${g.offlineMax} local`);
  return parts.join(" · ") || null;
}

export function maxPlayers(g: { onlineMax: number | null; offlineMax: number | null }) {
  return Math.max(g.onlineMax ?? 0, g.offlineMax ?? 0) || null;
}
