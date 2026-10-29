import { DEMO_NOW } from "../config";
import { AGENDA } from "../data/agenda";
import { SAMPLE_COLLECTED } from "../data/guests";
import { SAMPLE_NOTICES } from "../data/notifications";
import type { GuestState } from "../guest/state";
import { ADMIN_PAGES, FLOW, MC_TABS, PERF_TABS, SCENARIO_PARAM, STAGE, STAGE_PREFIX, tabPath, type StageSide } from "./paths";

/**
 * Review scenarios: every screen and case, openable as ?demo=<token>.
 * These are state fixtures rather than routes — a token sets up the data a case
 * needs (cards collected, clock, overlay) and says which path to land on.
 */
export type Scenario = { path: string; state?: Partial<GuestState> };

/** In-app sample: 3 cards collected, a couple of rooms visited. */
const ALL_FEEDBACK = Object.fromEntries(AGENDA.map((a) => [a.id, 5]));
const APP: Partial<GuestState> = {
  collected: SAMPLE_COLLECTED,
  visited: [0, 1, 4],
  mainScenario: "none",
  hadirAt: 9 * 60,
  eventFeedback: { pembukaan: 4 },
  notices: SAMPLE_NOTICES,
};
/** Right after the talkshow ends, guest still in Ruang Omakase. */
const TALKSHOW_DONE = 10 * 60 + 31;
const FOUR = { ...SAMPLE_COLLECTED, raka: "Kucing oren, katanya." };
const FIVE = { ...FOUR, laras: "Kopi pagi yang pas." };

const ROOM = tabPath("ruangan");
const AGENDA_TAB = tabPath("agenda");
const KENALAN = tabPath("kenalan");
const FEEDBACK = tabPath("feedback");
const GALERI = tabPath("galeri");
const NOTIFIKASI = tabPath("notifikasi");

export const SCENARIOS: Record<string, Scenario> = {
  review: { path: "/review" },

  // ---------- Pra-acara ----------
  rsvp: { path: FLOW.rsvp },
  "test-day": { path: FLOW.rsvp, state: { countdownEnabled: false } },
  "terima-kasih": { path: FLOW.thanks },
  countdown: { path: FLOW.countdown },
  mulai: { path: FLOW.start },

  // ---------- Masuk ke Potara ----------
  "check-in": { path: FLOW.checkin },
  "check-in-qr-salah": { path: FLOW.checkin, state: { checkIn: "invalid" } },
  "check-in-kamera": { path: FLOW.checkin, state: { checkIn: "denied" } },
  "check-in-offline": { path: FLOW.checkin, state: { checkIn: "offline" } },
  pintu: { path: FLOW.door },
  narasi: { path: FLOW.narasi },
  karakter: { path: FLOW.customize },

  // ---------- Ruangan (main area) ----------
  ruangan: { path: ROOM, state: { ...APP, collected: {}, visited: [0], mainScenario: "intro" } },
  "ruangan-ramai": { path: ROOM, state: { ...APP, mainScenario: "ramai", roomIndex: 1 } },
  "ruangan-segera": { path: ROOM, state: { ...APP, now: DEMO_NOW.soon, mainScenario: "segera" } },
  "ruangan-jeda": { path: ROOM, state: { ...APP, now: DEMO_NOW.between, roomIndex: 2 } },
  "ruangan-berubah": { path: ROOM, state: { ...APP, mainScenario: "berubah", changedId: "pengenalan" } },
  "ruangan-hadiah": { path: ROOM, state: { ...APP, collected: FIVE, mainScenario: "hadiah", roomIndex: 4 } },
  "ruangan-selesai": { path: ROOM, state: { ...APP, now: DEMO_NOW.ended, eventFeedback: ALL_FEEDBACK } },
  "ruangan-offline": { path: ROOM, state: { ...APP, offline: true, roomIndex: 4 } },
  "ruangan-foto-baru": { path: ROOM, state: { ...APP, mainScenario: "foto-baru", newPhotos: true, roomIndex: 1 } },
  "ruangan-pengumuman": { path: ROOM, state: { ...APP, mainScenario: "pengumuman", roomIndex: 1 } },
  "ruangan-diajak-kenalan": { path: ROOM, state: { ...APP, mainScenario: "diajak-kenalan", roomIndex: 2 } },

  // ---------- Notifikasi ----------
  notifikasi: { path: NOTIFIKASI, state: APP },
  "notifikasi-semua-dibaca": { path: NOTIFIKASI, state: { ...APP, notices: SAMPLE_NOTICES.map((n) => ({ ...n, read: true })) } },
  "notifikasi-kosong": { path: NOTIFIKASI, state: { ...APP, notices: [] } },

  // ---------- Galeri (full screen from Ruangan) ----------
  galeri: { path: GALERI, state: APP },
  "galeri-foto": { path: GALERI, state: { ...APP, overlay: { type: "photo", id: "p1" } } },
  "galeri-foto-milikku": { path: GALERI, state: { ...APP, overlay: { type: "photo", id: "p2" } } },

  // ---------- Agenda ----------
  agenda: { path: AGENDA_TAB, state: APP },
  "agenda-berubah": { path: AGENDA_TAB, state: { ...APP, changedId: "pengenalan" } },
  "agenda-selesai": { path: AGENDA_TAB, state: { ...APP, now: DEMO_NOW.ended, eventFeedback: ALL_FEEDBACK } },

  // ---------- Feedback per acara ----------
  "feedback-acara": { path: ROOM, state: { ...APP, now: TALKSHOW_DONE, roomIndex: 4 } },
  "feedback-acara-gagal": { path: ROOM, state: { ...APP, now: TALKSHOW_DONE, roomIndex: 4, feedbackOffline: true } },

  // ---------- Tanya pembicara ----------
  tanya: { path: ROOM, state: { ...APP, overlay: { type: "ask", eventId: "talkshow" } } },
  "tanya-kosong": { path: ROOM, state: { ...APP, questions: [], overlay: { type: "ask", eventId: "talkshow" } } },
  "tanya-ditutup": { path: ROOM, state: { ...APP, askClosed: true, overlay: { type: "ask", eventId: "talkshow" } } },
  "tanya-gagal": { path: ROOM, state: { ...APP, askOffline: true, overlay: { type: "ask", eventId: "talkshow" } } },
  "tanya-keburu-dibaca": { path: ROOM, state: { ...APP, askRace: true, overlay: { type: "ask", eventId: "talkshow" } } },

  // ---------- Kenalan ----------
  kenalan: { path: KENALAN, state: APP },
  "kenalan-kosong": { path: KENALAN, state: { ...APP, collected: {}, guestsPresent: false } },
  "kenalan-kartu": { path: KENALAN, state: { ...APP, overlay: { type: "guest", id: "nanda" } } },
  "kenalan-ajakan-terkirim": { path: KENALAN, state: { ...APP, invited: { raka: Date.now() - 2 * 60 * 1000 }, overlay: { type: "guest", id: "raka" } } },
  "kenalan-qr": { path: KENALAN, state: { ...APP, overlay: { type: "myqr" } } },
  "kenalan-hampir": { path: KENALAN, state: { ...APP, collected: FOUR } },
  "kenalan-hadiah": { path: KENALAN, state: { ...APP, collected: FIVE } },
  voucher: { path: KENALAN, state: { ...APP, collected: FIVE, overlay: { type: "voucher" } } },
  "kenalan-selesai": { path: KENALAN, state: { ...APP, collected: FIVE, rewardClaimed: true } },

  // ---------- Feedback ----------
  feedback: { path: FEEDBACK, state: { ...APP, now: DEMO_NOW.ended, eventFeedback: ALL_FEEDBACK } },
  "memory-card": { path: FEEDBACK, state: { ...APP, now: DEMO_NOW.ended, feedbackSent: true, eventFeedback: ALL_FEEDBACK } },

  // ---------- Sistem ----------
  memuat: { path: FLOW.rsvp, state: { system: "loading" } },
  error: { path: FLOW.rsvp, state: { system: "error" } },
  offline: { path: FLOW.rsvp, state: { system: "offline" } },
};

