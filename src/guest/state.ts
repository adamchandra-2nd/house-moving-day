import type { NavTab } from "../components/BottomNav";
import { COUNTDOWN_ENABLED, DEMO_NOW } from "../config";
import { SAMPLE_QUESTIONS, type AskedQuestion } from "../data/questions";
import { EMPTY_OUTFIT, type Outfit } from "../data/outfits";
import type { PickResult } from "../screens/PhotoPicker";
import type { CheckInScenario } from "../screens/CheckIn";
import type { MainScenario } from "../screens/MainArea";

/**
 * Guest state. `stage` and `tab` used to live here too; they are the URL now
 * (see routing/paths.ts), so there is one source of truth for "where am I".
 */
export type Overlay =
  | { type: "guest"; id: string }
  | { type: "myqr" }
  | { type: "voucher" }
  | { type: "reward" }
  | { type: "ask"; eventId: string }
  // The gallery: one photo full-screen, and the share sheet for photos just
  // picked from the phone's library.
  | { type: "photo"; id: string; confirmDelete?: boolean }
  | { type: "upload"; initial: PickResult }
  | null;

export type GuestState = {
  name: string;
  outfit: Outfit;
  roomIndex: number;
  visited: number[];
  collected: Record<string, string>;
  rewardClaimed: boolean;
  feedbackSent: boolean;
  countdownEnabled: boolean;
  /** Rundown clock (minutes since 00:00). */
  now: number;
  checkIn: CheckInScenario;
  mainScenario: MainScenario;
  guestsPresent: boolean;
  changedId?: string;
  offline: boolean;
  questions: AskedQuestion[];
  /** Rundown minute the guest became "hadir"; only events ending after this ask for feedback. */
  hadirAt: number;
  /** Per-event feedback already sent (event id → rating). */
  eventFeedback: Record<string, number>;
  feedbackOffline: boolean;
  askClosed: boolean;
  askOffline: boolean;
  /** Review case: the MC reads the question while the guest is editing it. */
  askRace: boolean;
  system: "loading" | "error" | "offline" | null;
  overlay: Overlay;
};

export const INITIAL: GuestState = {
  name: "David",
  outfit: EMPTY_OUTFIT,
  roomIndex: 0,
  visited: [0],
  collected: {},
  rewardClaimed: false,
  feedbackSent: false,
  countdownEnabled: COUNTDOWN_ENABLED,
  now: DEMO_NOW.live,
  checkIn: "ok",
  mainScenario: "intro",
  guestsPresent: true,
  offline: false,
  questions: SAMPLE_QUESTIONS,
  hadirAt: DEMO_NOW.live,
  eventFeedback: {},
  feedbackOffline: false,
  askClosed: false,
  askOffline: false,
  askRace: false,
  system: null,
  overlay: null,
};

export type NavTarget = { tab: NavTab; roomIndex?: number };

const STORAGE_KEY = "hmd-progress-v3";
/** Only real progress is saved, so reopening the app resumes where the guest left off. */
const PERSISTED = [
  "name",
  "outfit",
  "roomIndex",
  "visited",
  "collected",
  "rewardClaimed",
  "feedbackSent",
  "questions",
  "hadirAt",
  "eventFeedback",
] as const satisfies readonly (keyof GuestState)[];

type Saved = Partial<Pick<GuestState, (typeof PERSISTED)[number]>> & { resumePath?: string };

export function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null; // storage blocked or corrupt: start fresh
  }
}

/**
 * Writes are debounced: the old code persisted on every state change, so a
 * single keystroke cost a JSON.stringify plus a synchronous storage write.
 */
let writeTimer: number | undefined;
let pending: Saved | null = null;

export function saveProgress(state: GuestState, resumePath: string) {
  pending = { resumePath };
  for (const key of PERSISTED) (pending as Record<string, unknown>)[key] = state[key];
  clearTimeout(writeTimer);
  writeTimer = window.setTimeout(flushProgress, 400);
}

export function flushProgress() {
  if (!pending) return;
  clearTimeout(writeTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    /* private mode: progress just isn't remembered */
  }
  pending = null;
}

/** State the guest resumes with, before any review scenario is applied. */
export function resumeState(): GuestState {
  const saved = readSaved();
  if (!saved) return INITIAL;
  return { ...INITIAL, ...saved, mainScenario: "none" };
}

export function resumePath(): string | null {
  return readSaved()?.resumePath ?? null;
}
