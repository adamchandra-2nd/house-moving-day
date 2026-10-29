import type { AgendaItem } from "./agenda";
import type { Guest } from "./guests";
import type { AskedQuestion } from "./questions";
import type { Outfit } from "./outfits";
import { newIdempotencyKey, request } from "./http";
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
  event: { name: string; host: string; dateLabel: string; place: string; startsAt: string };
};

export type Card = { guestId: string; note: string };

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

  guests: (): Promise<Guest[]> => request("/api/guests", { token: token() }),
  agenda: (): Promise<AgendaItem[]> => request("/api/agenda", { token: token() }),
  questions: (): Promise<AskedQuestion[]> => request("/api/questions", { token: token() }),
  cards: (): Promise<Card[]> => request("/api/cards", { token: token() }),

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

  sendFinalFeedback: async (payload: { rating: number; note: string }) => {
    await request("/api/feedback/final", {
      method: "POST",
      token: token(),
      body: payload,
      idempotencyKey: newIdempotencyKey(),
    });
    return payload;
  },

  /**
   * Collecting is by the other guest's 4-digit code, which is what is printed
   * on their screen. The server resolves it to a guest, so a typo is a clear
   * "kode tidak ditemukan" rather than somebody else's card.
   */
  collectCard: async (c: CollectCard): Promise<CollectCard> => {
    await request("/api/cards", {
      method: "POST",
      token: token(),
      body: { code: c.guestId, note: c.note },
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
  questions: ["questions"] as const,
  invite: ["invite"] as const,
  cards: ["cards"] as const,
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
