/** Sample rundown. Times and titles are placeholders until the committee's rundown is final. */
export type AgendaItem = { id: string; start: number; end: number; title: string; roomId: string };
export type AgendaStatus = "done" | "now" | "next" | "later";

const t = (h: number, m = 0) => h * 60 + m;

export const AGENDA: AgendaItem[] = [
  { id: "pembukaan", start: t(9), end: t(9, 30), title: "Pembukaan", roomId: "halaman-depan" },
  { id: "talkshow", start: t(9, 30), end: t(10, 30), title: "Talkshow", roomId: "ruang-omakase" },
  { id: "pengenalan", start: t(10, 30), end: t(11, 15), title: "Pengenalan kantor", roomId: "ruang-kerja-utama" },
  { id: "makan", start: t(11, 30), end: t(12, 45), title: "Makan siang bersama", roomId: "ruang-omakase" },
  { id: "penutupan", start: t(12, 45), end: t(13, 30), title: "Foto bersama & penutupan", roomId: "halaman-depan" },
];

export const DAY_START = t(9);
export const DAY_END = t(14);

export const formatTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}.${String(min % 60).padStart(2, "0")}`;

/** Status of each item at `now`; only the first upcoming item is "next". */
export function statusAt(now: number): Record<string, AgendaStatus> {
  const out: Record<string, AgendaStatus> = {};
  let nextGiven = false;
  for (const a of AGENDA) {
    if (now >= a.end) out[a.id] = "done";
    else if (now >= a.start) out[a.id] = "now";
    else if (!nextGiven) {
      out[a.id] = "next";
      nextGiven = true;
    } else out[a.id] = "later";
  }
  return out;
}

export const currentItem = (now: number) => AGENDA.find((a) => now >= a.start && now < a.end);
export const nextItem = (now: number) => AGENDA.find((a) => a.start > now);
export const eventEndedAt = (now: number) => now >= AGENDA[AGENDA.length - 1].end;
