/**
 * Shared live state between the MC, the speaker and the committee.
 *
 * The server holds it (see stage/remote.ts); localStorage is kept as a cache
 * so a reload paints before the first response lands, and so a phone that
 * drops off the wifi still shows the last state it saw. It used to be the
 * other way round -- localStorage was the truth and the `storage` event the
 * sync -- which works on one laptop with two tabs and not at all between the
 * MC's phone and the committee's laptop, which is the case the event has.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadStageToken, pull, push, readCache, subscribe, writeCache } from "./remote";
import { allSessions, SAMPLE_STAGE_QUESTIONS, type McSignal, type ScriptPart, type SpeakerHelp, type StageQuestion } from "./data";

export type StagePhase = "pre" | "live" | "ended";
export type SpeakerStatus = "belum" | "siap" | "live" | "bantuan" | "selesai";

export type StageState = {
  phase: StagePhase;
  /** Session on stage now, and the real time (ms) it started. */
  liveId: string | null;
  startedAt: number;
  doneIds: string[];
  questions: StageQuestion[];
  speaker: SpeakerStatus;
  speakerHelp?: SpeakerHelp;
  /** Last signal each way; the receiver shows it when `at` is newer than what it has seen. */
  mcSignal: { kind: McSignal; at: number } | null;
  speakerSignal: { kind: "siap" | "bantuan" | "selesai"; help?: SpeakerHelp; at: number } | null;
  announcements: { title: string; body: string; roomId: string | null; at: number }[];
  /** Script lines the MC ticked, per session. */
  checked: Record<string, number[]>;
  scriptVariant: Record<string, number>;
  /** Admin changed the rundown since the MC last looked. */
  rundownChanged: boolean;
  /** MC asked the committee for help (reason + time), shown in the admin bell. */
  panitiaCalled: boolean;
  panitiaCall?: { reason: string; at: number };
  /** Scripts the committee edited in the admin (otherwise Claude's suggestion is used). */
  scripts?: Record<string, ScriptPart[]>;
};

const minutesAgo = (m: number) => Date.now() - m * 60_000;

/** Talkshow on stage, 47½ minutes in (12:30 left). */
export const LIVE_BASE = (): StageState => ({
  phase: "live",
  liveId: "talkshow",
  startedAt: minutesAgo(47.5),
  doneIds: ["pembukaan"],
  questions: SAMPLE_STAGE_QUESTIONS,
  speaker: "live",
  mcSignal: null,
  speakerSignal: null,
  announcements: [{ title: "Talkshow segera mulai", body: "Kursi di Ruang Omakase masih banyak.", roomId: "ruang-omakase", at: 9 * 60 + 25 }],
  checked: { talkshow: [0, 1] },
  scriptVariant: {},
  rundownChanged: false,
  panitiaCalled: false,
});

/** The cached copy. The server is the source of truth; this is what paints first. */
/**
 * A stage that has not started.
 *
 * The fallback when the server has nothing yet and this browser has no cache
 * -- which is exactly the state of a real event before the MC taps anything.
 * LIVE_BASE is kept for the design review links, where a screen mid-talkshow
 * is the whole point; using it as the default meant every fresh MC screen
 * opened claiming a session was running and four guests had asked questions.
 */
export const EMPTY_STAGE = (): StageState => ({
  phase: "pre",
  liveId: null,
  startedAt: 0,
  doneIds: [],
  questions: [],
  speaker: "belum",
  mcSignal: null,
  speakerSignal: null,
  announcements: [],
  checked: {},
  scriptVariant: {},
  rundownChanged: false,
  panitiaCalled: false,
});

export function read(): StageState | null {
  return readCache();
}

/**
 * The live state, and the one way to change it.
 *
 * `seed` is a review case: it replaces the shared state and stays local, so
 * opening a design link never writes a staged scenario into a real event.
 *
 * Writes are applied locally first and sent after. At a live event the MC
 * taps "sesi berikutnya" in front of a room; waiting for a round trip before
 * the screen moves is the wrong trade. A rejected write is re-applied on top
 * of whatever the other side wrote (see remote.push), because the two sides
 * edit different fields of the same document.
 */
