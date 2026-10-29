import { createContext, useContext } from "react";
import { EVENT } from "../config";

/**
 * The event as the committee has configured it.
 *
 * This used to be the `EVENT` constant, read straight out of the bundle by
 * every screen that names the event. That made the Pengaturan page a lie: the
 * committee could rename the event, move it or change its date, and no guest
 * would ever see it -- the same shape of bug the door code had.
 *
 * `EVENT` survives as the default, so a component rendered outside the
 * provider (the admin shell, a review link with no server) still shows
 * something sensible instead of blanks.
 */
export type EventInfo = {
  name: string;
  host: string;
  dateLabel: string;
  place: string;
  /** Countdown target. */
  startsAt: Date;
};

export const EventContext = createContext<EventInfo>(EVENT);

export const useEvent = () => useContext(EventContext);
