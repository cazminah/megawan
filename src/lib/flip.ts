// FLIP animation: when items change position, slide them from where they were
// to where they are now instead of teleporting.
//   First  — remember every item's position (from the previous render)
//   Last   — measure where it ended up
//   Invert — start it at its old spot (a transform)
//   Play   — animate the transform away
// mark items with data-flip="<stable key>" inside the container.

import { useLayoutEffect, useRef, type RefObject } from "react";

type Pos = { x: number; y: number };

/** position relative to `root`, from layout offsets — ignores running transforms */
function offsetWithin(el: HTMLElement, root: HTMLElement): Pos {
  let x = 0, y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

export function useFlip(container: RefObject<HTMLElement | null>, { duration = 350 } = {}) {
  const prev = useRef(new Map<string, Pos>());

  // runs after every render — cheap for a few dozen cards
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, Pos>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const key = el.dataset.flip!;
      const pos = offsetWithin(el, root);
      next.set(key, pos);
      const old = prev.current.get(key);
      if (!old || reduce) return;
      const dx = old.x - pos.x, dy = old.y - pos.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    });
    prev.current = next;
  });
}
