import { API_URL, ApiError, request } from "../data/http";
import type { Person } from "./data";
import { EMPTY_STAGE, type StageState } from "./store";

/**
 * The shared stage document, on the server.
 *
 * The MC, the speaker and the committee all edit one state: which session is
 * live, which questions have been read, the scripts the committee wrote. It
 * used to live in localStorage and sync between tabs through the `storage`
 * event, which works beautifully on one laptop and not at all between the
 * MC's phone and the committee's laptop -- the case the event actually has.
 *
 * The server keeps the document opaque (see Store.StageState): its shape is
 * this file's business. What the server adds is a revision number and a
 * stream.
 */

const STORAGE_KEY = "hmd-stage-v1";

/** Credential for the stage sides; the committee uses its admin session. */
let stageToken: string | null = null;

export function setStageToken(t: string | null) {
  stageToken = t;
  try {
    if (t) localStorage.setItem("hmd.stage.session", t);
    else localStorage.removeItem("hmd.stage.session");
  } catch {
    /* blocked storage: the token lives for this tab only */
  }
}

export function loadStageToken(): string | null {
  if (stageToken) return stageToken;
  try {
    stageToken = localStorage.getItem("hmd.stage.session");
  } catch {
    /* see above */
  }
  return stageToken;
}

/**
 * Who signed in on this device, kept next to the token.
 *
 * The token alone says nothing the screen can read, and the MC side has to
 * know *which* MC is holding the phone -- the first MC in the cast is only
 * right while there is exactly one.
 */
const ME_KEY = "hmd.stage.me";

export function saveStageMe(p: Person | null) {
  try {
    if (p) localStorage.setItem(ME_KEY, JSON.stringify(p));
    else localStorage.removeItem(ME_KEY);
  } catch {
    /* blocked storage: signed in for this tab only */
  }
}

export function loadStageMe(): Person | null {
  try {
    const p = JSON.parse(localStorage.getItem(ME_KEY) ?? "null");
    return p?.id && p?.role ? (p as Person) : null;
  } catch {
    return null;
  }
}

/** Fired when the server refuses the stage session, so the gate can ask for the code again. */
export const STAGE_EXPIRED = "hmd:stage-expired";

/**
 * Forgets the session after a 401.
 *
 * Only for the stage's own token: the committee calls the same endpoints with
 * its admin session, and its 401 is the admin's to handle.
 */
export function expireStageSession() {
  setStageToken(null);
  saveStageMe(null);
  window.dispatchEvent(new Event(STAGE_EXPIRED));
}

/** A 401 on a request that went out with the stage's own session. */
export function isStageExpiry(e: unknown, explicitToken?: string | null) {
  return e instanceof ApiError && e.status === 401 && !explicitToken && Boolean(loadStageToken());
}

/** Fired when the committee revoked (or removed) whoever is signed in here. */
export const STAGE_REVOKED = "hmd:stage-revoked";

/**
 * A 410: the committee took this person off the stage.
 *
 * Unlike a 401 this is not worth a new code -- the server would refuse the
 * login too -- and unlike a network error it is not worth retrying. Only for
 * the stage's own session, as with isStageExpiry.
 */
export function isStageRevoked(e: unknown, explicitToken?: string | null) {
  return e instanceof ApiError && e.status === 410 && !explicitToken && Boolean(loadStageToken());
}

/** Forgets the session and whatever it painted, then lets the gate show the "dicabut" screen. */
export function revokeStageSession() {
  setStageToken(null);
  saveStageMe(null);
  clearCache();
  window.dispatchEvent(new Event(STAGE_REVOKED));
}

/**
 * What every stage request does with a refusal: 410 signs out for good, 401
 * goes back to the code. The token check in both means only the first of a
 * burst of failing requests acts; the rest find the session already gone.
 */
export function handleStageRefusal(e: unknown, explicitToken?: string | null) {
  if (isStageRevoked(e, explicitToken)) revokeStageSession();
  else if (isStageExpiry(e, explicitToken)) expireStageSession();
}

/**
 * The person a personal link points at, before anyone has signed in.
 *
 * No credential: this is what the login screen greets with. The server masks
 * the phone number itself, so the full number never reaches a browser that
 * has only the link.
 */
export function fetchStagePerson(id: string) {
  return request<Person>(`/api/stage/person/${encodeURIComponent(id)}`);
}

/** The `?p=` from the personal link, kept per side so a reload without it still knows who. */
const linkKey = (side: string) => `hmd.stage.p.${side}`;

export function saveStageLink(side: string, personId: string) {
  try {
    localStorage.setItem(linkKey(side), personId);
  } catch {
    /* see above */
  }
}

export function loadStageLink(side: string): string | null {
  try {
    return localStorage.getItem(linkKey(side));
  } catch {
    return null;
  }
}

type Envelope = { rev: number; state: StageState | null };

