// builds public/icons/ from the game-icons.net repo.
//
//   npm run icons            # clones (or reuses) .cache/game-icons, then rebuilds
//
// every source icon is `<black square path><white icon path>`. we keep only the
// icon path's `d` and write a fresh svg around it — nothing else from the source
// file survives, so no stray markup/scripts can sneak through. the app paints
// icons with a css mask, so the fill colour in the output doesn't matter.
//
// output:
//   public/icons/<author>/<name>.svg
//   public/icons/index.json   { authors: {slug: {name, url, cc0}}, icons: ["author/name", ...] }

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, ".cache/game-icons");
const OUT = join(ROOT, "public/icons");
const REPO = "https://github.com/game-icons/icons.git";

const ICON_RE =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"><path d="M0 0h512v512H0z"\/><path fill="#fff" d="([^"]+)"\/><\/svg>\s*$/;
const PATH_DATA_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\se]+$/;
const SKIP_DIRS = new Set([".git", "badges"]);

if (!existsSync(SRC)) {
  console.log(`cloning ${REPO} …`);
  execFileSync("git", ["clone", "--depth", "1", REPO, SRC], { stdio: "inherit" });
}
const commit = execFileSync("git", ["-C", SRC, "rev-parse", "HEAD"]).toString().trim();

// license.txt lists contributors as "- Name, url[ - CC0]"; match them to folder slugs
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const credits = new Map<string, { name: string; url: string | null; cc0: boolean }>();
for (const line of readFileSync(join(SRC, "license.txt"), "utf8").split("\n")) {
  const m = line.match(/^- ([^,]+?)(?:,\s*(\S+))?(\s*-\s*CC0)?\s*$/);
  if (m) credits.set(norm(m[1]!), { name: m[1]!.trim(), url: m[2] ?? null, cc0: !!m[3] });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const authors: Record<string, { name: string; url: string | null; cc0: boolean }> = {};
const icons: string[] = [];
let rejected = 0;

const dirs = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name))
  .map((d) => d.name)
  .sort();

for (const author of dirs) {
  const files = readdirSync(join(SRC, author)).filter((f) => f.endsWith(".svg")).sort();
  if (!files.length) continue;
  mkdirSync(join(OUT, author), { recursive: true });
  const credit = credits.get(norm(author));
  authors[author] = credit ?? {
    name: author.replace(/-/g, " "),
    url: null,
    cc0: false,
  };
  for (const file of files) {
    const name = file.slice(0, -4);
    if (!/^[a-z0-9-]+$/.test(name)) { rejected++; continue; }
    const d = readFileSync(join(SRC, author, file), "utf8").match(ICON_RE)?.[1];
    if (!d || !PATH_DATA_RE.test(d)) { rejected++; continue; }
    writeFileSync(
      join(OUT, author, file),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`,
    );
    icons.push(`${author}/${name}`);
  }
}

writeFileSync(join(OUT, "index.json"), JSON.stringify({ source: REPO, commit, authors, icons }));
console.log(`wrote ${icons.length} icons from ${Object.keys(authors).length} authors (${rejected} rejected) @ ${commit.slice(0, 7)}`);
