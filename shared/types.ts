// shapes shared by the worker and the react app

export type InterestLevel = 1 | 2 | 3;

export const INTEREST_LEVELS: Record<
  InterestLevel,
  { label: string; short: string; color: string }
> = {
  3: { label: "must play or i'll perish", short: "perish", color: "#ff4fa3" },
  2: { label: "keen", short: "keen", color: "#a05cff" },
  1: { label: "if nothing better's on", short: "maybe", color: "#4aa8ff" },
};

// 18 icon colours, all bright enough to pop on the navy avatar background
export const ICON_COLORS = [
  "#ff4fa3", "#ff6b6b", "#ff8c42", "#ffb627", "#ffe066", "#c6f432",
  "#6be675", "#2ee6a8", "#3ddbd9", "#4aa8ff", "#6d8bff", "#a05cff",
  "#d36bff", "#ff9ce0", "#f5f5f5", "#ffd6a5", "#b0c4de", "#c9a227",
] as const;

export const AVATAR_BG = "#141a33";

export type Avatar =
  | { kind: "upload"; key: string }
  | { kind: "icon"; icon: string; color: string };

export interface PublicUser {
  id: string;
  username: string;
  avatar: Avatar;
}

export interface Me extends PublicUser {
  email: string | null;
}

export interface StoreLink {
  store: string;
  url: string;
}

export interface Game {
  igdbId: number;
  name: string;
  slug: string;
  coverImageId: string | null;
  releaseYear: number | null;
  summary: string | null;
  platforms: string[];
  genres: string[];
  gameModes: string[];
  onlineMax: number | null;
  offlineMax: number | null;
  onlineCoop: boolean;
  offlineCoop: boolean;
  ttbHastily: number | null; // seconds
  ttbNormally: number | null;
  ttbCompletely: number | null;
  storeLinks: StoreLink[];
  igdbUrl: string | null;
}

export interface SearchHit {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
  platforms: string[];
}

export interface ArcadeInterest {
  userId: string;
  level: InterestLevel;
  updatedAt: number;
}

export interface ArcadeGame extends Game {
  addedAt: number; // first time anyone rated it
  interests: ArcadeInterest[];
}

export interface ArcadeResponse {
  games: ArcadeGame[];
  users: Record<string, PublicUser>;
}

export function coverUrl(imageId: string | null, size: "cover_big" | "cover_small" | "thumb" | "720p" = "cover_big") {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null;
}

export function hypeScore(interests: { level: InterestLevel }[]) {
  // pink counts a lot more than blue — a "perish" vote is worth ~3 "maybes"
  const weight = { 1: 1, 2: 2, 3: 4 } as const;
  return interests.reduce((sum, i) => sum + weight[i.level], 0);
}

export const USERNAME_RE = /^[a-z0-9_-]{3,24}$/;

// starter icons handed out at random on sign-up (all verified to exist in public/icons)
export const DEFAULT_ICONS = [
  "lorc/ghost", "delapouite/floating-ghost", "lorc/dragon-head", "lorc/crowned-skull",
  "delapouite/game-console", "delapouite/gamepad", "lorc/robot-golem", "lorc/wizard-staff",
  "lorc/mushroom-gills", "lorc/fox-head", "lorc/octopus", "lorc/alien-skull",
  "lorc/pirate-skull", "delapouite/joystick", "lorc/ninja-mask", "lorc/bubbling-flask",
  "lorc/crown", "lorc/crystal-ball", "delapouite/duck", "lorc/beast-eye", "lorc/snail",
  "lorc/cat", "lorc/frog", "lorc/owl", "delapouite/ufo", "delapouite/wizard-face",
  "skoll/retro-controller", "delapouite/plastic-duck",
] as const;

export function randomAvatar(): Avatar {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;
  return { kind: "icon", icon: pick(DEFAULT_ICONS), color: pick(ICON_COLORS) };
}

export const ICON_NAME_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/;

export function avatarUrl(a: Avatar) {
  return a.kind === "upload" ? `/avatars/${a.key}` : `/icons/${a.icon}.svg`;
}