/**
 * Admin scenarios keep their own map (admin/links.ts); here we only need the path.
 * Cases that are not a page of their own (sesi-habis, pin-terkunci, 404…) land on
 * the closest page and carry the exact token in ?demo=.
 */
export function adminPathFor(token: string): string {
  if (token === "admin") return "/admin";
  const first = token.slice("admin-".length).split("-")[0];
  if (first === "login" || first === "pin") return "/admin/login";
  return (ADMIN_PAGES as readonly string[]).includes(first) ? `/admin/${first}` : "/admin";
}

export const isAdminToken = (token: string) => token === "admin" || token.startsWith("admin-");

/**
 * The MC and Performance sides work the same way (stage/links.ts holds the
 * cases); here we only need the path. The tab in the path is the one to land
 * on, and cases that are not a tab of their own (`mc-kode`, `pembicara-siap`)
 * land on the side's base path carrying the exact token in ?demo=.
 */
export function stageSideOf(token: string): StageSide | null {
  if (token === "mc" || token.startsWith("mc-")) return "mc";
  if (token === "pembicara" || token.startsWith("pembicara-")) return "performance";
  return null;
}

export const isStageToken = (token: string) => stageSideOf(token) !== null;

export function stagePathFor(token: string): string {
  const side = stageSideOf(token);
  if (!side) return "/";
  const base = STAGE[side];
  const first = token.slice(STAGE_PREFIX[side].length + 1).split("-")[0];
  const tabs: readonly string[] = side === "mc" ? MC_TABS : PERF_TABS;
  return first && tabs.includes(first) ? `${base}/${first}` : base;
}

/** The URL for a review token, used by the /review hub. */
export function linkFor(token: string): string {
  if (isAdminToken(token)) return `${adminPathFor(token)}?${SCENARIO_PARAM}=${token}`;
  if (isStageToken(token)) return `${stagePathFor(token)}?${SCENARIO_PARAM}=${token}`;
  const scenario = SCENARIOS[token];
  return scenario ? `${scenario.path}?${SCENARIO_PARAM}=${token}` : "/";
}
