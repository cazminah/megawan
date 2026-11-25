import { describe, expect, it } from "vitest";
import { durationLabel } from "../../shared/types";
import type { ArcadeGame } from "../../shared/types";
import { buildArchive, interestBody } from "./games";

describe("interest body", () => {
  it("takes a level alone, or with a duration range, or a null to clear", () => {
    expect(interestBody.safeParse({ level: 3 }).success).toBe(true);
    expect(interestBody.safeParse({ level: 5, duration: { min: 0, max: 2 } }).success).toBe(true);
    expect(interestBody.safeParse({ level: 2, duration: null }).success).toBe(true);
  });

  it("refuses bad levels and back-to-front or out-of-range durations", () => {
    expect(interestBody.safeParse({ level: 0 }).success).toBe(false);
    expect(interestBody.safeParse({ level: 6 }).success).toBe(false);
    expect(interestBody.safeParse({ level: 3, duration: { min: 2, max: 1 } }).success).toBe(false);
    expect(interestBody.safeParse({ level: 3, duration: { min: 0, max: 3 } }).success).toBe(false);
  });
});

describe("durationLabel", () => {
  it("reads naturally for a single value and a range", () => {
    expect(durationLabel({ min: 0, max: 0 })).toBe("a bit");
    expect(durationLabel({ min: 2, max: 2 })).toBe("all day");
    expect(durationLabel({ min: 0, max: 1 })).toBe("a bit to few hours");
    expect(durationLabel({ min: 1, max: 2 })).toBe("few hours to all day");
  });
});

describe("buildArchive", () => {
  const game = (igdbId: number, voted = false) =>
    [igdbId, { igdbId, name: `g${igdbId}`, interests: voted ? [{ userId: "u9", level: 3, duration: null, updatedAt: 0 }] : [] } as unknown as ArcadeGame] as const;
  const row = (season: string, gameId: number, userId: string, archivedAt: number, level = 2) =>
    ({ season, gameId, userId, level, durationMin: null, durationMax: null, archivedAt });

  it("shows each game once, under its latest season, newest season first", () => {
    const byGame = new Map([game(1), game(2)]);
    const out = buildArchive(byGame, [row("2025", 1, "a", 100), row("2026", 1, "b", 200), row("2025", 2, "a", 100)]);
    expect(out.map((s) => [s.season, s.games.map((g) => g.igdbId)])).toEqual([["2026", [1]], ["2025", [2]]]);
    expect(out[0]!.games[0]!.interests.map((i) => i.userId)).toEqual(["b"]); // only that season's votes
  });

  it("hides games that have votes this time round", () => {
    const byGame = new Map([game(1, true), game(2)]);
    expect(buildArchive(byGame, [row("2025", 1, "a", 100), row("2025", 2, "a", 100)])[0]!.games.map((g) => g.igdbId)).toEqual([2]);
  });
});
