import { del, get, set } from "idb-keyval";

/**
 * The character sprite captured from the Spline scene on /karakter.
 *
 * Spline runs on exactly one screen. Everywhere else the guest sees this
 * still image, so there is no WebGL context on the main area and no 5 MB
 * scene to load again. It lives in IndexedDB rather than localStorage: a
 * webp render is tens of kilobytes and localStorage already carries the
 * progress JSON.
 */
const KEY = "hmd-character-sprite-v1";

type Cached = string | null;

/** undefined = not read from storage yet. */
let cached: Cached | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

export function subscribeSprite(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const spriteSnapshot = (): Cached => cached ?? null;

/** Read once at startup so <Character> never flashes the placeholder. */
export async function initSprite() {
  if (cached !== undefined) return;
  try {
    cached = (await get<string>(KEY)) ?? null;
  } catch {
    cached = null; // storage blocked: the placeholder is used instead
  }
  emit();
}

export async function storeSprite(dataUrl: string) {
  cached = dataUrl;
  emit();
  try {
    await set(KEY, dataUrl);
  } catch {
    /* kept in memory for this session only */
  }
}

export async function clearSprite() {
  cached = null;
  emit();
  try {
    await del(KEY);
  } catch {
    /* nothing to do */
  }
}
