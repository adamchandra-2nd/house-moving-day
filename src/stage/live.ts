import { useEffect, useState } from "react";
import { request } from "../data/http";
import { loadStageToken } from "./remote";
import { PEOPLE, SESSIONS, setStagePeople, setStageSessions, type Person, type Session } from "./data";

/**
 * What the MC and speaker screens read from the server.
 *
 * These were compiled into the app: the rundown, who is on stage, the
 * questions, the room. That held while nothing was behind them, and became
 * wrong the moment the committee could edit any of it -- an MC reading a
 * rundown from the bundle is reading last week's plan, confidently.
 *
 * The bundled copies survive as the initial value, so a screen paints
 * immediately and a design review link still works with no server.
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
 * Loads once, on mount, and leaves the bundled value in place if the request
 * fails.
 *
 * Deliberately not react-query: these screens are a separate lazy chunk with
 * no query client of their own, and one GET per screen does not need a cache
 * layer. `refreshMs` is for the room, which changes as guests arrive.
 */
function useServerData<T>(path: string, initial: T, refreshMs?: number): T {
  const [data, setData] = useState<T>(initial);

  useEffect(() => {
    let alive = true;
    const load = () =>
      request<T>(path, { token: loadStageToken() })
        .then((d) => alive && setData(d))
        .catch(() => {
          // Not signed in yet, or offline. The bundled value stays, which is
          // what this screen showed before any of this existed.
        });

    void load();
    if (!refreshMs) return () => void (alive = false);

    const timer = window.setInterval(() => void load(), refreshMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, refreshMs]);

  return data;
}

/**
 * The rundown the committee edits, and the cast.
 *
 * Both also write into the module registry in stage/data.ts, because
 * `sessionById` and `personById` are called from event handlers where a hook
 * cannot reach.
 */
export function useStageSessions(): Session[] {
  const list = useServerData<Session[]>("/api/stage/rundown", SESSIONS);
  setStageSessions(list);
  return list;
}

export function useStagePeople(): Person[] {
  const list = useServerData<Person[]>("/api/stage/people", PEOPLE);
  setStagePeople(list);
  return list;
}

/** Questions asked so far. New ones also arrive over the stream. */
export const useStageQuestions = () => useServerData<ApiQuestion[]>("/api/stage/questions", []);

/**
 * The room, re-read every half minute.
 *
 * Polled rather than streamed because it is a summary rather than an event:
 * the MC glances at "how many are here" between sessions, and a number that
 * is up to thirty seconds old is no worse than one that is live.
 */
export const useStageRoom = () => useServerData<StageRoom>("/api/stage/room", EMPTY_ROOM, 30_000);
