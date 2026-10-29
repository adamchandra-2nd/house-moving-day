import { API_URL, request } from "../data/http";
import type { AdminEvent, AdminGuest, Announcement, EventFeedbackEntry } from "./data";
import type { Person } from "../stage/data";

/**
 * The committee's half of the API.
 *
 * Separate from data/adapters.ts because the credential is different: a guest
 * carries an invite token, the committee carries a signed session. Mixing them
 * in one module invites sending the wrong one.
 */

const STORAGE_KEY = "hmd.admin.session";

let session: string | null = null;

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
   * Step one of signing in: asks the server to send a PIN.
   *
   * It answers with the PIN in the body, because no mail service is wired up
   * yet. That is a prototype shortcut and the server says so; it is also why
   * this must not be deployed anywhere public with a real guest list behind
   * it until the PIN actually travels by email.
   */
  requestPin: (email: string) =>
    request<{ sent: boolean; pin?: string }>("/api/admin/login", { method: "POST", body: { email } }),

  verifyPin: async (email: string, pin: string) => {
    const res = await request<{ token: string }>("/api/admin/verify", {
      method: "POST",
      body: { email, pin },
    });
    keepSession(res.token);
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

  announcements: () => request<Announcement[]>("/api/admin/announcements", { token: loadSession() }),

  sendAnnouncement: (a: { title: string; body: string; roomId: string | null }) =>
    request<Announcement>("/api/admin/announcements", { method: "POST", token: loadSession(), body: a }),

  people: () => request<Person[]>("/api/admin/people", { token: loadSession() }),

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
};

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

export const adminPhotoSrc = (id: string) =>
  `${API_URL}/api/admin/photos/${encodeURIComponent(id)}/image?t=${encodeURIComponent(loadSession() ?? "")}`;