export function useStage(seed?: StageState) {
  const isSeed = useRef(Boolean(seed));
  // The cache only paints for a signed-in stage: without a session it can
  // only be left over from an earlier visit, and showing it would claim a
  // session is running that nobody started.
  const [state, setState] = useState<StageState>(() => seed ?? (loadStageToken() ? read() : null) ?? EMPTY_STAGE());

  useEffect(() => {
    if (isSeed.current) return;
    let alive = true;

    void pull(null)
      .then((s) => {
        if (!alive || !s) return;
        writeCache(s);
        setState(s);
      })
      .catch(() => {
        // Offline, or not signed in to a stage side yet. The cached state is
        // what shows, which is the same thing this screen showed last time.
      });

    const stop = subscribe(null, (s) => {
      if (!alive) return;
      writeCache(s);
      setState(s);
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const update = useCallback((fn: (s: StageState) => StageState) => {
    setState((prev) => {
      const next = fn(prev);
      // A review case stays in this tab: caching it would paint a staged
      // scenario on the next real visit.
      if (!isSeed.current) {
        writeCache(next);
        void push(next, null, (latest) => fn(latest)).catch(() => {
          // Queued in neither direction: the next successful write carries
          // the whole document, so nothing is lost beyond this one hop.
        });
      }
      return next;
    });
  }, []);

  return [state, update] as const;
}

/** Ticks every second (timers). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Keep the screen awake during the event (ignored where the browser says no). */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, []);
}

export const sortedSessions = () => [...allSessions()].sort((a, b) => a.start - b.start);

/** Seconds left on the live session (negative = overtime). */
export function remainingS(state: StageState, now: number) {
  const s = allSessions().find((x) => x.id === state.liveId);
  if (!s) return 0;
  return Math.round((s.end - s.start) * 60 - (now - state.startedAt) / 1000);
}

/** The session after the live one (or the first one before the event). */
export function nextSession(state: StageState) {
  const list = sortedSessions().filter((s) => !state.doneIds.includes(s.id) && s.id !== state.liveId);
  return list[0];
}

/** Scheduled clock minute "now" maps to, for display ("09.50"). */
export function clockMinute(state: StageState, now: number) {
  const s = allSessions().find((x) => x.id === state.liveId);
  if (!s) {
    if (state.phase === "ended") return 13 * 60 + 50;
    // Between sessions: right after the last one that finished (not a fixed morning time)
    const done = allSessions().filter((x) => state.doneIds.includes(x.id));
    return done.length ? Math.max(...done.map((x) => x.end)) : 8 * 60 + 45;
  }
  return s.start + Math.floor((now - state.startedAt) / 60_000);
}

export const fmtClock = (secs: number) => {
  const a = Math.abs(secs);
  return `${secs < 0 ? "+" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
};

/** For the admin side: change the shared state without holding it (the MC/speaker tabs pick it up). */
/**
 * The committee's write: the scripts edited on the Pengisi page.
 *
 * It pulls the current document first rather than patching the cache,
 * because the committee's laptop may not have looked at the stage state
 * since the MC started changing it, and writing on top of a stale cache
 * would roll the MC back to wherever this browser last was.
 *
 * `token` is the caller's own session (the committee passes its admin
 * token); without one the stage's own session is used.
 */
export async function patchStage(fn: (s: StageState) => StageState, token: string | null = null) {
  let base: StageState;
  try {
    base = (await pull(token)) ?? read() ?? EMPTY_STAGE();
  } catch {
    base = read() ?? EMPTY_STAGE();
  }
  const next = fn(base);
  writeCache(next);
  await push(next, token, (latest) => fn(latest));
}

/** For the admin side: be told when the MC or speaker changes something. `token` as in patchStage. */
export function useStageWatch(cb: (s: StageState) => void, token: string | null = null) {
  useEffect(
    () =>
      subscribe(token, (s) => {
        writeCache(s);
        cb(s);
      }),
    [cb, token],
  );
}
