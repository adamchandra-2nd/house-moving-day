import type { NavTab } from "../components/BottomNav";
import { COUNTDOWN_ENABLED, DEMO_NOW, MY_KENALAN_CODE } from "../config";
import { rundownMinute } from "../data/clock";
import type { GuestNotice } from "../data/notifications";
import { SAMPLE_QUESTIONS, type AskedQuestion } from "../data/questions";
import { EMPTY_OUTFIT, type Outfit } from "../data/outfits";
import type { PickResult } from "../screens/PhotoPicker";
import type { CheckInScenario } from "../screens/CheckIn";
import type { MainScenario } from "../screens/MainArea";
import { loadToken } from "./session";

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
  /** The server's id for this guest, from /api/invite; "" until it answers (and in review links). */
  guestId: string;
  name: string;
  /** This guest's own 4-digit kenalan code, shown under their QR. */
  code: string;
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
  /** Announcements already shown as a toast, as `${id}@${at}` so a resend shows again. */
  seenAnnouncements: string[];
  /** Notifikasi (the bell on Ruangan), with read/unread, saved with this invite's progress. */
  notices: GuestNotice[];
  /**
   * Gallery photo ids this phone has already seen in a poll; null until the
   * first one, which only records (a full gallery on arrival is not "new").
   */
  knownPhotos: string[] | null;
  /** Other guests shared photos since Galeri was last opened: orange dot on its button. */
  newPhotos: boolean;
  /** Review cases only: "Ajak kenalan" sent (guest id → ms). Live sessions read the server's. */
  invited: Record<string, number>;
  askClosed: boolean;
  askOffline: boolean;
  /** Review case: the MC reads the question while the guest is editing it. */
  askRace: boolean;
  system: "loading" | "error" | "offline" | null;
  overlay: Overlay;
};

/**
 * The base every review scenario starts from: a sample guest at a fixed 09:50
 * with the sample questions. Live sessions start from LIVE_INITIAL instead.
 */
export const INITIAL: GuestState = {
  guestId: "",
  name: "David",
  code: MY_KENALAN_CODE,
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
  seenAnnouncements: [],
  notices: [],
  knownPhotos: null,
  newPhotos: false,
  invited: {},
  askClosed: false,
  askOffline: false,
  askRace: false,
  system: null,
  overlay: null,
};

/**
 * A real guest: nobody's name until /api/invite answers, the real clock, and
 * no questions until the server sends them. GuestProvider keeps `now` ticking.
 */
const liveInitial = (): GuestState => {
  const now = rundownMinute();
  return { ...INITIAL, name: "", code: "", now, hadirAt: now, mainScenario: "none", questions: [] };
};

export type NavTarget = { tab: NavTab; roomIndex?: number };

const STORAGE_KEY = "hmd-progress-v3";
/** Only real progress is saved, so reopening the app resumes where the guest left off. */
const PERSISTED = [
  "guestId",
  "name",
  "code",
  "outfit",
  "roomIndex",
  "visited",
  "collected",
  "rewardClaimed",
  "feedbackSent",
  "questions",
  "hadirAt",
  "eventFeedback",
  "seenAnnouncements",
  "notices",
  "knownPhotos",
  "newPhotos",
] as const satisfies readonly (keyof GuestState)[];

/**
 * `token` is whose progress this is. Saved progress belongs to one invite: a
 * phone that opened a review link, or somebody else's invite, must not hand
 * its cards, questions and ratings to the next guest who opens theirs.
 */
type Saved = Partial<Pick<GuestState, (typeof PERSISTED)[number]>> & { resumePath?: string; token?: string | null };

export function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    // Progress saved without a token, or under another one, is not this guest's.
    if (!saved || !saved.token || saved.token !== loadToken()) return null;
    return saved;
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
  pending = { resumePath, token: loadToken() };
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
  if (!saved) return liveInitial();
  return { ...liveInitial(), ...saved, mainScenario: "none" };
}

export function resumePath(): string | null {
  return readSaved()?.resumePath ?? null;
}
