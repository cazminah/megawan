import { describe, expect, it } from "vitest";
import { availabilityText, hypeScore, INTEREST_LEVELS, isAvailability, LEVELS, PALETTE_NAMES, PALETTES, sortPlatforms, type InterestLevel } from "./types";

const votes = (...ls: InterestLevel[]) => ls.map((level) => ({ level }));

describe("interest scale", () => {
  it("has five tiers, weights climbing faster than linear", () => {
    expect(LEVELS.map((l) => INTEREST_LEVELS[l].weight)).toEqual([1, 2, 3, 5, 8]);
  });

  it("hype score: two hyped beat three i'm down, but one LET'S GO doesn't beat three keen", () => {
    expect(hypeScore(votes(4, 4))).toBeGreaterThan(hypeScore(votes(2, 2, 2)));
    expect(hypeScore(votes(5))).toBeLessThan(hypeScore(votes(3, 3, 3)));
  });

  it("both palettes get brighter with every tier (so they read without colour)", () => {
    for (const name of PALETTE_NAMES) {
      const ls = PALETTES[name].map((p) => lum(p.color));
      expect(ls, name).toEqual([...ls].sort((a, b) => a - b));
    }
  });

  it("colour-blind palette keeps neighbouring tiers distinct under protan/deutan/tritan simulation", () => {
    for (const [kind, m] of Object.entries(CVD)) {
      const sim = PALETTES.colorblind.map((p) => simulate(p.color, m));
      for (let i = 1; i < sim.length; i++) expect(deltaE(sim[i - 1]!, sim[i]!), `${kind} tiers ${i}/${i + 1}`).toBeGreaterThan(8);
    }
  });

  it("every tier colour is visible on the panel (tier 1 may be dim: ≥ 2.3:1, the rest ≥ 2.8:1)", () => {
    for (const name of PALETTE_NAMES) {
      PALETTES[name].forEach((p, i) => expect(contrast(p.color, "#121935"), `${name} ${p.color}`).toBeGreaterThan(i === 0 ? 2.3 : 2.8));
    }
  });

  it("tier text colours are readable on the panel (≥ 4.5:1)", () => {
    for (const name of PALETTE_NAMES) for (const p of PALETTES[name]) expect(contrast(p.text, "#121935"), `${name} text ${p.text}`).toBeGreaterThan(4.5);
  });
});

// ---- colour maths for the tests ----
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) => [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
const lum = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
// Machado, Oliveira & Fernandes (2009), full severity, applied in linear rgb
const CVD: Record<string, number[][]> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const simulate = (hex: string, m: number[][]) => {
  const v = rgb(hex);
  return m.map((r) => Math.min(1, Math.max(0, r[0]! * v[0] + r[1]! * v[1] + r[2]! * v[2]))) as [number, number, number];
};
// distance in OKLab (×100) — roughly "how different do these look"
const oklab = ([r, g, b]: [number, number, number]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const deltaE = (a: [number, number, number], b: [number, number, number]) => {
  const x = oklab(a), y = oklab(b);
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!) * 100;
};

describe("sortPlatforms", () => {
  it("puts the common platforms first, rarer ones after a–z", () => {
    expect(sortPlatforms(["Stadia", "Series X|S", "PS4", "PC", "PS5", "XONE", "Switch"])).toEqual(["PC", "PS5", "Switch", "Series X|S", "PS4", "XONE", "Stadia"]);
    expect(sortPlatforms(["WiiU", "Linux", "Vita", "Switch 2", "Mac"])).toEqual(["Switch 2", "Mac", "Linux", "Vita", "WiiU"]);
  });
});

describe("availability", () => {
  it("names every combination", () => {
    expect([1, 2, 4, 3, 6, 5, 7].map(availabilityText)).toEqual([
      "AM only", "PM only", "evening only", "AM–PM", "PM–evening", "AM + evening", "all day",
    ]);
  });
  it("needs at least one slot, and nothing beyond the three", () => {
    expect([0, 1, 7, 8, 2.5].map(isAvailability)).toEqual([false, true, true, false, false]);
  });
});
