import { useEffect, useState } from "react";
import { request } from "../data/http";
import { EVENT } from "../config";
import { handleStageRefusal, loadStageToken } from "./remote";
import { PANITIA_CONTACT, PEOPLE, SESSIONS, setStageContact, setStagePeople, setStageSessions, type Person, type Session, type StageContact } from "./data";

/**
 * What the MC and speaker screens read from the server.
 *
 * These were compiled into the app: the rundown, who is on stage, the
 * questions, the room. That held while nothing was behind them, and became
 * wrong the moment the committee could edit any of it -- an MC reading a
 * rundown from the bundle is reading last week's plan, confidently.
 *
 * The bundled copies survive as the initial value for the review cases
 * (?demo=), so a design link still works with no server. A live screen
 * starts empty instead: an MC reading the bundled rundown on a real event is
 * reading somebody else's plan.
 */

/** One question, as the API stores it. The stage maps this into its own shape. */
export type ApiQuestion = {
  id: string;
  eventId: string;
  text: string;
  author: string | null;
  status: "terkirim" | "dibaca" | "terjawab";
  at: number;
};

/** The room, projected down to what the stage is allowed to see. */
export type StageRoom = {
  here: number;
  rsvpYes: number;
  recent: { name: string; at: number }[];
  rewards: { name: string; status: "mengumpulkan" | "siap" | "diambil" }[];
  /** Per session id: how many rated it, the average, and the 1..5 spread. */
  feedback: Record<string, { count: number; avg: number; counts: number[] }>;
};

export const EMPTY_ROOM: StageRoom = { here: 0, rsvpYes: 0, recent: [], rewards: [], feedback: {} };

/**
 * Loads on mount (and every `refreshMs`), and leaves the current value in
 * place if a request fails.
 *
 * Deliberately not react-query: these screens are a separate lazy chunk with
 * no query client of their own, and one GET per screen does not need a cache
 * layer. `enabled` holds the request back until the stage is signed in, so a
 * login screen does not fire a round of 401s.
 */
function useServerData<T>(path: string, initial: T, refreshMs?: number, enabled = true): T {
  const [data, setData] = useState<T>(initial);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      request<T>(path, { token: loadStageToken() })
        .then((d) => alive && setData(d))
        .catch((e: unknown) => {
          // A refused session goes back to the code screen, a revoked one
          // to the "dicabut" screen; offline keeps whatever this screen
          // already shows.
          if (alive) handleStageRefusal(e);
        });

    void load();
    if (!refreshMs) return () => void (alive = false);

    const timer = window.setInterval(() => void load(), refreshMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, refreshMs, enabled]);

  return data;
}

/** Live screens or a review case; see the note at the top. */
type Mode = { demo: boolean; enabled?: boolean };

/**
 * The rundown the committee edits, and the cast.
 *
 * Both also write into the module registry in stage/data.ts, because
 * `sessionById` and `personById` are called from event handlers where a hook
 * cannot reach.
 */
export function useStageSessions({ demo, enabled = true }: Mode): Session[] {
  // Re-read every half minute when live: the committee edits the rundown
  // during the event, and the MC must not run last hour's plan.
  const list = useServerData<Session[]>("/api/stage/rundown", demo ? SESSIONS : [], demo ? undefined : 30_000, enabled);
  setStageSessions(list);
  return list;
}

export function useStagePeople({ demo, enabled = true }: Mode): Person[] {
  const list = useServerData<Person[]>("/api/stage/people", demo ? PEOPLE : [], demo ? undefined : 30_000, enabled);
  setStagePeople(list);
  return list;
}

/** Questions asked so far, re-read every 10s: the stream is not there on every host. */
export const useStageQuestions = () => useServerData<ApiQuestion[]>("/api/stage/questions", [], 10_000);

/**
 * The room, re-read every half minute.
 *
 * Polled rather than streamed because it is a summary rather than an event:
 * the MC glances at "how many are here" between sessions, and a number that
 * is up to thirty seconds old is no worse than one that is live.
 */
export const useStageRoom = () => useServerData<StageRoom>("/api/stage/room", EMPTY_ROOM, 30_000);

/** What the stage shows about the event itself: name, date, place, and who to call. */
export type StageEvent = { name: string; host: string; dateLabel: string; place: string; contact?: StageContact };

/**
 * The event as the committee set it up, read from the open /api/event.
 *
 * Falls back to the bundled config, which is also what the review cases
 * use: it is the same text the guest side starts from.
 */
export function useStageEvent(demo: boolean): StageEvent {
  const data = useServerData<StageEvent>("/api/event", EVENT, undefined, !demo);
  // The committee member on call, from Pengaturan. Empty until it is set (or
  // loaded): a screen then says so rather than offering a bundled number.
  const contact = demo ? PANITIA_CONTACT : { name: data.contact?.name ?? "", phone: data.contact?.phone ?? "" };
  setStageContact(contact);
  return { name: data.name || EVENT.name, host: data.host || EVENT.host, dateLabel: data.dateLabel || EVENT.dateLabel, place: data.place || EVENT.place, contact };
}
