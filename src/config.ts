/** Event settings. Change these when the final rundown is confirmed. */
export const EVENT = {
  name: "House Moving Day",
  host: "Potara Studio",
  dateLabel: "Minggu, 8 November 2026",
  place: "Kantor baru Potara",
  /** Countdown target. Start time is a placeholder until the rundown is final. */
  startsAt: new Date("2026-11-08T09:00:00+07:00"),
  /**
   * The committee member on call. Set on the Pengaturan page and sent with
   * /api/event; empty here so nothing dials a placeholder number.
   */
  contact: { name: "", phone: "" },
};

/** Turn off for Test Day so "Ya" goes straight to "Mulai masuk Potara". */
export const COUNTDOWN_ENABLED = true;

/** Guests need this many kenalan cards for the reward. */
export const KENALAN_TARGET = 5;

/**
 * Starting values for the admin's Pengaturan page, used until the real
 * settings arrive from the API.
 *
 * Nothing is *checked* against these any more. The door code and the
 * committee PIN live in the database and are verified by the server, so the
 * committee can rotate them mid-event. They were compared in the browser
 * once, which meant a rotated code was refused while the old one still
 * worked -- at the door, and at the prize table.
 */
export const DOOR_CODE = "1108";
export const PANITIA_PIN = "2026";
/** This guest's own kenalan code, shown under their QR. */
export const MY_KENALAN_CODE = "4821";

/** Prototype clock for the rundown (minutes since 00:00) until the real event day. */
export const DEMO_NOW = { live: 9 * 60 + 50, soon: 9 * 60 + 25, between: 11 * 60 + 20, ended: 13 * 60 + 50 };

/**
 * Show the clock time next to a check-in, a prize or a rating.
 *
 * Off while the event is being rehearsed: a run-through at two in the
 * morning files everything at 02:14, which reads as broken even when it is
 * exactly right. The relative form ("20 menit lalu") stays either way, since
 * that is the part the committee actually uses at a door.
 *
 * Turn it back on for the real day -- it is this one line, and the times
 * themselves are recorded whatever this says. The CSV export is unaffected:
 * that is a record, not a screen.
 */
export const SHOW_CHECKIN_TIME = false;
