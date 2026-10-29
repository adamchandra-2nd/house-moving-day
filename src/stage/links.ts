import type { LoginStep } from "./StageLogin";
import { LIVE_BASE, type StageState } from "./store";

export type McTab = "panggung" | "pertanyaan" | "sorotan" | "umumkan";
export type PerfTab = "sesi" | "pertanyaan" | "hasil";

export type StageScenario<T extends string> = {
  login?: LoginStep;
  welcome?: boolean;
  tab?: T;
  /** Replaces the shared state (review cases); undefined = continue the live demo. */
  seed?: () => StageState;
  sheet?: "rundown" | "panitia" | "bantuan";
  readMode?: boolean;
  compose?: boolean;
  daysLeft?: number;
  offline?: boolean;
  system?: "error" | "404";
  /** Show the incoming toast for the seeded signal straight away. */
  toast?: boolean;
  /** Performance: treat the latest question picked by the MC as just arrived. */
  newPick?: boolean;
};

const ago = (m: number) => Date.now() - m * 60_000;
const live = (patch: Partial<StageState> = {}) => () => ({ ...LIVE_BASE(), ...patch });
/** Between sessions: Pembukaan done, talkshow up next with the speaker ready. */
const between = (patch: Partial<StageState> = {}) => live({ liveId: null, doneIds: ["pembukaan"], speaker: "siap", questions: [], ...patch });

export const MC_LINKS: Record<string, StageScenario<McTab>> = {
  "mc-masuk": { login: "link", seed: live() },
  "mc-kode": { login: "kode", seed: live() },
  "mc-kode-salah": { login: "kode-salah", seed: live() },
  "mc-terkunci": { login: "terkunci", seed: live() },
  "mc-dicabut": { login: "dicabut", seed: live() },
  "mc-kenalan": { welcome: true, seed: live() },
  mc: {},
  "mc-panggung": { seed: live() },
  "mc-hampir": { seed: live({ startedAt: ago(56.5) }) },
  "mc-lewat": { seed: live({ startedAt: ago(62.25) }) },
  "mc-jeda": { seed: between({ speakerSignal: { kind: "siap", at: Date.now() } }), toast: true },
  "mc-bantuan": { seed: live({ speaker: "bantuan", speakerHelp: "mic", speakerSignal: { kind: "bantuan", help: "mic", at: Date.now() } }), toast: true },
  "mc-kode-terkirim": { seed: live({ mcSignal: { kind: "5-menit", at: Date.now() }, startedAt: ago(55.2) }) },
  "mc-rundown": { seed: live(), sheet: "rundown" },
  "mc-rundown-berubah": { seed: live({ rundownChanged: true }) },
  "mc-panitia": { seed: live(), sheet: "panitia" },
  "mc-pertanyaan": { seed: live(), tab: "pertanyaan" },
  "mc-baca": { seed: live(), tab: "pertanyaan", readMode: true },
  "mc-sorotan": { seed: live(), tab: "sorotan" },
  "mc-umumkan": { seed: live(), tab: "umumkan" },
  "mc-umumkan-tulis": { seed: live(), tab: "umumkan", compose: true },
  "mc-sebelum": { seed: live({ phase: "pre", liveId: null, doneIds: [], questions: [], speaker: "belum", announcements: [] }), daysLeft: 14 },
  "mc-hari-h": { seed: live({ phase: "pre", liveId: null, doneIds: [], questions: [], speaker: "belum", announcements: [] }) },
  "mc-selesai": { seed: live({ phase: "ended", liveId: null, doneIds: ["pembukaan", "talkshow", "pengenalan", "makan", "penutupan"], speaker: "selesai" }) },
  "mc-offline": { seed: live(), offline: true },
  "mc-error": { system: "error" },
  "mc-404": { system: "404" },
};

export const PERF_LINKS: Record<string, StageScenario<PerfTab>> = {
  "pembicara-masuk": { login: "link", seed: between({ speaker: "belum" }) },
  "pembicara-kode": { login: "kode", seed: between({ speaker: "belum" }) },
  "pembicara-dicabut": { login: "dicabut", seed: between({ speaker: "belum" }) },
  "pembicara-kenalan": { welcome: true, seed: between({ speaker: "belum" }) },
  pembicara: {},
  "pembicara-sebelum": { seed: between({ speaker: "belum" }) },
  "pembicara-siap": { seed: between({ speaker: "siap" }) },
  "pembicara-live": { seed: live() },
  "pembicara-5-menit": { seed: live({ startedAt: ago(55.2), mcSignal: { kind: "5-menit", at: Date.now() } }), toast: true },
  "pembicara-akhiri": { seed: live({ startedAt: ago(61), mcSignal: { kind: "akhiri", at: Date.now() } }), toast: true },
  "pembicara-bantuan": { seed: live(), sheet: "bantuan" },
  "pembicara-bantuan-terkirim": { seed: live({ speaker: "bantuan", speakerHelp: "mic" }) },
  "pembicara-pertanyaan": { seed: live(), tab: "pertanyaan" },
  "pembicara-pertanyaan-baru": { seed: live(), newPick: true },
  "pembicara-baca": { seed: live(), tab: "pertanyaan", readMode: true },
  "pembicara-selesai": { seed: live({ liveId: "pengenalan", doneIds: ["pembukaan", "talkshow"], speaker: "selesai", startedAt: ago(5) }), tab: "hasil" },
  "pembicara-offline": { seed: live(), offline: true },
  "pembicara-error": { system: "error" },
};
