import type { AgendaItem, StageLive } from "./agenda";
import type { Guest } from "./guests";
import type { AskedQuestion } from "./questions";
import type { Outfit } from "./outfits";
import { API_URL, newIdempotencyKey, request } from "./http";
import { loadToken } from "../guest/session";

/**
 * The one place the backend plugs in.
 *
 * Every function here returns a promise and nothing else in the app knows
 * where the data comes from. The components, queries and offline cache are
 * unchanged from when these returned bundled fixtures.
 *
 * Reads are plain GETs. Writes that are not naturally idempotent carry an
 * Idempotency-Key, so a guest who taps twice on a weak connection -- or whose
 * offline queue replays -- gets one question, one card, one rating.
 */

const token = () => loadToken();

export type SendQuestion = { eventId: string; text: string; author: string | null; at: number };
export type EditQuestion = { id: string; text: string };
export type EventRating = { eventId: string; rating: number };
export type CollectCard = { guestId: string; note: string };

/** What GET /api/invite answers: everything the guest flow needs, in one trip. */
export type Invite = {
  guestId: string;
  name: string;
  rsvp: "ya" | "tidak" | "belum";
  checkedIn: boolean;
  hadir: boolean;
  /** This guest's own 4-digit kenalan code, the one others type in. */
  code: string;
  cards: number;
  outfit: Outfit;
  /** The committee's switch for the pre-event countdown screen. */
  countdown: boolean;
  /**
   * Whether the prize was handed over and the final feedback sent. Optional:
   * an older API does not send these, and then the phone's own memory of
   * them is what shows.
   */
  rewardClaimed?: boolean;
  finalFeedback?: boolean;
  /** Sessions this guest already rated, so the rating prompt does not come back on a second phone. */
  ratedEvents?: string[];
  event: { name: string; host: string; dateLabel: string; place: string; startsAt: string; contact?: Contact };
};

/** The committee member on call. Both "" when nobody is set: hide the button then. */
export type Contact = { name: string; phone: string };

export type Card = { guestId: string; note: string };

/** A committee announcement, as GET /api/announcements answers it. */
export type GuestAnnouncement = {
  id: string;
  title: string;
  body: string;
  roomId: string | null;
  /** Rundown minute. A resend keeps the id and moves this to now. */
  at: number;
  /** Who announced it; optional for an older API. */
  source?: "panitia" | "mc";
};

/** What a guest's `seenAnnouncements` holds: the committee's resend is a new one to see. */
export const announcementKey = (a: GuestAnnouncement) => `${a.id}@${a.at}`;

/** The body, signed quietly with who sent it: the MC on stage, or the committee. */
export const announcementSub = (a: GuestAnnouncement) =>
  a.source ? `${a.body} · dari ${a.source === "mc" ? "MC" : "panitia"}` : a.body;

/**
 * "Ajak kenalan": one guest letting another know they would like to meet.
 * Deliberately without a place -- the room a guest is looking at in the app
 * is not necessarily the one they are standing in.
 */
export type KenalanInvite = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  /** Rundown minute, for Notifikasi. */
  at: number;
  /** Unix ms, for the sender's 10-minute "Ajak lagi" cooldown. */
  sentAt: number;
};

/** GET /api/kenalan/invites: received newest first, sent as the latest one per guest. */
export type KenalanInvites = { received: KenalanInvite[]; sent: KenalanInvite[] };

/** The public half of Invite: what is written on the invitation anyway. */
export type PublicEvent = Invite["event"] & { countdown: boolean };

