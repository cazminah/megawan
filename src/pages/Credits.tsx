import { useEffect, useState } from "react";
import { loadIconIndex, type IconIndex } from "../lib/icons";

export function Credits() {
  const [index, setIndex] = useState<IconIndex | null>(null);
  useEffect(() => void loadIconIndex().then(setIndex).catch(() => {}), []);
  const counts = new Map<string, number>();
  for (const id of index?.icons ?? []) {
    const a = id.slice(0, id.indexOf("/"));
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const authors = Object.entries(index?.authors ?? {}).sort((a, b) => (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0));

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-dim">
      <h1 className="font-display text-3xl font-bold text-ink">credits</h1>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink">game data</h2>
        <p>
          game names, artwork, platforms and player counts come from{" "}
          <a className="text-keen hover:underline" href="https://www.igdb.com" target="_blank" rel="noopener noreferrer">IGDB</a>.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink">interface icons</h2>
        <p>
          interest-scale and ui icons are{" "}
          <a className="text-keen hover:underline" href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer">Material Symbols</a>{" "}
          by Google, used under the{" "}
          <a className="text-keen hover:underline" href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache License 2.0</a>.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink">avatar icons</h2>
        <p>
          icons from{" "}
          <a className="text-keen hover:underline" href="https://game-icons.net" target="_blank" rel="noopener noreferrer">game-icons.net</a>,
          used under{" "}
          <a className="text-keen hover:underline" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>{" "}
          (some are CC0). thank you, icon wizards:
        </p>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {authors.map(([slug, a]) => (
            <li key={slug} className="flex justify-between gap-3">
              {a.url ? (
                <a className="text-ink hover:text-keen" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
              ) : (
                <span className="text-ink">{a.name}</span>
              )}
              <span className="text-faint">{counts.get(slug) ?? 0}{a.cc0 ? " · CC0" : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
