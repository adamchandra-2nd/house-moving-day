import { useSyncExternalStore } from "react";

export type AgendaItem = {
  id: string;
  start: number;
  end: number;
  title: string;
  roomId: string;
  /** Whether guests may send this session questions. Missing (the sample rundown) means yes. */
  qna?: boolean;
};

/** "Tanya pembicara" is offered only where the committee switched Q&A on. */
export const hasQna = (a: AgendaItem) => a.qna !== false;
export type AgendaStatus = "done" | "now" | "next" | "later";

const t = (h: number, m = 0) => h * 60 + m;

/**
 * The sample rundown, for review links (?demo=, old #token) only.
 *
 * It is not the live rundown any more. Its ids ("talkshow") are not sessions
 * in the database, and a guest question or a rating posts its eventId as a
 * foreign key to one -- so in live mode these must never be what a screen
 * reads. See setAgenda() below.
 */
export const AGENDA: AgendaItem[] = [
  { id: "pembukaan", start: t(9), end: t(9, 30), title: "Pembukaan", roomId: "halaman-depan" },
  { id: "talkshow", start: t(9, 30), end: t(10, 30), title: "Talkshow", roomId: "ruang-omakase" },
  { id: "pengenalan", start: t(10, 30), end: t(11, 15), title: "Pengenalan kantor", roomId: "ruang-kerja-utama" },
  { id: "makan", start: t(11, 30), end: t(12, 45), title: "Makan siang bersama", roomId: "ruang-omakase" },
  { id: "penutupan", start: t(12, 45), end: t(13, 30), title: "Foto bersama & penutupan", roomId: "halaman-depan" },
];

export const DAY_START = t(9);
export const DAY_END = t(14);

/**
 * The rundown every pure function below reads.
 *
 * A registry rather than the constant: the committee edits the rundown on the
 * day, and statusAt()/currentItem() are called from too many places to thread
 * a list through all of them. Live mode fills it from GET /api/agenda (see
 * useAgendaQuery in data/queries.ts); a review link fills it with AGENDA.
 *
 * It starts with the sample only when the page was opened as a review link,
 * so a review case renders right on its first paint. Everywhere else it starts
 * empty: an invented rundown on a real guest's phone is worse than none.
 */
const openedAsReview = (() => {
  try {
    return new URLSearchParams(window.location.search).has("demo") || window.location.hash.length > 1;
  } catch {
    return false;
  }
})();

let current: AgendaItem[] = openedAsReview ? AGENDA : [];
const listeners = new Set<() => void>();

/** Replaces the rundown and re-renders everything reading it through useAgenda(). */
export function setAgenda(list: AgendaItem[]) {
  const sorted = [...list].sort((a, b) => a.start - b.start || a.end - b.end);
  // Same rundown again (a refetch with nothing changed): keep the reference,
  // so nobody re-renders for it.
  if (JSON.stringify(sorted) === JSON.stringify(current)) return;
  current = sorted;
  listeners.forEach((l) => l());
}

export const getAgenda = () => current;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The current rundown, re-rendering when it changes. */
export const useAgenda = () => useSyncExternalStore(subscribe, getAgenda);

export const formatTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}.${String(min % 60).padStart(2, "0")}`;

/** Status of each item at `now`; only the first upcoming item is "next". */
export function statusAt(now: number): Record<string, AgendaStatus> {
  const out: Record<string, AgendaStatus> = {};
  let nextGiven = false;
  for (const a of current) {
    if (now >= a.end) out[a.id] = "done";
    else if (now >= a.start) out[a.id] = "now";
    else if (!nextGiven) {
      out[a.id] = "next";
      nextGiven = true;
    } else out[a.id] = "later";
  }
  return out;
}

export const currentItem = (now: number) => current.find((a) => now >= a.start && now < a.end);
export const nextItem = (now: number) => current.find((a) => a.start > now);
/** An empty rundown has not ended: there is nothing yet to have finished. */
export const eventEndedAt = (now: number) => current.length > 0 && now >= Math.max(...current.map((a) => a.end));
