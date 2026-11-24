import { describe, expect, it } from "vitest";
import type { ArcadeGame, Duration, InterestLevel } from "../../shared/types";
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, explainTokens, facet, groupGames, type Filters } from "./filters";

let n = 0;
type Vote = [string, InterestLevel, Duration?];
const game = (over: Partial<ArcadeGame> & { votes?: Vote[] }): ArcadeGame => ({
  igdbId: ++n, name: `game ${n}`, slug: "", coverImageId: null, heroImageId: null, themes: [], trailerYoutubeId: null,
  freeToPlay: false, releaseYear: 2020, summary: null, platforms: [], genres: [], gameModes: [], onlineMax: null,
  offlineMax: null, onlineCoop: false, offlineCoop: false, igdbUrl: null, addedAt: n,
  interests: (over.votes ?? [["u1", 1]]).map(([userId, level, duration]) => ({ userId, level, duration: duration ?? null, updatedAt: 0 })),
  ...over,
});

const a = game({ name: "Among Us", releaseYear: 2018, platforms: ["PC", "Switch"], genres: ["Strategy"], themes: ["Party"], onlineMax: 15, freeToPlay: true, gameModes: ["Multiplayer"], votes: [["u1", 5, { min: 0, max: 0 }], ["u2", 5]] });
const b = game({ name: "Baldur's Gate 3", releaseYear: 2023, platforms: ["PC"], genres: ["Adventure", "Role-playing (RPG)"], themes: ["Fantasy"], onlineMax: 4, onlineCoop: true, gameModes: ["Single player", "Co-operative"], votes: [["u1", 1, { min: 2, max: 2 }], ["u2", 1], ["u3", 1]] });
const c = game({ name: "Celeste", releaseYear: 2018, platforms: ["Switch"], genres: ["Platform", "Indie"], gameModes: ["Single player"], votes: [["u2", 2]] });
const d = game({ name: "Overcooked 2", releaseYear: 2018, platforms: ["Switch", "PS5"], genres: ["Simulator"], themes: ["Party", "Comedy"], offlineMax: 4, offlineCoop: true, gameModes: ["Co-operative", "Split screen"], votes: [["u3", 5, { min: 0, max: 1 }]] });
const all = [a, b, c, d];
const names = (gs: ArcadeGame[]) => gs.map((g) => g.name);
const run = (f: Partial<Filters>, me = "u1") => names(applyFilters(all, { ...DEFAULT_FILTERS, ...f }, me));

describe("sorting", () => {
  it("most hyped: a LET'S GO beats a pile of eh, sure", () => {
    expect(run({})).toEqual(["Among Us", "Overcooked 2", "Baldur's Gate 3", "Celeste"]);
  });
  it("most people, release year, a–z", () => {
    expect(run({ sort: "people" })[0]).toBe("Baldur's Gate 3");
    expect(run({ sort: "year" })[0]).toBe("Baldur's Gate 3");
    expect(run({ sort: "az" })).toEqual(["Among Us", "Baldur's Gate 3", "Celeste", "Overcooked 2"]);
  });
});

describe("find in the arcade", () => {
  it("matches every word against name, year, platform, genre, theme or mode", () => {
    expect(run({ text: "2018 switch", sort: "az" })).toEqual(["Among Us", "Celeste", "Overcooked 2"]);
    expect(run({ text: "party switch", sort: "az" })).toEqual(["Among Us", "Overcooked 2"]);
    expect(run({ text: "rpg" })).toEqual(["Baldur's Gate 3"]);
    expect(run({ text: "co-op", sort: "az" })).toEqual(["Baldur's Gate 3", "Overcooked 2"]);
    expect(run({ text: "BALDUR" })).toEqual(["Baldur's Gate 3"]);
    expect(run({ text: "f2p" })).toEqual(["Among Us"]);
  });
  it("a year only ever matches a release year", () => {
    expect(run({ text: "2023" })).toEqual(["Baldur's Gate 3"]);
    expect(run({ text: "1999" })).toEqual([]);
  });
  it("explains what each word is read as", () => {
    expect(explainTokens(all, "2018 switch party zzz")).toEqual([
      { token: "2018", kind: "year" },
      { token: "switch", kind: "platform" },
      { token: "party", kind: "theme" },
      { token: "zzz", kind: null },
    ]);
  });
});

describe("filters", () => {
  it("platform / genre (short names) / theme match any", () => {
    expect(run({ platforms: ["PS5", "PC"], sort: "az" })).toEqual(["Among Us", "Baldur's Gate 3", "Overcooked 2"]);
    expect(run({ genres: ["RPG"] })).toEqual(["Baldur's Gate 3"]);
    expect(run({ themes: ["Comedy"] })).toEqual(["Overcooked 2"]);
  });
  it("works for N players (online counts only), and game modes", () => {
    expect(run({ players: 8 })).toEqual(["Among Us"]);
    expect(run({ players: 4, sort: "az" })).toEqual(["Among Us", "Baldur's Gate 3"]); // overcooked's 4 are local only
    expect(run({ gameModes: ["Split screen"] })).toEqual(["Overcooked 2"]);
    expect(run({ gameModes: ["Co-operative"], sort: "az" })).toEqual(["Baldur's Gate 3", "Overcooked 2"]);
  });
  it("duration fits: someone's up for that long", () => {
    expect(run({ duration: 0, sort: "az" })).toEqual(["Among Us", "Overcooked 2"]);
    expect(run({ duration: 2 })).toEqual(["Baldur's Gate 3"]);
  });
  it("games everyone picked is in on", () => {
    expect(run({ people: ["u2", "u3"] })).toEqual(["Baldur's Gate 3"]);
  });
  it("min headcount, my vote, free-to-play", () => {
    expect(run({ minHeadcount: 2, sort: "az" })).toEqual(["Among Us", "Baldur's Gate 3"]);
    expect(run({ myVote: "not-voted", sort: "az" })).toEqual(["Celeste", "Overcooked 2"]);
    expect(run({ myVote: "voted", sort: "az" })).toEqual(["Among Us", "Baldur's Gate 3"]);
    expect(run({ freeToPlay: true })).toEqual(["Among Us"]);
  });
  it("counts active filters (not text/sort/group)", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, text: "x", sort: "az", groupBy: "genre" })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, platforms: ["PC"], gameModes: ["Co-operative"], duration: 1, freeToPlay: true })).toBe(4);
  });
});

describe("grouping", () => {
  const sorted = applyFilters(all, DEFAULT_FILTERS, "u1");
  it("by genre: one group per primary genre, biggest first", () => {
    const gs = groupGames(sorted, "genre");
    expect(gs.map((g) => g.label).sort()).toEqual(["Platform", "RPG", "Simulator", "Strategy"]);
    expect(gs.flatMap((g) => g.games)).toHaveLength(4);
  });
  it("by group size, in size order", () => {
    expect(groupGames(sorted, "size").map((g) => [g.label, names(g.games)])).toEqual([
      ["solo", ["Celeste"]],
      ["2–4 players", ["Baldur's Gate 3"]],
      ["9+ players", ["Among Us"]],
      ["group size unknown", ["Overcooked 2"]],
    ]);
  });
  it("by keenness: top vote, keenest first", () => {
    expect(groupGames(sorted, "keenness").map((g) => g.level)).toEqual([5, 2, 1]);
  });
});

describe("facet", () => {
  it("lists values most-common first", () => {
    expect(facet(all, (g) => g.platforms)).toEqual(["Switch", "PC", "PS5"]);
  });
});
