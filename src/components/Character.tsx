import { useEffect, useRef, useState } from "react";
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
  return (
    <button type="button" className="character" onClick={react} aria-label="Sapa karaktermu">
      {shown && (
        <span key={shown} className="character__bubble clay clay-light t-p-h4-bold" role="status">
          {shown}
        </span>
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
