import { formatTime, type AgendaItem } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import type { Person, ScriptPart } from "./data";

type DraftSession = AgendaItem & { speakerId?: string };

const roomName = (id: string) => ROOMS[roomIndexById(id)]?.name ?? "ruangan acara";

/**
 * A first script for an MC, drafted from the rundown alone.
 *
 * The bundled "Claude" scripts are written for the sample sessions and keyed
 * by their ids, so on a live rundown every session came up empty: the MC's
 * screen showed no script and Pengisi listed every session as "Kosong". This
 * gives each session something to read out -- what it is, where, with whom,
 * what comes next -- for the committee to edit into the real thing.
 */
export function draftScript(session: DraftSession, sessions: DraftSession[], speaker?: Person): ScriptPart[] {
  const ordered = [...sessions].sort((a, b) => a.start - b.start);
  const at = ordered.findIndex((s) => s.id === session.id);
  const first = at === 0;
  const next = at >= 0 ? ordered[at + 1] : undefined;
  const room = roomName(session.roomId);
  const lines: ScriptPart[] = [];

  if (first) {
    lines.push({ label: "Pembuka", text: "Selamat datang di House Moving Day, rumah baru Potara! Terima kasih sudah datang." });
    lines.push({ label: "Poin", text: `Kita mulai dengan ${session.title} di ${room}.` });
    lines.push({ label: "Poin", text: "Ajak tamu check-in di web app kalau belum, lalu mulai kumpulkan kartu kenalan." });
  } else {
    lines.push({ label: "Pembuka", text: `Teman-teman, sekarang kita masuk ke ${session.title} di ${room}.` });
  }
  if (speaker) {
    lines.push({ label: "Poin", text: `Perkenalkan ${speaker.name}${speaker.title ? `, ${speaker.title}` : ""}. Beri tepuk tangan!` });
  }
  if (session.qna !== false && speaker) {
    lines.push({ label: "Poin", text: "Pertanyaan untuk sesi ini bisa dikirim lewat tombol Tanya pembicara di HP kalian." });
  }
  lines.push({ label: "Poin", text: `Sesi ini sampai ${formatTime(session.end)}.` });
  if (next) {
    const move = next.roomId !== session.roomId ? ` di ${roomName(next.roomId)}. Notifikasi pindah ruangan akan muncul di HP kalian` : "";
    lines.push({ label: "Transisi", text: `Setelah ini ${next.title}, jam ${formatTime(next.start)}${move}.` });
  } else {
    lines.push({ label: "Penutup", text: "Itu tadi sesi terakhir. Terima kasih sudah datang! Jangan lupa isi feedback untuk dapat memory card." });
  }
  return lines;
}
