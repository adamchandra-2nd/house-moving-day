/** Questions sent to the speaker/MC through the app. Sample data until the MC side exists. */
export type QuestionStatus = "terkirim" | "dibaca" | "terjawab";
export type AskedQuestion = {
  id: string;
  eventId: string;
  text: string;
  /** null = sent anonymously. */
  author: string | null;
  mine: boolean;
  status: QuestionStatus;
  /** Rundown clock minute it was sent. */
  at: number;
  edited?: boolean;
};

export const SAMPLE_QUESTIONS: AskedQuestion[] = [
  { id: "q1", eventId: "talkshow", text: "Kenapa akhirnya pilih pindah ke kantor ini?", author: "Sinta", mine: false, status: "terjawab", at: 9 * 60 + 36 },
  { id: "q2", eventId: "talkshow", text: "Ruangan mana yang paling susah didesain?", author: null, mine: false, status: "dibaca", at: 9 * 60 + 41 },
  { id: "q3", eventId: "talkshow", text: "Apa rencana Potara setahun ke depan di rumah baru?", author: "David", mine: true, status: "terkirim", at: 9 * 60 + 47 },
  { id: "q4", eventId: "talkshow", text: "Ada ruang buat tamu kerja bareng nggak nanti?", author: "Raka", mine: false, status: "terkirim", at: 9 * 60 + 48 },
];

export const QUESTION_MAX = 200;
