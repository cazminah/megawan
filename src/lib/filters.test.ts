import { describe, expect, it } from "vitest";
import type { ArcadeGame, InterestLevel } from "../../shared/types";
import { applyFilters, DEFAULT_FILTERS, facet } from "./filters";

let n = 0;
const game = (over: Partial<ArcadeGame> & { votes?: [string, InterestLevel][] }): ArcadeGame => ({
  igdbId: ++n, name: `game ${n}`, slug: "", coverImageId: null, releaseYear: 2020, summary: null,
  platforms: [], genres: [], gameModes: [], onlineMax: null, offlineMax: null, onlineCoop: false, offlineCoop: false,
  igdbUrl: null, addedAt: n,
  interests: (over.votes ?? [["u1", 1]]).map(([userId, level]) => ({ userId, level, updatedAt: 0 })),
  ...over,
});

const a = game({ name: "Among Us", platforms: ["PC", "Switch"], onlineMax: 15, votes: [["u1", 3], ["u2", 3]] });
const b = game({ name: "Baldur's Gate 3", platforms: ["PC"], onlineMax: 4, onlineCoop: true, votes: [["u1", 1], ["u2", 1], ["u3", 1]] });
const c = game({ name: "Celeste", platforms: ["Switch"], votes: [["u2", 2]] });
const d = game({ name: "Overcooked 2", platforms: ["Switch", "PS5"], offlineMax: 4, offlineCoop: true, votes: [["u3", 3]] });
const all = [a, b, c, d];
const names = (gs: ArcadeGame[]) => gs.map((g) => g.name);

describe("applyFilters", () => {
  it("sorts by hype — pink beats a pile of blue", () => {
    expect(names(applyFilters(all, DEFAULT_FILTERS, "u1"))).toEqual(["Among Us", "Overcooked 2", "Baldur's Gate 3", "Celeste"]);
  });

  it("sorts by headcount", () => {
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, sort: "people" }, "u1"))[0]).toBe("Baldur's Gate 3");
  });

  it("filters by platform (any of)", () => {
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, platforms: ["PS5", "PC"], sort: "az" }, "u1"))).toEqual(["Among Us", "Baldur's Gate 3", "Overcooked 2"]);
  });

  it("filters by multiplayer type", () => {
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, multi: "local" }, "u1"))).toEqual(["Overcooked 2"]);
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, multi: "coop", sort: "az" }, "u1"))).toEqual(["Baldur's Gate 3", "Overcooked 2"]);
  });

  it("filters by group size", () => {
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, minPlayers: 8 }, "u1"))).toEqual(["Among Us"]);
  });

  it("hides games i've already rated", () => {
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, unratedByMe: true, sort: "az" }, "u1"))).toEqual(["Celeste", "Overcooked 2"]);
  });

  it("text search is case-insensitive", () => {
    expect(names(applyFilters(all, { ...DEFAULT_FILTERS, text: "BALDUR" }, "u1"))).toEqual(["Baldur's Gate 3"]);
  });
});

describe("facet", () => {
  it("lists values most-common first", () => {
    expect(facet(all, (g) => g.platforms)).toEqual(["Switch", "PC", "PS5"]);
  });
});
