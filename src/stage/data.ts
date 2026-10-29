/** Sample data for the MC and Performance sides (people on stage), until the backend exists. */
import { AGENDA, type AgendaItem } from "../data/agenda";

export type Session = AgendaItem & {
  /** Person in charge from the committee (brief: rundown shows the PIC). */
  pic: string;
  /** Outside speaker, if any. */
  speakerId?: string;
  /** Guests can send questions during this session. */
  qna: boolean;
};

export type Person = { id: string; name: string; role: "mc" | "pembicara"; title: string; phone: string };

export const PEOPLE: Person[] = [
  { id: "nadia", name: "Nadia Putri", role: "mc", title: "MC", phone: "081234561114" },
  { id: "ardi", name: "Ardi Nugraha", role: "pembicara", title: "Guest star talkshow", phone: "081377705512" },
];
export const personById = (id?: string) => livePeople.find((p) => p.id === id);

const EXTRA: Record<string, { pic: string; speakerId?: string; qna: boolean }> = {
  pembukaan: { pic: "Azwar", qna: false },
  talkshow: { pic: "Adam", speakerId: "ardi", qna: true },
  pengenalan: { pic: "Nanda", qna: true },
  makan: { pic: "Azwar", qna: false },
  penutupan: { pic: "David", qna: false },
};

/** The bundled rundown: the starting value, replaced once the API answers. */
export const SESSIONS: Session[] = AGENDA.map((a) => ({ ...a, ...EXTRA[a.id] }));

/**
 * The live rundown and cast.
 *
 * A module-level registry rather than a context because these are read from
 * inside event handlers as well as from render -- `sessionById` is called
 * when the MC taps "mulai sesi", where a hook cannot go. The hooks in
 * stage/live.ts write here; components re-render because those hooks also
 * hold the value in state.
 */
let liveSessions: Session[] = SESSIONS;
let livePeople: Person[] = PEOPLE;

export function setStageSessions(list: Session[]) {
  liveSessions = list;
}
export function setStagePeople(list: Person[]) {
  livePeople = list;
}

export const allSessions = () => liveSessions;
export const allPeople = () => livePeople;

/**
 * Returns undefined for an id the rundown does not have -- which happens for
 * real now that the committee can delete a session while the MC is looking
 * at it. It used to assert the row existed, which turned that into a crash
 * on stage.
 */
export const sessionById = (id: string): Session | undefined => liveSessions.find((s) => s.id === id);

/** Committee contact shown to outside MC/speakers. */
export const PANITIA_CONTACT = { name: "Azwar (panitia)", phone: "0812 3456 7788" };

/** Script lines suggested by Claude from the rundown. Two variants so "Saran lain" has something to show. */
export type ScriptPart = { label: "Pembuka" | "Poin" | "Transisi" | "Penutup"; text: string };
export const SCRIPTS: Record<string, ScriptPart[][]> = {
  pembukaan: [
    [
      { label: "Pembuka", text: "Selamat pagi semuanya, selamat datang di rumah baru Potara! Saya Nadia, yang akan menemani kalian hari ini." },
      { label: "Poin", text: "Ajak tamu buka web app di HP dan check-in kalau belum." },
      { label: "Poin", text: "Ingatkan: kumpulkan 5 kartu kenalan untuk dapat hadiah." },
      { label: "Transisi", text: "Sebentar lagi kita pindah ke Ruang Omakase untuk talkshow. Notifikasinya akan muncul di HP kalian." },
    ],
    [
      { label: "Pembuka", text: "Halo semuanya! Terima kasih sudah datang ke House Moving Day. Hari ini Potara resmi pindah rumah." },
      { label: "Poin", text: "Cek HP: pastikan karakter kalian sudah jadi, karena itu tanda kalian sudah hadir." },
      { label: "Poin", text: "Ada 5 ruangan untuk dijelajahi. Geser layar untuk pindah ruangan." },
      { label: "Transisi", text: "Yuk kita lanjut ke talkshow di Ruang Omakase." },
    ],
  ],
  talkshow: [
    [
      { label: "Pembuka", text: "Kita masuk ke sesi yang paling ditunggu: talkshow bersama Ardi Nugraha, guest star kita hari ini." },
      { label: "Poin", text: "Perkenalkan Ardi: perjalanan kariernya dan hubungannya dengan Potara." },
      { label: "Poin", text: "Ingatkan tamu: pertanyaan bisa dikirim lewat tombol Tanya pembicara di HP." },
      { label: "Transisi", text: "Di tengah talkshow, tim Potara akan ajak kita kenalan dengan kantor baru." },
      { label: "Penutup", text: "Terima kasih, Ardi! Beri tepuk tangan yang meriah. Jangan lupa isi feedback sesi ini di HP." },
    ],
    [
      { label: "Pembuka", text: "Saatnya talkshow! Sambut guest star kita, Ardi Nugraha." },
      { label: "Poin", text: "Tanya ke Ardi: apa arti 'rumah' untuk sebuah studio kreatif?" },
      { label: "Poin", text: "Buka sesi tanya jawab 15 menit sebelum selesai." },
      { label: "Penutup", text: "Sekali lagi terima kasih, Ardi. Feedback sesi sudah bisa diisi di HP masing-masing." },
    ],
  ],
  pengenalan: [
    [
      { label: "Pembuka", text: "Sekarang kita kenalan sama rumah baru Potara, dipandu Nanda dari tim Potara." },
      { label: "Poin", text: "Ajak tamu mengikuti tur ke Ruang Kerja Utama." },
      { label: "Transisi", text: "Setelah tur, kita istirahat dan makan siang bersama di Ruang Omakase." },
    ],
  ],
  makan: [
    [
      { label: "Pembuka", text: "Waktunya makan siang! Silakan menuju Ruang Omakase." },
      { label: "Poin", text: "Momen pas untuk kenalan dan tukar kartu, masih ada yang belum dapat 5 kartu?" },
      { label: "Transisi", text: "Habis makan, kita kumpul lagi di Halaman Depan untuk foto bersama." },
    ],
  ],
  penutupan: [
    [
      { label: "Pembuka", text: "Kita sampai di penghujung acara. Yuk kumpul di Halaman Depan untuk foto bersama." },
      { label: "Poin", text: "Ingatkan tukar voucher hadiah di meja panitia." },
      { label: "Penutup", text: "Terima kasih sudah merayakan rumah baru Potara. Isi feedback akhir di HP ya, sampai jumpa lagi!" },
    ],
  ],
};

