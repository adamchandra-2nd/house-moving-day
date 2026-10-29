import halamanDepan from "../assets/rooms/halaman-depan.webp";
import ruangKerjaUtama from "../assets/rooms/ruang-kerja-utama.webp";
import ruangKerjaDalam from "../assets/rooms/ruang-kerja-dalam.webp";
import ruangMeeting from "../assets/rooms/ruang-meeting.webp";
import ruangOmakase from "../assets/rooms/ruang-omakase.webp";
import type { IconName } from "../components/iconPaths";

export type Room = {
  id: string;
  name: string;
  /** Background illustration. Temporary Figma AI renders until Nanda's rooms are ready. */
  image: string;
  /** Room icon (admin room headers). */
  icon: IconName;
};

/** The 5 Potara rooms, in swipe order. */
export const ROOMS: Room[] = [
  { id: "halaman-depan", name: "Halaman Depan", image: halamanDepan, icon: "Home" },
  { id: "ruang-kerja-utama", name: "Ruang Kerja Utama", image: ruangKerjaUtama, icon: "Computer" },
  { id: "ruang-kerja-dalam", name: "Ruang Kerja Dalam", image: ruangKerjaDalam, icon: "Bulb" },
  { id: "ruang-meeting", name: "Ruang Meeting", image: ruangMeeting, icon: "Users" },
  { id: "ruang-omakase", name: "Ruang Omakase", image: ruangOmakase, icon: "Restaurant" },
];

export const roomIndexById = (id: string) => Math.max(0, ROOMS.findIndex((r) => r.id === id));
