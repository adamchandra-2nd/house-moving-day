import { useEffect, useRef, useState } from "react";

/** Measures an element's height (for the rundown timeline to fit its panel exactly). */
export function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, h] as const;
}

/** Room tone helpers (admin room colours). */
export const roomStyle = (roomId: string) =>
  ({ "--room": `var(--room-${roomId})`, "--room-bg": `var(--room-${roomId}-bg)` }) as React.CSSProperties;
