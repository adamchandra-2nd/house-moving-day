import { useCallback, useEffect, useRef, useState } from "react";
import doorVideo from "../assets/door/pota-access-card.mp4";
import doorPoster from "../assets/door/smartlock-closeup.webp";
import { Icon } from "../components/Icon";
import "./DoorOpen.css";

/** Fetched on the check-in screen, so the video is already here when the door opens. */
export const DOOR_VIDEO = doorVideo;

type Step = "idle" | "tap" | "unlock" | "open";

/**
 * When the video shows each beat, in seconds: the paw taps the card at the
 * lock, the light turns green, the door swings into the office.
 */
const VIDEO_CUES: { at: number; step: Step }[] = [
  { at: 1.6, step: "tap" },
  { at: 3.6, step: "unlock" },
  { at: 5.4, step: "open" },
];
/**
 * A video that has not started by then, and is not even downloading, is not
 * coming: the drawn door plays instead.
 */
const VIDEO_START_LIMIT_MS = 4000;
/**
 * One still downloading gets this long in all to start, with its poster (the
 * smart lock) on screen meanwhile. 4 s alone was too tight for 3.3 MB on a
 * phone, and the iPhone ended up on the drawn door every time.
 */
const VIDEO_LOADING_LIMIT_MS = 10_000;
/**
 * However the video fares, the guest is through the door by then: the 7.5 s
 * clip after the longest wait to start, with room to spare. A browser pauses
 * video in a background tab, and a guest who switched apps mid-clip must not
 * come back to a door that never finishes opening.
 */
const VIDEO_MAX_MS = 20_000;

const caption = (step: Step) => (step === "open" ? "Selamat datang di rumah baru!" : step === "unlock" ? "Akses diterima" : "Membuka pintu…");

/**
 * The keycard moment after check-in: Pota's access card on the smart lock, the
 * light turns green, the door opens into the office.
 *
 * Plays pota-access-card.mp4, over its own first frame as the poster so the
 * screen is never blank while it loads. If it cannot play -- no support, an
 * error, or too slow on event wifi -- the drawn door animation runs instead;
 * the guest is never left at a door that does not open. Tapping skips either.
 */
export function DoorOpen({ onDone }: { onDone: () => void }) {
  const [video, setVideo] = useState(true);
  const fail = useCallback(() => setVideo(false), []);
  return video ? <DoorVideo onDone={onDone} onFail={fail} /> : <DoorAnimation onDone={onDone} />;
}

function DoorVideo({ onDone, onFail }: { onDone: () => void; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const started = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Muted and inline, so phones allow it to start on its own. React sets
    // `muted` only as a property, and iOS Safari decides on autoplay from the
    // attribute: without it play() is refused and the drawn door took over.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    // An abort is the browser pausing it in a background tab, not a broken
    // video: the start limits below still fall back if it never gets going.
    v.play().catch((e: unknown) => {
      if (!(e instanceof DOMException && e.name === "AbortError")) onFail();
    });
    let slow = window.setTimeout(() => {
      if (started.current) return;
      const loading = v.networkState === v.NETWORK_LOADING || v.readyState > v.HAVE_NOTHING;
      if (!loading) return onFail();
      slow = window.setTimeout(() => {
        if (!started.current) onFail();
      }, VIDEO_LOADING_LIMIT_MS - VIDEO_START_LIMIT_MS);
    }, VIDEO_START_LIMIT_MS);
    const cap = window.setTimeout(onDone, VIDEO_MAX_MS);
    // Back from another app: carry on where the clip was paused.
    const resume = () => {
      if (!document.hidden && v.paused && !v.ended) void v.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(slow);
      clearTimeout(cap);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [onFail, onDone]);

  return (
    <main className="door door--video" onClick={onDone} aria-label="Pintu Potara terbuka. Tap untuk lanjut.">
      <video
        ref={ref}
        className="door__video"
        src={doorVideo}
        poster={doorPoster}
        muted
        playsInline
        autoPlay
        preload="auto"
        onPlaying={() => (started.current = true)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          const reached = VIDEO_CUES.filter((c) => t >= c.at).pop();
          if (reached) setStep(reached.step);
        }}
        onEnded={onDone}
        onError={onFail}
      />
      <p className="door__caption door__caption--video glass t-p-h4-bold" aria-live="polite">
        {caption(step)}
      </p>
      <span className="door__skip door__skip--video t-p-h5">Tap untuk lanjut</span>
    </main>
  );
}

const STEPS_MS = { tap: 500, unlock: 1300, open: 1900, done: 3200 };

/** Keycard door animation: card taps the reader, light turns green, doors slide open into the office. */
function DoorAnimation({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("idle");
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
        {caption(step)}
      </p>
      <span className="door__skip t-p-h5">Tap untuk lanjut</span>
    </main>
  );
}
