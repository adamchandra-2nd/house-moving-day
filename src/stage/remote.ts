import { API_URL, ApiError, request } from "../data/http";
import type { StageState } from "./store";

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

type Envelope = { rev: number; state: StageState | null };

/**
 * The revision last read, and what has to be sent back with a write.
 *
 * Optimistic locking: a PUT carrying a stale rev is refused with 409 rather
 * than quietly overwriting whatever the other side just did. Two people
 * editing the same live state is the normal case here, not the exception.
 */
let rev = 0;

export async function pull(token: string | null): Promise<StageState | null> {
  const env = await request<Envelope>("/api/stage/state", { token: token ?? loadStageToken() });
  rev = env.rev;
  return env.state;
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
      onState(msg.state, rev);
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  };
  return () => es.close();
}

/** The local copy, kept so a reload paints before the first response lands. */
export function readCache(): StageState | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return s?.phase ? (s as StageState) : null;
  } catch {
    return null;
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
  return request<{ token: string; person: { id: string; name: string; role: string } }>("/api/stage/login", {
    method: "POST",
    body: { code, personId },
  });
}
