import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dragonFront from "../assets/characters/dragon-front.webp";
import { useCharacterStage } from "../character/characterStageContext";
import { useCharacterSprite } from "../character/useCharacterSprite";
import "./Character.css";

// Placeholder reactions until Nanda's face/head expression art is ready.
const LINES = ["Halo!", "Yuk kenalan sama tamu lain!", "Hehe, geli!", "Jangan lupa cek agenda ya!", "Seru banget di sini!"];
const BUBBLE_MS = 2200;

type CharacterProps = {
  /** A line the character keeps saying (e.g. on RSVP). Tap reactions still override it briefly. */
  say?: string;
};

/**
 * Figma: Illustration/Character — Nanda's dragon mascot. Tap for a reaction.
 *
 * Three ways this renders, in order of preference:
 *  1. the live 3D character, when CharacterStage has the scene ready and this
 *     is the slot on screen;
 *  2. the sprite captured on /karakter, so the guest's own outfit still shows;
 *  3. the bundled art.
 *
 * It always paints 2 or 3 first — the 3D swaps in once loaded, so no screen
 * ever waits on it. Outside the guest tree (admin) the stage is a no-op and
 * Spline is never pulled in.
 */
export function Character({ say }: CharacterProps) {
  const sprite = useCharacterSprite();
  const boxRef = useRef<HTMLButtonElement>(null);
  const { claim, activeSlot, status } = useCharacterStage();
  const slotRef = useRef<HTMLSpanElement>(null);
  const [line, setLine] = useState<string | null>(null);
  const [bounce, setBounce] = useState(0);
  const lineIndex = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Ask for the shared canvas. The newest slot wins, so navigating hands the
  // 3D character to the screen the guest just arrived on.
  useEffect(() => {
    const el = slotRef.current;
    if (!el || status !== "ready") return;
    return claim(el);
  }, [claim, status]);

  /**
   * Replays the hop on every tap.
   *
   * The 2D sprite restarts it by remounting (`key={bounce}`), which the slot
   * cannot do: remounting it would drop the shared canvas out of the DOM, and
   * the claim effect does not re-run while `status` stays "ready", so the 3D
   * character would never come back. The class alone is not enough either --
   * it is already there from the first tap, and a class that does not change
   * never replays its animation.
   *
   * Rewinding it with getAnimations() did not work past the first tap: once
   * a CSS animation finishes, the browser drops it, so from the second tap on
   * there was nothing left to rewind. Taking the class off, forcing a style
   * recalc, and putting it back starts a fresh animation every time.
   *
   * Under `prefers-reduced-motion` the class carries no animation, so this
   * does nothing visible, which is the point.
   */
  useEffect(() => {
    const slot = slotRef.current;
    if (!bounce || !slot) return;
    slot.classList.remove("is-bouncing");
    void slot.offsetWidth;
    slot.classList.add("is-bouncing");
  }, [bounce]);

  const is3D = status === "ready" && activeSlot !== null && activeSlot === slotRef.current;

  const react = () => {
    setLine(LINES[lineIndex.current++ % LINES.length]);
    setBounce((b) => b + 1);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLine(null), BUBBLE_MS);
  };

  const shown = line ?? say;
  const anchor = useBubbleAnchor(boxRef, !!shown);
  return (
    <button ref={boxRef} type="button" className="character" onClick={react} aria-label="Sapa karaktermu">
      {/*
       * The bubble lives on <body>, above every card: inside the character
       * it sat under the room screen's header and agenda card, which are
       * layered above the character so its box never blocks their taps.
       */}
      {shown &&
        anchor &&
        createPortal(
          <span className="character__bubble-anchor" style={{ left: anchor.x, top: anchor.y }}>
            <span key={shown} className="character__bubble clay clay-light t-p-h4-bold" role="status">
              {shown}
            </span>
          </span>,
          document.body,
        )}
      <span className="character__shadow" aria-hidden="true" />
      {/* Kept empty for React: CharacterStage appends the canvas here itself. */}
      <span ref={slotRef} className={`character__slot${is3D && bounce ? " is-bouncing" : ""}`} />
      {!is3D && (
        <img
          key={bounce}
          className={`character__img${bounce ? " is-bouncing" : ""}`}
          src={sprite ?? dragonFront}
          alt=""
          width={211}
          height={340}
          draggable={false}
        />
      )}
    </button>
  );
}

/**
 * Where the bubble points: centred over the character, on top of its head.
 *
 * The head is not the top of the box. The 3D canvas is moved down so the feet
 * meet the floor, and the scene leaves room above the horns; CharacterStage
 * measures both and leaves the result in --head-gap on the box. Without the
 * 3D character it is unset, and the top of the tightly cropped sprite is the
 * head. Re-read while the bubble is up, because the measurement lands a moment
 * after the scene does, and the page can scroll or resize under it.
 */
function useBubbleAnchor(box: React.RefObject<HTMLElement | null>, shown: boolean) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const head = parseFloat(getComputedStyle(el).getPropertyValue("--head-gap")) || 0;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + head);
      setAnchor((a) => (a && a.x === x && a.y === y ? a : { x, y }));
    };
    place();
    const timer = window.setInterval(place, 500);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [box, shown]);
  return anchor;
}
