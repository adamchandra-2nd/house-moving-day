import type { NavTab } from "../components/BottomNav";

/** The linear guest flow, as paths. The URL is the source of truth for "where am I". */
export const FLOW = {
  rsvp: "/",
  thanks: "/terima-kasih",
  countdown: "/countdown",
  start: "/mulai",
  checkin: "/check-in",
  door: "/pintu",
  narasi: "/cerita",
  customize: "/karakter",
} as const;

export type FlowStage = keyof typeof FLOW;

/**
 * The personal invite link, the one the committee sends over WhatsApp.
 *
 * The segment carries the guest's name in front of the token
 * (/u/budi-santoso-k4m2p9xr7tn3vq1w); the name is decoration and only the
 * token is read. See guest/session.ts for why that is unambiguous.
 *
 * This route does not render anything of its own: it banks the token and
 * forwards to wherever the guest actually is in the flow.
 */
export const INVITE_PATH = "/u/:token";

export const TABS: NavTab[] = ["ruangan", "agenda", "kenalan", "feedback"];

/**
 * Full-screen pages that open over Ruangan rather than being a tab: Galeri
 * (from the pill on Ruangan; it used to be a tab, so /app/galeri still works)
 * and Notifikasi (the bell).
 */
export const SCREENS = ["galeri", "notifikasi"] as const;
export type AppScreen = (typeof SCREENS)[number];

export const tabPath = (tab: NavTab | AppScreen) => `/app/${tab}`;

/** Admin pages that get a real path; every other admin case rides on ?demo=. */
export const ADMIN_PAGES = ["dashboard", "rundown", "pengumuman", "pengisi", "undangan", "tamu", "galeri", "hadiah", "feedback", "pengaturan"] as const;

/**
 * The stage sides (MC and Performance) follow the admin convention: the path
 * picks the side and the tab to land on, and every other case rides on ?demo=.
 * They are a separate lazy chunk — a guest's phone never downloads them.
 */
export const STAGE = { mc: "/mc", performance: "/pembicara" } as const;

export type StageSide = keyof typeof STAGE;

export const MC_TABS = ["panggung", "pertanyaan", "sorotan", "umumkan"] as const;
export const PERF_TABS = ["sesi", "pertanyaan", "hasil"] as const;

/** Token prefix each side's review cases use (`mc-kode`, `pembicara-siap`). */
export const STAGE_PREFIX: Record<StageSide, string> = { mc: "mc", performance: "pembicara" };

export const SCENARIO_PARAM = "demo";
