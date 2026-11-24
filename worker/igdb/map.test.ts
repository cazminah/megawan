import { describe, expect, it } from "vitest";
import raw from "./__fixtures__/game.json";
import { cleanQuery, storeLinks, toGame, toSearchHit, type RawGame } from "./map";

describe("toGame", () => {
  const game = toGame(raw as RawGame, { hastily: 180000, normally: 216000, completely: 360000 });

  it("pulls the basics through", () => {
    expect(game).toMatchObject({ igdbId: 119133, name: "Elden Ring", slug: "elden-ring", coverImageId: "co4jni", releaseYear: 2022 });
  });

  it("uses short platform names, falling back to the long one", () => {
    expect(game.platforms).toEqual(["PC", "PS5", "Series X|S", "Some Platform With No Abbrev"]);
  });

  it("dedupes genres", () => {
    expect(game.genres).toEqual(["Role-playing (RPG)", "Adventure"]);
  });

  it("takes the biggest player counts across multiplayer modes", () => {
    expect(game.onlineMax).toBe(6);
    expect(game.offlineMax).toBeNull();
    expect(game.onlineCoop).toBe(true);
    expect(game.offlineCoop).toBe(false);
  });

  it("keeps time to beat in seconds", () => {
    expect([game.ttbHastily, game.ttbNormally, game.ttbCompletely]).toEqual([180000, 216000, 360000]);
    expect(toGame(raw as RawGame).ttbNormally).toBeNull();
  });

  it("only keeps known stores, once each, https only", () => {
    expect(game.storeLinks).toEqual([
      { store: "Steam", url: "https://store.steampowered.com/app/1245620" },
      { store: "GOG", url: "https://www.gog.com/game/whatever" },
    ]);
  });
});

describe("storeLinks", () => {
  it("doesn't fall for lookalike domains", () => {
    expect(storeLinks(["https://store.steampowered.com.evil.io/x", "https://notgog.com/x"])).toEqual([]);
  });
});

describe("search", () => {
  it("toSearchHit trims to what the dropdown needs", () => {
    expect(toSearchHit(raw as RawGame)).toEqual({
      igdbId: 119133, name: "Elden Ring", coverImageId: "co4jni", releaseYear: 2022,
      platforms: ["PC", "PS5", "Series X|S", "Some Platform With No Abbrev"],
    });
  });

  it("cleanQuery can't break out of the search string", () => {
    expect(cleanQuery('halo"; fields *; where id > 0;')).toBe("halo fields * where id > 0");
    expect(cleanQuery("  a\\b  ")).toBe("a b");
    expect(cleanQuery("x".repeat(200))).toHaveLength(80);
  });
});
