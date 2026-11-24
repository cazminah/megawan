import { describe, expect, it } from "vitest";
import { playersLong, playersShort, primaryGenre } from "./format";

const g = (o: Partial<Parameters<typeof playersShort>[0]>) => ({
  onlineMax: null, offlineMax: null, onlineCoop: false, offlineCoop: false, gameModes: [] as string[], ...o,
});

describe("players", () => {
  it("shows a range when IGDB has counts", () => {
    expect(playersShort(g({ onlineMax: 4, gameModes: ["Single player", "Multiplayer"] }))).toEqual({ text: "1–4", solo: false });
    expect(playersShort(g({ onlineMax: 10, offlineMax: 4, gameModes: ["Multiplayer"] }))).toEqual({ text: "2–10", solo: false });
  });

  it("falls back to the mode when there are no counts", () => {
    expect(playersShort(g({ gameModes: ["Single player", "Co-operative"] }))?.text).toBe("co-op");
    expect(playersShort(g({ gameModes: ["Multiplayer"] }))?.text).toBe("multiplayer");
    expect(playersShort(g({ gameModes: ["Massively Multiplayer Online (MMO)", "Multiplayer"] }))?.text).toBe("MMO");
    expect(playersShort(g({ gameModes: ["Single player"] }))).toEqual({ text: "1", solo: true });
    expect(playersShort(g({}))).toBeNull();
  });

  it("spells it out for the detail view, never as 'N online'", () => {
    const long = playersLong(g({ onlineMax: 4, offlineMax: 2, onlineCoop: true, gameModes: ["Single player", "Co-operative", "Split screen"] }));
    expect(long).toBe("1–4 players · up to 4 online · up to 2 local · co-op · split screen");
    expect(playersLong(g({ gameModes: ["Single player"] }))).toBe("single player");
  });
});

describe("primaryGenre", () => {
  it("skips Indie / Adventure when there's something more specific, and shortens names", () => {
    expect(primaryGenre({ genres: ["Adventure", "Indie", "Shooter"] })).toBe("Shooter");
    expect(primaryGenre({ genres: ["Role-playing (RPG)", "Adventure"] })).toBe("RPG");
    expect(primaryGenre({ genres: ["Indie"] })).toBe("Indie");
    expect(primaryGenre({ genres: [] })).toBeNull();
  });
});