/**
 * The revision last read, and what has to be sent back with a write.
 *
 * Optimistic locking: a PUT carrying a stale rev is refused with 409 rather
 * than quietly overwriting whatever the other side just did. Two people
 * editing the same live state is the normal case here, not the exception.
 */
let rev = 0;

/**
 * Fills in any field the stored document lacks.
 *
 * The server keeps the state opaque, so a document written by an older build
 * -- or by hand -- can be missing fields this one reads, and one missing array
 * was enough to take the whole MC screen down.
 */
function withDefaults(s: StageState | null): StageState | null {
  return s ? { ...EMPTY_STAGE(), ...s } : null;
}

export async function pull(token: string | null): Promise<StageState | null> {
  try {
    const env = await request<Envelope>("/api/stage/state", { token: token ?? loadStageToken() });
    rev = env.rev;
    return withDefaults(env.state);
  } catch (e) {
    handleStageRefusal(e, token);
    throw e;
  }
}

/**
 * Writes, and resolves the one conflict that matters.
 *
 * On 409 the caller's edit is not thrown away: the newer state is pulled, the
 * caller's change re-applied to it, and the write retried once. That is the
 * right answer for this document because the edits are disjoint in practice
 * -- the MC ticks a script line while the committee rewrites another session
 * -- and asking a person at a live event to redo their tap is not an option.
 */
export async function push(next: StageState, token: string | null, reapply?: (latest: StageState) => StageState): Promise<StageState> {
  const t = token ?? loadStageToken();
  try {
    const env = await request<Envelope>("/api/stage/state", { method: "PUT", token: t, body: { rev, state: next } });
    rev = env.rev;
    return next;
  } catch (e) {
    handleStageRefusal(e, token);
    if (!(e instanceof ApiError) || e.status !== 409 || !reapply) throw e;
    const latest = await pull(t);
    const merged = reapply(latest ?? next);
    const env = await request<Envelope>("/api/stage/state", { method: "PUT", token: t, body: { rev, state: merged } });
    rev = env.rev;
    return merged;
  }
}

/**
 * Server-sent events: the other side's changes, pushed.
 *
 * EventSource cannot carry an Authorization header, so the token rides in the
 * query string for this one endpoint. That is why the server's request log
 * records paths and never query strings.
 *
 * Returns a stop function. Reconnection is the browser's job -- the server
 * sends `retry:` and a heartbeat, so a phone that loses wifi in a basement
 * picks the stream back up by itself.
 */
export function subscribe(token: string | null, onState: (s: StageState, r: number) => void): () => void {
  const t = token ?? loadStageToken();
  if (!t) return () => {};

  const es = new EventSource(`${API_URL}/api/stage/stream?t=${encodeURIComponent(t)}`);
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as { kind: string; rev?: number; state?: StageState };
      if (msg.kind !== "state" || !msg.state) return;
      // Ignore an echo of our own write, and anything older than what we hold.
      if (typeof msg.rev === "number" && msg.rev <= rev) return;
      if (typeof msg.rev === "number") rev = msg.rev;
      onState(withDefaults(msg.state)!, rev);
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  };
  // The browser only gives up for good on a refused request (a 401 or 410
  // among them) and cannot say which. One plain read tells; pull() signs the
  // stage out -- or shows it was revoked -- if the session is what was refused.
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED && !token) void pull(null).catch(() => undefined);
  };
  return () => es.close();
}

/** The local copy, kept so a reload paints before the first response lands. */
export function readCache(): StageState | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return s?.phase ? withDefaults(s as StageState) : null;
  } catch {
    return null;
  }
}

/** Drops the local copy: a new sign-in must not paint whatever an earlier demo left behind. */
export function clearCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see above */
  }
}

export function writeCache(s: StageState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the server copy is the real one anyway */
  }
}

/**
 * Exchanges the shared stage code for a session.
 *
 * personId says which MC or speaker is signing in; the server reads the role
 * from that person's record rather than trusting the request, so the MC's
 * code cannot be used to open the speaker's side.
 */
export function stageLogin(code: string, personId: string) {
  return request<{ token: string; person: Person }>("/api/stage/login", {
    method: "POST",
    body: { code, personId },
  });
}

/** An announcement as the server stored it; guests' phones read the same row. */
export type SentAnnouncement = { id: string; title: string; body: string; roomId: string | null; at: number; source: "mc" | "panitia" };

/**
 * The MC's announcement, sent to the guests.
 *
 * It used to live only in the stage document, which no guest's phone reads:
 * the MC saw "terkirim" and the room saw nothing. MC only; the server checks
 * the role.
 */
export async function sendAnnouncement(a: { title: string; body: string; roomId: string | null }) {
  try {
    return await request<SentAnnouncement>("/api/stage/announcements", { method: "POST", token: loadStageToken(), body: a });
  } catch (e) {
    handleStageRefusal(e);
    throw e;
  }
}
