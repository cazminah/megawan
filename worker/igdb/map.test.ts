import { describe, expect, it } from "vitest";
import raw from "./__fixtures__/game.json";
import { cleanQuery, toGame, toSearchHit, type RawGame } from "./map";

describe("toGame", () => {
  const game = toGame(raw as RawGame);

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
