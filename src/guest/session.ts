/**
 * The guest's invite token: where it comes from, and where it is kept.
 *
 * The token is the whole identity in this app. There is no password and no
 * account -- holding the link *is* being that guest. So it is treated like a
 * session: read once out of the URL, kept for the rest of the event, and sent
 * as a bearer credential on every request.
 */

const STORAGE_KEY = "hmd.invite.token";

/** Tokens are 16 characters from an alphabet with no i, l, o, u -- and no dash. */
const TOKEN_LENGTH = 16;
const TOKEN_SHAPE = /^[0-9abcdefghjkmnpqrstvwxyz]{16}$/;

/**
 * Pulls the token out of an invite path.
 *
 * The link the committee sends carries the guest's name in front of the
 * token, the way a paper invitation has a name on it:
 *
 *   /u/budi-santoso-k4m2p9xr7tn3vq1w
 *
 * The name is decoration and the server never reads it, so this takes the last
 * 16 characters and checks their shape. That is unambiguous however many
 * dashes the name contains, because the token's alphabet has none.
 *
 * Returns null for anything that is not a token, which is what makes a
 * mistyped link fail as "this link is not valid" rather than as a server
 * error.
 */
export function tokenFromPath(raw: string): string | null {
  const segment = raw.trim().replace(/^\/+|\/+$/g, "");
  if (segment.length < TOKEN_LENGTH) return null;
  const candidate = segment.slice(-TOKEN_LENGTH).toLowerCase();
  return TOKEN_SHAPE.test(candidate) ? candidate : null;
}

/**
 * Reads and writes are wrapped because localStorage throws rather than
 * returning null in a private window with site data blocked. A guest in that
 * situation should still be able to use the link they just opened, so the
 * in-memory copy is the one that actually answers.
 */
let current: string | null = null;

export function loadToken(): string | null {
  if (current) return current;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && TOKEN_SHAPE.test(stored)) current = stored;
  } catch {
    // Blocked storage. The token lives in memory for this tab instead.
  }
  return current;
}

export function saveToken(token: string) {
  current = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // See above: the guest keeps working, they just start over on reload.
  }
}

/** Used when the committee revokes a link, so the dead token is not retried. */
export function clearToken() {
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
