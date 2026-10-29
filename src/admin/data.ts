/** Sample data for the admin side until the backend exists. */
import type { AgendaItem } from "../data/agenda";
import { SESSIONS } from "../stage/data";

export type Rsvp = "ya" | "tidak" | "belum";
export type RewardStatus = "mengumpulkan" | "siap" | "diambil";
export type InviteStatus = "belum" | "mengirim" | "terkirim" | "dibaca" | "gagal";
export type AdminGuest = {
  id: string;
  name: string;
  email: string;
  rsvp: Rsvp;
  /** Check-in minute (since 00:00), null = not here yet. */
  checkIn: number | null;
  checkInBy?: "qr" | "kode" | "panitia";
  /** Checked in AND finished their character = "Hadir". Checked in only = "Sedang masuk". */
  hadir: boolean;
  phone: string;
  invite: InviteStatus;
  invitedAt?: number;
  inviteError?: string;
  /** Minute the reward was claimed. */
  claimedAt?: number;
  cards: number;
  reward: RewardStatus;
  finalFeedback: boolean;
};

const NAMES = [
  "David", "Nanda", "Azwar", "Adam", "Sinta", "Raka", "Laras", "Dimas", "Putri", "Bayu", "Citra", "Fajar",
  "Gita", "Hana", "Ilham", "Joko", "Kirana", "Lutfi", "Maya", "Nadia", "Oka", "Pandu", "Rani", "Sekar",
  "Tegar", "Ulfa", "Vina", "Wulan", "Yoga", "Zahra", "Arya", "Bima",
];

/** Deterministic sample guests: most said yes, many already checked in. */
export const ADMIN_GUESTS: AdminGuest[] = NAMES.map((name, i) => {
  const rsvp: Rsvp = i % 11 === 7 ? "tidak" : i % 9 === 8 ? "belum" : "ya";
  const here = rsvp === "ya" && i % 6 !== 5;
  const cards = here ? [5, 3, 2, 5, 1, 4, 0, 5, 2][i % 9] : 0;
  return {
    id: name.toLowerCase(),
    name,
    email: `${name.toLowerCase()}@contoh.id`,
    rsvp,
    checkIn: here ? 9 * 60 + ((i * 7) % 48) : null,
    checkInBy: here ? (i % 8 === 3 ? "panitia" : i % 8 === 6 ? "kode" : "qr") : undefined,
    // Two guests are still in customisation right now
    hadir: here && i !== 4 && i !== 13,
    phone: `0812${String(3000000 + i * 73519).slice(0, 7)}`,
    invite: rsvp === "belum" ? (i % 2 ? "dibaca" : "terkirim") : "dibaca",
    invitedAt: 8 * 60 + (i % 50),
    cards,
    reward: cards >= 5 ? (i % 2 ? "diambil" : "siap") : "mengumpulkan",
    claimedAt: cards >= 5 && i % 2 ? 9 * 60 + 40 + (i % 9) : undefined,
    finalFeedback: false,
  };
});

/** Rundown item + who runs it (brief: the rundown shows the PIC). */
export type AdminEvent = AgendaItem & { pic?: string; speakerId?: string };
export const ADMIN_EVENTS: AdminEvent[] = SESSIONS.map((s) => ({ id: s.id, title: s.title, roomId: s.roomId, start: s.start, end: s.end, pic: s.pic, speakerId: s.speakerId }));

export type Announcement = {
  id: string;
  title: string;
  body: string;
  roomId: string | null;
  at: number;
  recipients: number;
  /** How many opened it (sample until the guest app reports reads). */
  read: number;
  failed?: boolean;
};
export const SAMPLE_ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", title: "Selamat datang!", body: "Check-in di pintu, lalu jelajahi 5 ruangan Potara.", roomId: "halaman-depan", at: 9 * 60 + 2, recipients: 6, read: 6 },
  { id: "a2", title: "Talkshow segera mulai", body: "Kursi di Ruang Omakase masih banyak, yuk merapat.", roomId: "ruang-omakase", at: 9 * 60 + 25, recipients: 18, read: 14 },
];

/** Uninvited guests waiting in the invite list (sample). */
export const NEW_INVITEES = [
  { name: "Andini", phone: "081298765432" },
  { name: "Bagas", phone: "081377712345" },
  { name: "Clara", phone: "085711122233" },
  { name: "Dewa", phone: "081944455566" },
];

/** CSV export sample for the import review (includes problems on purpose). */
export const SAMPLE_CSV = `nama,nomor_wa
Eka,081234567890
Farah,0812-3456-7891
Galih,08123
Hesti,081234567892
,081234567893
Eka,081234567890
Laras,08123441114
Indra,+6281234567894
Jihan,08abc
Kevin,081234567895`;

export type EventFeedbackEntry = { rating: number; text: string; at: number };
export const SAMPLE_EVENT_FEEDBACK: Record<string, EventFeedbackEntry[]> = {
  pembukaan: [
    { rating: 5, text: "Sambutannya hangat, langsung kerasa akrab.", at: 9 * 60 + 31 },
    { rating: 4, text: "Seru, tapi suaranya agak kecil di belakang.", at: 9 * 60 + 32 },
    { rating: 5, text: "Suka banget sama dekorasinya!", at: 9 * 60 + 33 },
    { rating: 3, text: "Agak telat mulainya.", at: 9 * 60 + 35 },
    { rating: 4, text: "Oke!", at: 9 * 60 + 36 },
  ],
};

/** Same event, with answers on every star (review case for the full donut). */
export const SAMPLE_EVENT_FEEDBACK_ALL: Record<string, EventFeedbackEntry[]> = {
  pembukaan: [
    ...SAMPLE_EVENT_FEEDBACK.pembukaan,
    { rating: 5, text: "Pembukaannya pas, nggak kepanjangan.", at: 9 * 60 + 37 },
    { rating: 4, text: "Musiknya enak.", at: 9 * 60 + 38 },
    { rating: 2, text: "Antrean check-in lama, jadi telat masuk.", at: 9 * 60 + 39 },
    { rating: 3, text: "Biasa aja.", at: 9 * 60 + 40 },
    { rating: 1, text: "Nggak kedengeran sama sekali dari belakang.", at: 9 * 60 + 41 },
    { rating: 2, text: "Ruangannya terlalu penuh.", at: 9 * 60 + 42 },
    { rating: 5, text: "Mantap!", at: 9 * 60 + 43 },
  ],
};

export const SAMPLE_FINAL_FEEDBACK = {
  ratings: [0, 1, 2, 6, 9] as number[],
  moods: { "Acaranya seru": 12, "Kantornya keren": 15, "Makanannya enak": 9, "Dapat kenalan baru": 11, "Kurang lama!": 4 } as Record<string, number>,
  messages: ["Semoga betah di rumah baru!", "Makasih undangannya, sukses terus Potara.", "Ruang omakase-nya juara."],
};

export const ADMIN_EMAIL = "admin@potara.id";
/** Prototype PIN "sent" by email. */
export const ADMIN_PIN = "123456";
