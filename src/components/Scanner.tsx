import { useEffect } from "react";
import { Icon } from "./Icon";
import "./Scanner.css";

export type ScanState = "scanning" | "found" | "invalid" | "denied" | "offline";

type ScannerProps = {
  state: ScanState;
  /** Prototype: the camera can't run here, so a code "is read" after this delay while scanning. */
  demoAfterMs?: number;
  onRead?: () => void;
};

/** Figma: QR Scanner — camera viewfinder with orange corners and a moving scan line. */
export function Scanner({ state, demoAfterMs = 3500, onRead }: ScannerProps) {
  useEffect(() => {
    if (state !== "scanning" || !onRead) return;
    const t = window.setTimeout(onRead, demoAfterMs);
    return () => clearTimeout(t);
  }, [state, demoAfterMs, onRead]);

  const blocked = state === "denied" || state === "offline";
  return (
    <div className={`scanner clay clay-dark scanner--${state}`} aria-live="polite">
      {!blocked && (
        <>
          <span className="scanner__corner scanner__corner--tl" />
          <span className="scanner__corner scanner__corner--tr" />
          <span className="scanner__corner scanner__corner--bl" />
          <span className="scanner__corner scanner__corner--br" />
        </>
      )}
      {state === "scanning" && (
        <>
          <span className="scanner__line" />
          <Icon name="Scan" size={40} />
        </>
      )}
      {state === "found" && (
        <span className="scanner__badge scanner__badge--ok clay clay-accent">
          <Icon name="Check" size={32} />
        </span>
      )}
      {state === "invalid" && (
        <span className="scanner__badge scanner__badge--error clay clay-accent">
          <Icon name="Close" size={32} />
        </span>
      )}
      {blocked && (
        <span className="scanner__blocked">
          <Icon name={state === "offline" ? "WifiOff" : "Camera"} size={40} />
          <span className="t-p-h5-bold">{state === "offline" ? "Tidak ada koneksi" : "Kamera tidak aktif"}</span>
        </span>
      )}
    </div>
  );
}
