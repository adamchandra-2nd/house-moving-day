/**
 * Guest notifications: everything that popped up (or would have) and is worth
 * reading again later, in the Notifikasi screen behind the bell on Ruangan.
 *
 * The prototype kept these in a localStorage store shared with its admin tab.
 * Here each kind is built from what the server already sends -- announcements,
 * the rundown, the gallery, the guest's own questions, kenalan invites -- and
 * logged into the guest's saved progress, so read/unread survives a reload and
 * belongs to one invite (state.ts keys progress by token).
 */
import type { IconName } from "../components/iconPaths";
import { KENALAN_TARGET } from "../config";
import { announcementKey, type GuestAnnouncement, type KenalanInvite } from "./adapters";
import { firstName, type GalleryPhoto } from "./gallery";
import type { AskedQuestion } from "./questions";

export type NoticeKind = "pengumuman" | "jadwal" | "galeri" | "hadiah" | "tanya" | "kenalan";

/** Where tapping the notification takes the guest. */
export type NoticeTarget =
  | { to: "agenda" }
  | { to: "galeri" }
  | { to: "voucher" }
  | { to: "kartu"; guestId: string }
  | { to: "tanya"; eventId: string }
  | { to: "ruangan"; roomId: string };

export type GuestNotice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** Rundown minute it arrived. */
  at: number;
  read: boolean;
  target?: NoticeTarget;
};

export const NOTICE_KIND: Record<NoticeKind, { label: string; icon: IconName }> = {
  pengumuman: { label: "Pengumuman panitia", icon: "Megaphone" },
  jadwal: { label: "Jadwal", icon: "Calendar" },
  galeri: { label: "Galeri", icon: "Image" },
  hadiah: { label: "Hadiah", icon: "Gift" },
  tanya: { label: "Tanya pembicara", icon: "Message" },
  kenalan: { label: "Kenalan", icon: "UserPlus" },
};

/** What a guest who's been here since the opening has received so far (review cases only). */
export const SAMPLE_NOTICES: GuestNotice[] = [
  { id: "n-tanya-dibaca", kind: "tanya", title: "Pertanyaanmu dibaca MC", body: "“Apa rencana Potara setahun ke depan di rumah baru?”", at: 9 * 60 + 49, read: false, target: { to: "tanya", eventId: "talkshow" } },
  { id: "n-foto", kind: "galeri", title: "Nanda membagikan foto", body: "“Talkshow-nya rame banget!” Lihat dan unduh di Galeri.", at: 9 * 60 + 48, read: false, target: { to: "galeri" } },
  { id: "n-talkshow", kind: "jadwal", title: "Talkshow dimulai di Ruang Omakase", body: "Kamu dipindahkan ke sana saat acara mulai.", at: 9 * 60 + 30, read: true, target: { to: "ruangan", roomId: "ruang-omakase" } },
  { id: "ann-a2", kind: "pengumuman", title: "Talkshow segera mulai", body: "Kursi di Ruang Omakase masih banyak, yuk merapat.", at: 9 * 60 + 25, read: true, target: { to: "ruangan", roomId: "ruang-omakase" } },
  { id: "ann-a1", kind: "pengumuman", title: "Selamat datang!", body: "Check-in di pintu, lalu jelajahi 5 ruangan Potara.", at: 9 * 60 + 2, read: true },
];

/** Add a notice unless it's already there (scenarios replay, polls repeat). */
export const addNotice = (list: GuestNotice[], n: GuestNotice) => (list.some((x) => x.id === n.id) ? list : [n, ...list]);

/** Notices logged as unread, minus the ones already in the list. */
export const addNotices = (list: GuestNotice[], fresh: Omit<GuestNotice, "read">[], read = false) =>
  fresh.reduce((acc, n) => addNotice(acc, { ...n, read }), list);

// ---------- Built from live data ----------

const ANN_PREFIX = "ann-";

/** Keyed by id *and* time, like the toast: the committee's "kirim ulang" is a new one to read. */
export const announcementNotice = (a: GuestAnnouncement): Omit<GuestNotice, "read"> => ({
  id: `${ANN_PREFIX}${announcementKey(a)}`,
  kind: "pengumuman",
  title: a.title,
  body: a.body,
  at: a.at,
  target: a.roomId ? { to: "ruangan", roomId: a.roomId } : undefined,
});

/**
 * Announcements the server no longer lists were deleted by the committee (or
 * resent under a new time): they leave Notifikasi too. Only ever called with a
 * list the server actually answered -- an unloaded query is not "all deleted".
 */
export function pruneAnnouncements(list: GuestNotice[], current: GuestAnnouncement[]): GuestNotice[] {
  const keep = new Set(current.map((a) => `${ANN_PREFIX}${announcementKey(a)}`));
  const next = list.filter((n) => !n.id.startsWith(ANN_PREFIX) || keep.has(n.id));
  return next.length === list.length ? list : next;
}

export const kenalanNotice = (inv: KenalanInvite): Omit<GuestNotice, "read"> => {
  const name = firstName(inv.fromName);
  return {
    id: `kenalan-${inv.id}`,
    kind: "kenalan",
    title: `${name} ngajak kenalan!`,
    body: `Cari ${name}, lalu kalian bisa saling tanya.`,
    at: inv.at,
    target: { to: "kartu", guestId: inv.fromId },
  };
};

/** The MC marking one of this guest's questions read or answered. */
export function questionNotices(questions: AskedQuestion[], now: number): Omit<GuestNotice, "read">[] {
  return questions
    .filter((q) => q.mine && q.status !== "terkirim")
    .map((q) => ({
      id: `tanya-${q.id}-${q.status}`,
      kind: "tanya" as const,
      title: q.status === "terjawab" ? "Pertanyaanmu sudah dijawab" : "Pertanyaanmu dibaca MC",
      body: `“${q.text}”`,
      // The server keeps no time for the status change; when this phone saw it is close enough.
      at: now,
      target: { to: "tanya" as const, eventId: q.eventId },
    }));
}

/** The prize: ready once the cards are in, then handed over. */
export function rewardNotices(cards: number, claimed: boolean, now: number): Omit<GuestNotice, "read">[] {
  if (cards < KENALAN_TARGET) return [];
  const ready = { id: "hadiah-siap", kind: "hadiah" as const, title: "Hadiahmu siap ditukar", body: "Tukar di meja panitia sebelum pulang.", at: now, target: { to: "voucher" as const } };
  if (!claimed) return [ready];
  return [
    ready,
    { id: "hadiah-diambil", kind: "hadiah" as const, title: "Hadiah sudah diambil", body: `Terima kasih sudah kenalan dengan ${KENALAN_TARGET} tamu.`, at: now, target: { to: "voucher" as const } },
  ];
}

/** Other guests' photos that arrived since the last look, as one notice per batch. */
export function photosNotice(added: GalleryPhoto[], now: number): Omit<GuestNotice, "read"> | null {
  if (added.length === 0) return null;
  const authors = [...new Set(added.map((p) => firstName(p.author)))];
  const caption = added.length === 1 ? added[0].caption : undefined;
  return {
    id: `foto-${added[0].id}`,
    kind: "galeri",
    title:
      authors.length > 1
        ? `${added.length} foto baru di Galeri`
        : `${authors[0]} membagikan ${added.length > 1 ? `${added.length} foto` : "foto"}`,
    body: `${caption ? `“${caption}” ` : ""}Lihat dan unduh di Galeri.`,
    at: now,
    target: { to: "galeri" },
  };
}
