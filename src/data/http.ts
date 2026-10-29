/**
 * The one place that knows how to talk to the API.
 *
 * Everything above this file deals in promises and typed results; nothing
 * above it writes a header, a URL or a status code. That is what makes
 * adapters.ts swappable rather than merely renamed.
 */

/**
 * Where the API lives.
 *
 * Vite bakes VITE_* into the bundle at build time, so this is public and must
 * never hold anything secret -- it is an address, nothing more. Changing it on
 * a host means a rebuild, not a restart.
 *
 * The fallback is the local server, so `npm run dev` works with no .env at all.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

/**
 * An error the API answered with, as opposed to the network failing.
 *
 * `code` is the machine-readable half the server sends ("revoked",
 * "not_checked_in", "duplicate"), and it is what screens should branch on.
 * `message` is already written in Indonesian and meant to be shown.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got an answer at all. */
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** The invite link was turned off by the committee. */
  get revoked() {
    return this.status === 410;
  }

  /** The token is unknown or malformed: a mistyped or stale link. */
  get unauthorized() {
    return this.status === 401 || this.status === 404;
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer credential: an invite token, or an admin/stage session. */
  token?: string | null;
  /**
   * Makes a retried write land once.
   *
   * Only for writes that are not naturally idempotent -- sending a question,
   * collecting a card. The server stores the result against this key and
   * replays it, so a guest who taps twice on a bad connection, or whose
   * offline queue fires twice, still gets one of whatever they asked for.
   */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    // fetch only rejects when the request never got an answer: offline, DNS,
    // CORS. Status 0 marks it as "no reply" rather than any HTTP outcome, and
    // react-query's offline handling takes it from here.
    throw new ApiError(0, "network", "Tidak bisa menghubungi server");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // A body that is not JSON means a proxy or host answered, not the API.
      // Keep the status, drop the HTML.
      parsed = null;
    }
  }

  if (!res.ok) {
    const e = parsed as { error?: string; code?: string } | null;
    throw new ApiError(res.status, e?.code ?? "error", e?.error ?? `Gagal (${res.status})`);
  }
  return parsed as T;
}

/**
 * A key that is stable for one logical write.
 *
 * crypto.randomUUID is called once by the caller and reused across retries --
 * generating a fresh one per attempt would defeat the whole mechanism.
 */
export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k${Date.now()}-${Math.random().toString(36).slice(2)}`;
