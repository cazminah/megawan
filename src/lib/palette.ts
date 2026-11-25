// colour mode: which tier palette is active. the choice lives on this device
// (so it works on the register screen, before there's an account) and on the
// account (so it follows you to other devices). either way it just sets css
// variables, so everything re-colours instantly.

import { useSyncExternalStore } from "react";
import { PALETTES, isPalette, type PaletteName } from "../../shared/types";

const KEY = "mw:palette";
let current: PaletteName = "default";
const listeners = new Set<() => void>();

function readStored(): PaletteName {
  try {
    const v = localStorage.getItem(KEY);
    return isPalette(v) ? v : "default";
  } catch {
    return "default";
  }
}

export function applyPalette(name: PaletteName) {
  current = name;
  const root = document.documentElement;
  PALETTES[name].forEach((p, i) => {
    root.style.setProperty(`--tier-${i + 1}`, p.color);
    root.style.setProperty(`--tier-${i + 1}-text`, p.text);
  });
  root.dataset.palette = name;
  try { localStorage.setItem(KEY, name); } catch { /* private mode — fine */ }
  listeners.forEach((l) => l());
}

export const currentPalette = () => current;

export function usePalette() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}

// apply straight away on load, before anything renders
applyPalette(readStored());
