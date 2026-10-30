import { API_URL, request } from "../data/http";
import type { AdminEvent, AdminGuest, Announcement, EventFeedbackEntry } from "./data";
import { useEffect } from "react";
import type { Person } from "../stage/data";
import { pull, push, subscribe, writeCache } from "../stage/remote";
import { EMPTY_STAGE, read as readStage, type StageState } from "../stage/store";

/**
 * The committee's half of the API.
 *
 * Separate from data/adapters.ts because the credential is different: a guest
 * carries an invite token, the committee carries a signed session. Mixing them
 * in one module invites sending the wrong one.
 */

const STORAGE_KEY = "hmd.admin.session";

/** Who signed in, for the header. Not a credential: the token is. */
const EMAIL_KEY = "hmd.admin.email";

let session: string | null = null;

export function loadSessionEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

export function loadSession(): string | null {
  if (session) return session;
  try {
    session = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Blocked storage: the committee signs in again after a reload.
  }
  return session;
}

function keepSession(token: string) {
  session = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* see above */
  }
}

export function endSession() {
  session = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** What POST /api/admin/invites hands back, one entry per guest. */
export type InvitePlan = {
  guestId: string;
  name: string;
  phone: string;
  /** The guest's personal link, name slug and all. */
  url: string;
  /** The template already filled in, ready to send. */
  message: string;
  /** Opens WhatsApp with that message typed. */
  waUrl: string;
};

export const adminApi = {
  /**
   * Step one of signing in. The server answers `{sent: true}` whatever the
   * address; the PIN itself is the server's ADMIN_PIN, handed to the
   * committee by whoever runs the server. It is never in the response.
   */
  requestPin: (email: string) =>
    request<{ sent: boolean }>("/api/admin/login", { method: "POST", body: { email } }),

  verifyPin: async (email: string, pin: string) => {
    const res = await request<{ token: string; email?: string }>("/api/admin/verify", {
      method: "POST",
      body: { email, pin },
    });
    keepSession(res.token);
    try {
      localStorage.setItem(EMAIL_KEY, res.email ?? email);
    } catch {
      /* only the header's label is lost */
    }
    return res;
  },

  guests: () => request<AdminGuest[]>("/api/admin/guests", { token: loadSession() }),

  addGuest: (name: string, phone: string, email?: string) =>
    request<AdminGuest>("/api/admin/guests", {
      method: "POST",
      token: loadSession(),
      body: { name, phone, email },
    }),

  /** Marks the batch as sent and returns ready-to-tap WhatsApp links. */
  sendInvites: (guestIds: string[]) =>
    request<InvitePlan[]>("/api/admin/invites", {
      method: "POST",
      token: loadSession(),
      body: { guestIds },
    }),

  /** Kills a link without deleting the guest: their check-in and cards stay. */
  revokeInvite: (guestId: string) =>
    request<{ guestId: string; revoked: boolean }>(
      `/api/admin/guests/${encodeURIComponent(guestId)}/invite`,
      { method: "DELETE", token: loadSession() },
    ),

  // ---- Tamu ----

  /** Check a guest in from the committee's own device. */
  checkIn: (guestId: string) =>
    request<{ guestId: string; checkedIn: boolean; by: string }>(
      `/api/admin/guests/${encodeURIComponent(guestId)}/checkin`,
      { method: "POST", token: loadSession(), body: {} },
    ),

  undoCheckIn: (guestId: string) =>
    request<{ guestId: string; checkedIn: boolean }>(
      `/api/admin/guests/${encodeURIComponent(guestId)}/checkin`,
      { method: "DELETE", token: loadSession() },
    ),

  // ---- Hadiah ----

  /** Refused with 409 if the prize was already handed out, or not yet earned. */
  claimReward: (guestId: string) =>
    request<{ guestId: string; reward: string; claimedAt: number }>(
      `/api/admin/guests/${encodeURIComponent(guestId)}/reward`,
      { method: "POST", token: loadSession() },
    ),

  // ---- Rundown, Pengumuman, Pengisi ----

  rundown: () => request<AdminEvent[]>("/api/admin/rundown", { token: loadSession() }),

  saveRundown: (events: AdminEvent[]) =>
    request<AdminEvent[]>("/api/admin/rundown", { method: "PUT", token: loadSession(), body: events }),

  /** The committee's and the MC's (source "mc", sent from the stage). */
  announcements: () => request<Announcement[]>("/api/admin/announcements", { token: loadSession() }),

  /** Shows it on guests' phones again; the answer carries the new `at`. */
  resendAnnouncement: (id: string) =>
    request<Announcement>(`/api/admin/announcements/${encodeURIComponent(id)}/resend`, { method: "POST", token: loadSession() }),

  sendAnnouncement: (a: { title: string; body: string; roomId: string | null }) =>
    request<Announcement>("/api/admin/announcements", { method: "POST", token: loadSession(), body: a }),

  /** Guests stop seeing it too: the server no longer returns it to them. 404 if it is already gone. */
  deleteAnnouncement: (id: string) =>
    request<void>(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: "DELETE", token: loadSession() }),

  people: () => request<AdminPerson[]>("/api/admin/people", { token: loadSession() }),

  /** The server mints the id; it is what the personal stage link carries. */
  addPerson: (p: Omit<Person, "id">) =>
    request<AdminPerson>("/api/admin/people", { method: "POST", token: loadSession(), body: p }),

  savePerson: ({ id, ...p }: Person) =>
    request<AdminPerson>(`/api/admin/people/${encodeURIComponent(id)}`, { method: "PUT", token: loadSession(), body: p }),

  /** The committee sent or copied the personal link: access becomes "terkirim". */
  invitePerson: (id: string) =>
    request<void>(`/api/admin/people/${encodeURIComponent(id)}/invite`, { method: "POST", token: loadSession() }),

  /** Their link stops working, and a stage session they hold ends on its next request. */
  revokePerson: (id: string) =>
    request<void>(`/api/admin/people/${encodeURIComponent(id)}/access`, { method: "DELETE", token: loadSession() }),

  restorePerson: (id: string) =>
    request<void>(`/api/admin/people/${encodeURIComponent(id)}/access`, { method: "POST", token: loadSession() }),

  /** Their sessions are left without a speaker, server-side. */
  deletePerson: (id: string) =>
    request<void>(`/api/admin/people/${encodeURIComponent(id)}`, { method: "DELETE", token: loadSession() }),

  // ---- Pengaturan ----

  settings: () => request<WireSettings>("/api/admin/settings", { token: loadSession() }),

  saveSettings: (s: WireSettings) =>
    request<WireSettings>("/api/admin/settings", { method: "PUT", token: loadSession(), body: s }),

  // ---- Galeri ----

  photos: () => request<AdminPhoto[]>("/api/admin/photos", { token: loadSession() }),

  /** censored false lifts it, which is what "urungkan" does. */
  censorPhotos: (ids: string[], censored: boolean, reason?: string) =>
    request<{ ids: string[]; censored: boolean }>("/api/admin/photos/censor", {
      method: "POST",
      token: loadSession(),
      body: { ids, censored, reason },
    }),

  markPhotosChecked: (ids: string[]) =>
    request<{ ids: string[] }>("/api/admin/photos/checked", { method: "POST", token: loadSession(), body: { ids } }),

  // ---- Feedback ----

  feedback: () =>
    request<AdminFeedback>("/api/admin/feedback", { token: loadSession() }),
};

