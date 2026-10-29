import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import "./DoorOpen.css";

const STEPS_MS = { tap: 500, unlock: 1300, open: 1900, done: 3200 };

/** Keycard door animation: card taps the reader, light turns green, doors slide open into the office. */
export function DoorOpen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"idle" | "tap" | "unlock" | "open">("idle");
  useEffect(() => {
    const t = [
      window.setTimeout(() => setStep("tap"), STEPS_MS.tap),
      window.setTimeout(() => setStep("unlock"), STEPS_MS.unlock),
      window.setTimeout(() => setStep("open"), STEPS_MS.open),
      window.setTimeout(onDone, STEPS_MS.done),
    ];
    return () => t.forEach(clearTimeout);
  }, [onDone]);

  return (
    <main className={`door door--${step}`} onClick={onDone} aria-label="Pintu Potara terbuka. Tap untuk lanjut.">
      <div className="door__frame">
        <div className="door__light" />
        <div className="door__panel door__panel--left clay clay-light" />
        <div className="door__panel door__panel--right clay clay-light" />
        <div className="door__reader clay clay-dark">
          <span className="door__led" />
        </div>
      </div>
      <div className="door__card clay clay-accent">
        <Icon name="KeyCard" size={20} />
        <span className="t-p-h5-bold">POTARA</span>
      </div>
      <p className="door__caption t-p-h4-bold" aria-live="polite">
        {step === "open" ? "Selamat datang di rumah baru!" : step === "unlock" ? "Akses diterima" : "Membuka pintu…"}
      </p>
      <span className="door__skip t-p-h5">Tap untuk lanjut</span>
    </main>
  );
}
