// shapes shared by the worker and the react app

export type InterestLevel = 1 | 2 | 3 | 4 | 5;
export const LEVELS: InterestLevel[] = [1, 2, 3, 4, 5]; // least → most keen

// an OKLCH ramp: lightness climbs 52% → 92% while the hue goes blue → purple →
// pink → coral → yellow, so brightness alone tells you how keen. `text` is the
// colour for words — tier 1's blue is too dim for text (3.1:1), so it uses the
// normal dim text colour instead.
export const INTEREST_LEVELS: Record<
  InterestLevel,
  { label: string; color: string; text: string; icon: InterestIconName; weight: number }
> = {
  1: { label: "eh, sure", color: "#4c689d", text: "#9aa3d6", icon: "neutral", weight: 1 },
  2: { label: "i'm down", color: "#816dd2", text: "#816dd2", icon: "thumb", weight: 2 },
  3: { label: "keen", color: "#dc5dd4", text: "#dc5dd4", icon: "heart", weight: 3 },
  4: { label: "hyped", color: "#ff7b74", text: "#ff7b74", icon: "fire", weight: 5 },
  5: { label: "LET'S GO", color: "#ffde79", text: "#ffde79", icon: "rocket", weight: 8 },
};

export type InterestIconName = "neutral" | "thumb" | "heart" | "fire" | "rocket" | "skull";

// how long someone's up for, per game. stored as indexes (0–2), so the labels
// can change freely. `hint` is the small text after the label.
export const DURATIONS = [
  { label: "a bit", hint: "~1h", icon: "coffee" },
  { label: "few hours", hint: "", icon: "pizza" },
  { label: "all day", hint: "", icon: "moon" },
] as const;
export interface Duration { min: number; max: number } // indexes into DURATIONS, min <= max

export function durationLabel(d: Duration) {
  const a = DURATIONS[d.min], b = DURATIONS[d.max];
  if (!a || !b) return "";
  return d.min === d.max ? a.label : `${a.label} to ${b.label}`;
}

export const isLevel = (n: unknown): n is InterestLevel => LEVELS.includes(n as InterestLevel);

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
  isAdmin: boolean;
}

export interface AdminUser extends PublicUser {
  email: string | null;
  isAdmin: boolean;
  createdAt: number;
  votes: number;
}

export interface AdminGame {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  addedAt: number;
  votes: number;
}

export interface Game {
  igdbId: number;
  name: string;
  slug: string;
  coverImageId: string | null;
  heroImageId: string | null; // a wide image (artwork, else screenshot) for the card
  releaseYear: number | null;
  summary: string | null;
  platforms: string[];
  genres: string[];
  themes: string[]; // IGDB themes: Party, Comedy, Horror, Survival…
  gameModes: string[]; // Single player, Multiplayer, Co-operative, Split screen, MMO, Battle Royale
  onlineMax: number | null;
  offlineMax: number | null;
  onlineCoop: boolean;
  offlineCoop: boolean;
  igdbUrl: string | null;
  trailerYoutubeId: string | null;
  freeToPlay: boolean;
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
  duration: Duration | null;
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
  // weights grow faster than linear (1·2·3·5·8): two "hyped" beat three "i'm down",
  // but one "LET'S GO" doesn't beat three "keen"
  return interests.reduce((sum, i) => sum + INTEREST_LEVELS[i.level].weight, 0);
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
