// icon search over public/icons/index.json (built by scripts/icons.ts).
// game-icons doesn't ship tags, so we match on the words in each icon's file
// name, plus a small synonym list for the obvious searches.

export interface IconIndex {
  source: string;
  commit: string;
  authors: Record<string, { name: string; url: string | null; cc0: boolean }>;
  icons: string[]; // "author/name"
}

let loading: Promise<IconIndex> | null = null;
export function loadIconIndex() {
  loading ??= fetch("/icons/index.json").then((r) => {
    if (!r.ok) throw new Error("couldn't load icons");
    return r.json() as Promise<IconIndex>;
  });
  return loading;
}

// each key also searches for its alternates (and vice versa via the reverse map)
const SYNONYMS: Record<string, string[]> = {
  ghost: ["spooky", "spectre", "specter", "phantom", "spirit", "haunt", "wraith", "banshee", "soul"],
  skull: ["skeleton", "bone", "death", "dead", "undead", "lich"],
  cat: ["kitten", "feline", "lion", "tiger", "panther", "lynx"],
  dog: ["hound", "wolf", "puppy", "fox"],
  game: ["gamepad", "controller", "joystick", "console", "arcade", "dice"],
  controller: ["gamepad", "joystick", "console"],
  robot: ["android", "mech", "golem", "cyborg", "droid"],
  alien: ["ufo", "martian", "tentacle", "extraterrestrial"],
  space: ["planet", "rocket", "galaxy", "astronaut", "satellite", "ufo", "star"],
  magic: ["wizard", "witch", "spell", "potion", "rune", "crystal", "wand", "staff"],
  wizard: ["mage", "sorcerer", "witch", "warlock"],
  sword: ["blade", "katana", "sabre", "saber", "dagger", "rapier"],
  gun: ["pistol", "rifle", "revolver", "shotgun", "blaster"],
  fire: ["flame", "burning", "blaze", "torch", "lava"],
  water: ["wave", "drop", "splash", "ocean", "sea"],
  heart: ["love", "health"],
  king: ["crown", "throne", "royal", "queen"],
  monster: ["beast", "demon", "troll", "ogre", "goblin", "orc", "creature"],
  dragon: ["wyvern", "drake", "wyrm"],
  bird: ["owl", "eagle", "raven", "crow", "parrot", "duck", "chicken", "feather"],
  fish: ["shark", "whale", "octopus", "squid", "jellyfish", "crab"],
  food: ["burger", "pizza", "cake", "cheese", "apple", "meat", "bread", "coffee", "cupcake"],
  music: ["guitar", "drum", "piano", "violin", "note", "harp"],
  ninja: ["shuriken", "katana", "samurai"],
  pirate: ["skull", "ship", "parrot", "treasure", "flag"],
  plant: ["tree", "leaf", "flower", "mushroom", "sprout", "vine"],
  cute: ["cat", "duck", "bunny", "rabbit", "panda", "teddy"],
  car: ["racing", "race", "truck", "wheel", "motorcycle"],
  cool: ["sunglasses", "lightning", "flame"],
};

const reverse = new Map<string, Set<string>>();
for (const [k, alts] of Object.entries(SYNONYMS)) {
  for (const a of [k, ...alts]) {
    if (!reverse.has(a)) reverse.set(a, new Set());
    reverse.get(a)!.add(k);
    for (const b of alts) reverse.get(a)!.add(b);
  }
}

function alternates(token: string) {
  return [token, ...(reverse.get(token) ?? [])];
}

/** best matches first: whole-word hits, then prefix hits, then synonym/substring hits */
export function searchIcons(icons: string[], query: string, limit = 150): string[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: [number, string][] = [];
  for (const id of icons) {
    const name = id.slice(id.indexOf("/") + 1);
    const words = name.split("-");
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      let best = 0;
      if (words.includes(t)) best = 100;
      else if (words.some((w) => w.startsWith(t))) best = 60;
      else if (name.includes(t)) best = 30;
      else {
        for (const alt of alternates(t)) {
          if (alt === t) continue;
          if (words.includes(alt)) best = Math.max(best, 20);
          else if (words.some((w) => w.startsWith(alt))) best = Math.max(best, 10);
        }
      }
      if (!best) { ok = false; break; }
      score += best;
    }
    if (!ok) continue;
    score -= words.length; // shorter names (closer matches) first
    scored.push([score, id]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]));
  return scored.slice(0, limit).map(([, id]) => id);
}

export const iconLabel = (id: string) => id.slice(id.indexOf("/") + 1).replace(/-/g, " ");