/** Guest questions with the topic Claude grouped them under. */
export type StageQuestionState = "masuk" | "dipilih" | "dibacakan" | "dijawab" | "dilewati";
export type StageQuestion = { id: string; sessionId: string; text: string; author: string | null; at: number; groupId: string; state: StageQuestionState };
export type QuestionGroup = { id: string; label: string };

export const QUESTION_GROUPS: QuestionGroup[] = [
  { id: "kantor", label: "Soal kantor baru" },
  { id: "proses", label: "Proses kreatif" },
  { id: "rencana", label: "Rencana Potara" },
  { id: "karier", label: "Karier & tips" },
];

const q = (id: string, groupId: string, text: string, author: string | null, at: number, state: StageQuestionState = "masuk"): StageQuestion => ({
  id,
  sessionId: "talkshow",
  groupId,
  text,
  author,
  at,
  state,
});

export const SAMPLE_STAGE_QUESTIONS: StageQuestion[] = [
  q("q1", "kantor", "Kenapa akhirnya pilih pindah ke kantor ini?", "Sinta", 9 * 60 + 36, "dijawab"),
  q("q2", "proses", "Ruangan mana yang paling susah didesain?", null, 9 * 60 + 41, "dipilih"),
  q("q3", "rencana", "Apa rencana Potara setahun ke depan di rumah baru?", "David", 9 * 60 + 47),
  q("q4", "kantor", "Ada ruang buat tamu kerja bareng nggak nanti?", "Raka", 9 * 60 + 48),
  q("q5", "karier", "Mas Ardi, tips buat yang mau mulai karier di studio kreatif?", "Laras", 9 * 60 + 44),
  q("q6", "kantor", "Kenapa ruang makannya dinamai Omakase?", "Dimas", 9 * 60 + 45),
  q("q7", "proses", "Gimana cara tim Potara bagi tugas pas pindahan?", null, 9 * 60 + 46),
  q("q8", "karier", "Apa kesalahan terbesar waktu awal bikin studio?", "Putri", 9 * 60 + 43, "dilewati"),
  q("q9", "rencana", "Bakal sering bikin acara kayak gini lagi?", "Bayu", 9 * 60 + 49),
];

/** Ready-made announcements the MC can send in one tap. */
export const ANNOUNCE_TEMPLATES: { title: string; body: string; roomId: string | null; icon: "Camera" | "Restaurant" | "Home" | "Message" | "Gift" }[] = [
  { title: "Foto bersama 5 menit lagi", body: "Kumpul di Halaman Depan ya!", roomId: "halaman-depan", icon: "Camera" },
  { title: "Makan siang sudah siap", body: "Silakan menuju Ruang Omakase.", roomId: "ruang-omakase", icon: "Restaurant" },
  { title: "Talkshow segera mulai", body: "Kursi di Ruang Omakase masih banyak.", roomId: "ruang-omakase", icon: "Message" },
  { title: "Tukar hadiah", body: "Yang sudah punya 5 kartu, tukar voucher di meja panitia.", roomId: null, icon: "Gift" },
];

/** Signals the MC sends to the speaker's screen. */
export type McSignal = "5-menit" | "tanya-jawab" | "akhiri" | "terima-kasih";
export const SIGNAL_TONE: Record<McSignal, "amber" | "pink" | "red" | "green"> = { "5-menit": "amber", "tanya-jawab": "pink", akhiri: "red", "terima-kasih": "green" };
export const MC_SIGNALS: Record<McSignal, { title: string; body: string; icon: "Clock" | "Message" | "Close" | "Check" }> = {
  "5-menit": { title: "5 menit lagi", body: "Mulai arahkan ke penutup ya.", icon: "Clock" },
  "tanya-jawab": { title: "Waktunya tanya jawab", body: "Pertanyaan pilihan MC sudah ada di tab Pertanyaan.", icon: "Message" },
  akhiri: { title: "Mohon diakhiri", body: "Waktu sesi sudah habis. MC akan mengambil alih.", icon: "Close" },
  "terima-kasih": { title: "Terima kasih!", body: "Sesi selesai. Tamu sedang mengisi feedback.", icon: "Check" },
};

/** What the speaker can send back. */
export type SpeakerHelp = "mic" | "slide" | "lainnya";
export const HELP_LABEL: Record<SpeakerHelp, string> = { mic: "Mic bermasalah", slide: "Slide / layar", lainnya: "Butuh bantuan lain" };
/** Short form for the one-line status tag. */
export const HELP_SHORT: Record<SpeakerHelp, string> = { mic: "Mic", slide: "Slide", lainnya: "Lainnya" };

/** Feedback guests left for the talkshow (shown to the speaker after the session). */
export const TALKSHOW_FEEDBACK = {
  ratings: [5, 5, 4, 5, 4, 5, 3, 5, 4, 5, 5, 4],
  comments: ["Ceritanya relate banget, makasih Mas Ardi!", "Tips kariernya berguna.", "Pengen sesinya lebih lama!", "Jawabannya jujur dan lucu."],
};
