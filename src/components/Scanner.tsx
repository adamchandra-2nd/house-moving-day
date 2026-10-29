import { useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { Icon } from "./Icon";
import "./Scanner.css";

export type ScanState = "scanning" | "found" | "invalid" | "denied" | "offline";

type ScannerProps = {
  state: ScanState;
  /** Review cases: no camera, so a code "is read" after this delay while scanning. */
  demoAfterMs?: number;
  onRead?: () => void;
  /**
   * The real camera. When set, the viewfinder runs the rear camera and calls
   * this with every QR's text while scanning; onRead and the timer are unused.
   */
  onDecode?: (text: string) => void;
  /** The camera could not start: permission refused, no camera, or no HTTPS. */
  onCameraError?: () => void;
};

/** Figma: QR Scanner — camera viewfinder with orange corners and a moving scan line. */
export function Scanner({ state, demoAfterMs = 3500, onRead, onDecode, onCameraError }: ScannerProps) {
  const video = useRef<HTMLVideoElement>(null);
  // Held in refs so a parent re-render does not restart the camera.
  const decode = useRef(onDecode);
  const cameraError = useRef(onCameraError);
  decode.current = onDecode;
  cameraError.current = onCameraError;
  const live = !!onDecode;

  useEffect(() => {
    if (live || state !== "scanning" || !onRead) return;
    const t = window.setTimeout(onRead, demoAfterMs);
    return () => clearTimeout(t);
  }, [live, state, demoAfterMs, onRead]);

  /**
   * The camera only runs while scanning. Stopping it on "found" is what turns
   * the phone's camera light off as the door "opens", and a second read of the
   * same QR cannot fire a second check-in.
   */
  useEffect(() => {
    if (!live || state !== "scanning" || !video.current) return;
    const scanner = new QrScanner(video.current, (r) => decode.current?.(r.data), {
      preferredCamera: "environment",
      maxScansPerSecond: 5,
      returnDetailedScanResult: true,
    });
    scanner.start().catch(() => cameraError.current?.());
    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [live, state]);

  const blocked = state === "denied" || state === "offline";
  return (
    <div className={`scanner clay clay-dark scanner--${state}`} aria-live="polite">
      {live && state === "scanning" && <video ref={video} className="scanner__video" muted playsInline />}
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