/**
 * One rating per guest per event, plus the closing answers.
 *
 * The Feedback page wants the closing answers aggregated (ratings, mood
 * counts, messages); the API sends them one row per guest, because an
 * aggregate cannot be exported to CSV and a row can. AdminApp folds them.
 */
export type AdminFeedback = {
  /** Keyed by session id. The field is `events` on the wire. */
  events: Record<string, EventFeedbackEntry[]>;
  final: { rating: number; note?: string; moods?: string[]; at: number }[];
};

/** Used before the first response, and if one fails. */
export const EMPTY_FEEDBACK: AdminFeedback = { events: {}, final: [] };

/**
 * Settings on the wire.
 *
 * `date` is a calendar day as a string, not a Date: the event happens on the
 * 8th of November whatever zone the committee's laptop thinks it is in, and
 * sending an instant invites a browser to render the 7th. AdminSettings keeps
 * a Date because the picker needs one; the conversion is in AdminApp.
 */
export type WireSettings = {
  eventName: string;
  date: string;
  place: { name: string; address: string };
  doorCode: string;
  panitiaPin: string;
  countdown: boolean;
  finalFeedbackAt: number;
  codesChangedAt: number;
  /** WhatsApp invitation with {nama} and {link}; "" means the server's built-in default. */
  inviteTemplate: string;
  /** The committee member on call, shown to guests, the MC and speakers. */
  contact: { name: string; phone: string };
};

