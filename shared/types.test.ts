import { describe, expect, it } from "vitest";
import { hypeScore, INTEREST_LEVELS, LEVELS, type InterestLevel } from "./types";

const votes = (...ls: InterestLevel[]) => ls.map((level) => ({ level }));

describe("interest scale", () => {
  it("has five tiers, weights climbing faster than linear", () => {
    expect(LEVELS.map((l) => INTEREST_LEVELS[l].weight)).toEqual([1, 2, 3, 5, 8]);
  });

  it("hype score: two hyped beat three i'm down, but one LET'S GO doesn't beat three keen", () => {
    expect(hypeScore(votes(4, 4))).toBeGreaterThan(hypeScore(votes(2, 2, 2)));
    expect(hypeScore(votes(5))).toBeLessThan(hypeScore(votes(3, 3, 3)));
  });

  it("gets brighter with every tier (so it reads without colour)", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ls = LEVELS.map((l) => lum(INTEREST_LEVELS[l].color));
    expect(ls).toEqual([...ls].sort((a, b) => a - b));
  });
});
