export function players(g: { onlineMax: number | null; offlineMax: number | null }) {
  const parts: string[] = [];
  if (g.onlineMax && g.onlineMax > 1) parts.push(`${g.onlineMax} online`);
  if (g.offlineMax && g.offlineMax > 1) parts.push(`${g.offlineMax} local`);
  return parts.join(" · ") || null;
}

export function maxPlayers(g: { onlineMax: number | null; offlineMax: number | null }) {
  return Math.max(g.onlineMax ?? 0, g.offlineMax ?? 0) || null;
}