export const api = {
  /**
   * The event itself, with no credential.
   *
   * The first screens need the name, the date and the countdown switch before
   * a guest has necessarily opened their personal link -- from a bookmark, or
   * with the app already installed. Gating this behind the invite token is
   * what made those cases fall back to the values compiled into the bundle.
   */
  event: (): Promise<PublicEvent> => request("/api/event"),

  invite: (): Promise<Invite> => request("/api/invite", { token: token() }),

  /**
   * Who is here. A guest with an uploaded character comes with the URL of its
   * picture: versioned by spriteAt, so it caches hard and a new upload is a
   * new URL. The token rides in the query because an <img> cannot send a
   * header, the same as gallery photos.
   */
  guests: async (): Promise<Guest[]> => {
    const list = await request<(Guest & { spriteAt?: number })[]>("/api/guests", { token: token() });
    const t = encodeURIComponent(token() ?? "");
    return list.map(({ spriteAt, ...g }) =>
      spriteAt ? { ...g, sprite: `${API_URL}/api/guests/${encodeURIComponent(g.id)}/sprite?t=${t}&v=${spriteAt}` } : g,
    );
  },

  /** The picture of this guest's character, for everybody else's kenalan cards. */
  uploadSprite: (dataUrl: string) =>
    request<void>("/api/invite/sprite", { method: "PUT", token: token(), body: { data: dataUrl } }),
  /**
   * The rundown. The server sends sessions (with PIC, speaker, Q&A switch);
   * the guest screens only need the agenda half plus the Q&A switch, so that
   * is all that is kept.
   */
  agenda: async (): Promise<AgendaItem[]> => {
    const list = await request<AgendaItem[]>("/api/agenda", { token: token() });
    return (list ?? []).map(({ id, start, end, title, roomId, qna }) => ({ id, start, end, title, roomId, qna }));
  },
  /** Which session the MC has on stage. */
  live: (): Promise<StageLive> => request("/api/live", { token: token() }),
  questions: (): Promise<AskedQuestion[]> => request("/api/questions", { token: token() }),
  cards: (): Promise<Card[]> => request("/api/cards", { token: token() }),
  announcements: (): Promise<GuestAnnouncement[]> => request("/api/announcements", { token: token() }),
  kenalanInvites: async (): Promise<KenalanInvites> => {
    const r = await request<Partial<KenalanInvites> | null>("/api/kenalan/invites", { token: token() });
    return { received: r?.received ?? [], sent: r?.sent ?? [] };
  },

  /**
   * Not idempotency-keyed and not queued offline: the server's 10-minute
   * cooldown already refuses a repeat (409), and an invite that arrives an
   * hour late, after the guest has left the room, is worse than none.
   */
  inviteKenalan: (guestId: string): Promise<KenalanInvite> =>
    request("/api/kenalan/invites", { method: "POST", token: token(), body: { guestId } }),

  setRsvp: (rsvp: "ya" | "tidak") =>
    request<{ rsvp: string }>("/api/invite/rsvp", { method: "POST", token: token(), body: { rsvp } }),

  checkIn: (by: "qr" | "kode" | "panitia", code?: string) =>
    request<{ checkedIn: boolean; at: number; by: string }>("/api/invite/checkin", {
      method: "POST",
      token: token(),
      body: { by, code },
    }),

  /**
   * Confirming the character is what makes a guest "Hadir", so both travel in
   * one request: one thing to retry, and no state where somebody is counted
   * as present with no character to show on a kenalan card.
   */
  finishCharacter: (outfit: Outfit) =>
    request<{ hadir: boolean; outfit: Outfit }>("/api/invite/hadir", {
      method: "POST",
      token: token(),
      body: { hadir: true, outfit: toWire(outfit) },
      idempotencyKey: newIdempotencyKey(),
    }),

  /**
   * The prize handover: the committee types their PIN on the guest's phone.
   *
   * Not idempotency-keyed, because the server already refuses a second claim
   * outright -- a replay should be told "hadiah sudah diambil", not handed a
   * cached success for a prize that only left the table once.
   */
  claimReward: (pin: string) =>
    request<{ reward: string; claimedAt: number }>("/api/invite/reward", {
      method: "POST",
      token: token(),
      body: { pin },
    }),

  sendQuestion: (q: SendQuestion): Promise<AskedQuestion> =>
    request("/api/questions", {
      method: "POST",
      token: token(),
      body: q,
      idempotencyKey: newIdempotencyKey(),
    }),

  editQuestion: async (q: EditQuestion): Promise<EditQuestion> => {
    await request(`/api/questions/${encodeURIComponent(q.id)}`, {
      method: "PATCH",
      token: token(),
      body: { text: q.text },
    });
    return q;
  },

  deleteQuestion: async (id: string): Promise<string> => {
    await request(`/api/questions/${encodeURIComponent(id)}`, { method: "DELETE", token: token() });
    return id;
  },

  sendEventFeedback: async (f: EventRating): Promise<EventRating> => {
    await request("/api/feedback/event", {
      method: "POST",
      token: token(),
      body: f,
      idempotencyKey: newIdempotencyKey(),
    });
    return f;
  },

  sendFinalFeedback: async (payload: { rating: number; note: string; moods?: string[] }) => {
    await request("/api/feedback/final", {
      method: "POST",
      token: token(),
      body: payload,
      idempotencyKey: newIdempotencyKey(),
    });
    return payload;
  },

  /**
   * The scan or the 4-digit code is checked on the card screen against the
   * guest it was opened from; the server also accepts a bare `code` and
   * resolves it, for a client that only has the number.
   */
  collectCard: async (c: CollectCard): Promise<CollectCard> => {
    await request("/api/cards", {
      method: "POST",
      token: token(),
      // By id: the card was opened from the guest list, so the id is known.
      // Sending it as `code` made the server look for a 4-digit code equal to
      // a guest id, and every card came back "kode tidak ditemukan".
      body: { guestId: c.guestId, note: c.note },
      idempotencyKey: newIdempotencyKey(),
    });
    return c;
  },
};

/**
 * The app models an empty slot as null; the API models it as "".
 *
 * Both are deliberate -- null reads better in the picker, and "" keeps the
 * database columns non-null -- so the translation happens here, at the seam,
 * rather than either side bending to the other.
 */
const toWire = (o: Outfit) => ({
  baju: o.baju ?? "",
  celana: o.celana ?? "",
  aksesoris: o.aksesoris ?? "",
});

export const fromWire = (o: Outfit | { baju: string; celana: string; aksesoris: string }): Outfit => ({
  baju: o.baju || null,
  celana: o.celana || null,
  aksesoris: o.aksesoris || null,
});

export const queryKeys = {
  guests: ["guests"] as const,
  agenda: ["agenda"] as const,
  live: ["live"] as const,
  questions: ["questions"] as const,
  invite: ["invite"] as const,
  cards: ["cards"] as const,
  announcements: ["announcements"] as const,
  kenalanInvites: ["kenalanInvites"] as const,
};

/** Mutation keys are stable strings so paused mutations survive a reload. */
export const mutationKeys = {
  sendQuestion: ["sendQuestion"] as const,
  editQuestion: ["editQuestion"] as const,
  deleteQuestion: ["deleteQuestion"] as const,
  eventFeedback: ["eventFeedback"] as const,
  finalFeedback: ["finalFeedback"] as const,
  collectCard: ["collectCard"] as const,
};
