import { useEffect, useState } from "react";
import "./Countdown.css";

const pad = (n: number) => String(n).padStart(2, "0");

/** Figma: Countdown — four clay boxes (hari, jam, menit, detik), ticking every second. */
export function Countdown({ to, onDone }: { to: Date; onDone?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, to.getTime() - now);
  useEffect(() => {
    if (left === 0) onDone?.();
  }, [left, onDone]);

  const s = Math.floor(left / 1000);
  const parts = [
    { value: Math.floor(s / 86400), label: "Hari" },
    { value: Math.floor((s % 86400) / 3600), label: "Jam" },
    { value: Math.floor((s % 3600) / 60), label: "Menit" },
    { value: s % 60, label: "Detik" },
  ];
  return (
    <div className="countdown" role="timer" aria-label={`${parts[0].value} hari ${parts[1].value} jam lagi`}>
      {parts.map((p) => (
        <span key={p.label} className="countdown__box clay clay-dark">
          <span className="countdown__value">{pad(p.value)}</span>
          <span className="t-p-h5 countdown__label">{p.label}</span>
        </span>
      ))}
    </div>
  );
}
