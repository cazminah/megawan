// renders public/og.png — the 1200×630 image slack/discord show when the link
// is pasted. one-off: re-run after changing the design, then commit the png.
//
//   npm run og        (needs Google Chrome installed; uses a throwaway profile)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INTEREST_LEVELS, LEVELS } from "../shared/types";
import { PATHS } from "../src/lib/iconPaths";

const ROOT = new URL("..", import.meta.url).pathname;
const WORK = join(ROOT, ".cache/og");
mkdirSync(WORK, { recursive: true });

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);
if (!CHROME) throw new Error("couldn't find Google Chrome");

const icon = (d: string, color: string, size: number) =>
  `<svg viewBox="0 -960 960 960" width="${size}" height="${size}"><path d="${d}" fill="${color}"/></svg>`;

const tiers = LEVELS.map((l) => {
  const t = INTEREST_LEVELS[l];
  const on = l === 5;
  return `<div class="tier">
    <div class="ring" style="border-color:${t.color};${on ? `background:${t.color};box-shadow:0 0 40px ${t.color}aa;` : ""}">${icon(PATHS[t.icon], on ? "#0b1020" : t.color, 44)}</div>
    <div class="lbl" style="color:${t.text}">${t.label}</div>
  </div>`;
}).join("");
const track = LEVELS.map((l) => INTEREST_LEVELS[l].color).join(",");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Inter:wght@500&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#0b1020;color:#e8ebff;font-family:Inter,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 96px;position:relative;overflow:hidden}
  body::before{content:"";position:absolute;inset:-200px -100px auto auto;width:700px;height:700px;background:radial-gradient(circle,#a05cff33,transparent 65%)}
  h1{font-family:"Chakra Petch",sans-serif;font-size:148px;line-height:1;letter-spacing:-3px;background:linear-gradient(90deg,#4aa8ff,#a05cff,#ff4fa3);-webkit-background-clip:text;color:transparent;position:relative}
  p{font-size:38px;color:#9aa3d6;margin-top:18px;position:relative}
  .scale{position:relative;display:flex;justify-content:space-between;width:820px;margin-top:64px}
  .scale::before{content:"";position:absolute;left:44px;right:44px;top:42px;height:6px;border-radius:3px;background:linear-gradient(90deg,${track});opacity:.6}
  .tier{display:flex;flex-direction:column;align-items:center;gap:12px;position:relative;width:120px}
  .ring{width:88px;height:88px;border-radius:50%;border:4px solid;background:#0b1020;display:grid;place-items:center}
  .lbl{font-size:24px;font-weight:500;white-space:nowrap}
</style></head><body>
  <h1>megaWAN</h1>
  <p>pick the games. find your squad. get hyped.</p>
  <div class="scale">${tiers}</div>
</body></html>`;

const page = join(WORK, "og.html");
writeFileSync(page, html);
const out = join(ROOT, "public/og.png");
execFileSync(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${join(WORK, "chrome-profile")}`,
  "--window-size=1200,630", "--virtual-time-budget=4000",
  `--screenshot=${out}`, `file://${page}`,
], { stdio: "inherit" });
console.log(`wrote ${out}`);