/** Where a personal stage link stands. Derived by the server, ignored on writes. */
export type PersonAccess = "belum" | "terkirim" | "masuk" | "dicabut";

/** An MC or speaker as the committee sees them: plus whether their link is out. */
/** `stageCode`: the code they sign in with, sent along with their link. Only the committee's endpoints carry it. */
export type AdminPerson = Person & { access?: PersonAccess; stageCode?: string };

/**
 * A photo as the committee sees it: the guest's view plus their own notes.
 *
 * The image is a separate request. It goes through the admin path so the
 * committee gets the original even for something they have censored -- they
 * have to see what they are judging.
 */
export type AdminPhoto = {
  id: string;
  author: string;
  roomId: string;
  caption?: string;
  at: number;
  censored?: boolean;
  censorReason?: string;
  checked?: boolean;
};

/**
 * An MC's or speaker's personal link. It only says who they are; the stage
 * code they type after opening it is what lets them in.
 */
export const stageLink = (p: Pick<Person, "id" | "role">) =>
  `${window.location.origin}/${p.role === "mc" ? "mc" : "pembicara"}?p=${encodeURIComponent(p.id)}`;

/** wa.me wants the number in international form: 0812... becomes 62812... */
export const waLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(text)}`;

/**
 * The shared stage document, with the committee's credential.
 *
 * stage/store's patchStage and useStageWatch pass no token, which falls back
 * to the MC/speaker session -- one the committee's laptop does not have, so
 * every write came back 401. The same three calls, with the admin session.
 */
export async function patchStageAsAdmin(fn: (s: StageState) => StageState) {
  const token = loadSession();
  let base: StageState;
  try {
    base = (await pull(token)) ?? readStage() ?? EMPTY_STAGE();
  } catch {
    base = readStage() ?? EMPTY_STAGE();
  }
  const next = fn(base);
  writeCache(next);
  await push(next, token, (latest) => fn(latest));
}

/**
 * Empties the stage document: after a rehearsal, so the real day does not
 * open on "Selesai". rev -1 tells the server to overwrite whatever revision
 * it holds -- the point is to discard it. Answers with what the server now has.
 */
export async function resetStageAsAdmin(): Promise<StageState> {
  const token = loadSession();
  const empty = EMPTY_STAGE();
  await request("/api/stage/state", { method: "PUT", token, body: { rev: -1, state: empty } });
  writeCache(empty);
  // Also brings stage/remote's revision up to date for the next write.
  return (await pull(token)) ?? empty;
}

/** The current stage document, for the dashboard's first paint. */
export const pullStageAsAdmin = () => pull(loadSession());

export function useStageWatchAsAdmin(cb: (s: StageState) => void, enabled: boolean) {
  useEffect(() => {
    const token = loadSession();
    if (!enabled || !token) return;
    return subscribe(token, (s) => {
      writeCache(s);
      cb(s);
    });
  }, [cb, enabled]);
}

export const adminPhotoSrc = (id: string) =>
  `${API_URL}/api/admin/photos/${encodeURIComponent(id)}/image?t=${encodeURIComponent(loadSession() ?? "")}`;
