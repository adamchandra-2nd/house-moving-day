import { useEffect, useState } from "react";

/**
 * The event clock: minutes since midnight, in the event's own timezone.
 *
 * Everything on screen is in these minutes -- the rundown, check-in times,
 * when a question was asked -- and the server speaks the same unit, so a
 * check-in the API records at minute 545 is 09:05 on every screen that shows
 * it.
 *
 * The admin and the stage sides used a frozen demo time (DEMO_NOW) instead.
 * That was invisible while the data was sampled to match it, and became
 * nonsense the moment real rows arrived: real arrivals landed at whatever
 * minute it actually was, were compared against a clock stuck at 09:50, and
 * drifted in and out of lists that filter by "has this happened yet".
 */

/** Asia/Jakarta. The event is in one place; there is no second zone to serve. */
const EVENT_ZONE = "Asia/Jakarta";

/** Minutes since midnight in the event's timezone, right now. */
export function rundownMinute(at: Date = new Date()): number {
  // Formatting to the event's zone rather than reading the local clock: the
  // committee may well be testing from a laptop set to another timezone, and
  // "what time is it at the venue" is the only question that matters here.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** The calendar day in the event's timezone, as YYYY-MM-DD. */
export function eventDay(at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which also compares correctly as a string.
  return new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Before the event day: earlier than any session, so nothing has started. */
export const BEFORE_EVENT = -1;
/** After the event day: later than any session, so everything has ended. */
export const AFTER_EVENT = 24 * 60;

/**
 * The rundown minute for an event on `day` (YYYY-MM-DD).
 *
 * The rundown only says what time of day each session is, not which day, so
 * the bare time of day made a session at 10:15 "selesai" every evening --
 * on any date, including the week before the event. Off the event day the
 * clock now sits before or after every session instead.
 */
export function eventMinute(day: string | undefined, at: Date = new Date()): number {
  if (!day) return rundownMinute(at);
  const today = eventDay(at);
  if (today < day) return BEFORE_EVENT;
  if (today > day) return AFTER_EVENT;
  return rundownMinute(at);
}

/**
 * The same, ticking.
 *
 * Aligned to the next whole minute rather than polling every second: nothing
 * on these screens is finer than a minute, and a timer per second on a phone
 * left open all day is a battery cost for no visible change.
 */
export function useRundownMinute(day?: string): number {
  const [minute, setMinute] = useState(() => eventMinute(day));

  useEffect(() => {
    let timer: number;
    const tick = () => {
      setMinute(eventMinute(day));
      const now = new Date();
      const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timer = window.setTimeout(tick, msToNextMinute + 50);
    };
    const now = new Date();
    // Re-read at once too: a changed event day must not wait for the minute.
    setMinute(eventMinute(day));
    timer = window.setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    return () => clearTimeout(timer);
  }, [day]);

  return minute;
}
