import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ICONS } from "../../shared/types";
import { searchIcons, type IconIndex } from "./icons";

const index = JSON.parse(readFileSync(new URL("../../public/icons/index.json", import.meta.url), "utf8")) as IconIndex;

describe("icon index", () => {
  it("has the whole set", () => {
    expect(index.icons.length).toBeGreaterThan(4000);
  });

  it("contains every default sign-up icon", () => {
    const all = new Set(index.icons);
    expect(DEFAULT_ICONS.filter((i) => !all.has(i))).toEqual([]);
  });
});

describe("searchIcons", () => {
  it("finds ghosts, exact name first", () => {
    const hits = searchIcons(index.icons, "ghost");
    expect(hits.length).toBeGreaterThan(3);
    expect(hits[0]).toBe("lorc/ghost");
    expect(hits.every((h) => h.includes("ghost") || /spooky|spectre|specter|phantom|spirit|haunt|wraith|banshee|soul/.test(h))).toBe(true);
  });

  it("uses synonyms when the word itself is rare", () => {
    expect(searchIcons(index.icons, "zzqxv")).toEqual([]); // nonsense → no false hits
    expect(searchIcons(index.icons, "spooky")).toContain("lorc/ghost"); // via the ghost synonyms
    expect(searchIcons(index.icons, "controller").some((h) => h.includes("gamepad"))).toBe(true);
  });

  it("needs every word to match", () => {
    const hits = searchIcons(index.icons, "dragon head");
    expect(hits).toContain("lorc/dragon-head");
    expect(hits.every((h) => h.includes("dragon") || /wyvern|drake|wyrm/.test(h))).toBe(true);
  });

  it("empty query → nothing", () => {
    expect(searchIcons(index.icons, "  ")).toEqual([]);
  });
});
