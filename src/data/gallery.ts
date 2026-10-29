import { ROOMS } from "./rooms";

/** Shared gallery: photos guests pick from their phone's gallery (no in-app camera). */
export const GALLERY_MAX = 5;
export const CAPTION_MAX = 100;
export const PHOTO_MAX_MB = 10;

export type GalleryPhoto = {
  id: string;
  src: string;
  author: string;
  mine: boolean;
  /** Rundown minute it was shared. */
  at: number;
  roomId: string;
  caption?: string;
  /** Blurred by the committee: other guests can't open or download it. */
  censored?: boolean;
  /** Optional note for the committee only; never shown to guests. */
  censorReason?: string;
};

/** Quick picks for the censor reason (admin). */
export const CENSOR_REASONS = ["Tidak pantas", "Privasi tamu lain", "Tidak terkait acara"];
export const CENSOR_REASON_MAX = 100;

/** Guests are shown by first name only, so tiles and toasts stay short. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0];

/**
 * A photo picked for upload, before it's shared.
 *
 * `src` is an object URL, for the preview only. `file` is the picture itself,
 * which the upload needs in order to resize it -- the prototype never sent
 * anything, so it only kept the preview. Optional because the review links
 * fabricate picks from room art, with no file behind them.
 */
export type PickedPhoto = { key: string; src: string; caption: string; file?: File };

const room = (i: number) => ROOMS[i];

/** Sample feed until uploads go to the backend. Room illustrations stand in for guests' photos. */
export const SAMPLE_PHOTOS: GalleryPhoto[] = [
  { id: "p1", src: room(4).image, author: "Nanda", mine: false, at: 9 * 60 + 48, roomId: room(4).id, caption: "Talkshow-nya rame banget!" },
  { id: "p2", src: room(1).image, author: "David", mine: true, at: 9 * 60 + 41, roomId: room(1).id, caption: "Meja baru, semangat baru." },
  { id: "p3", src: room(3).image, author: "Sinta Maharani", mine: false, at: 9 * 60 + 36, roomId: room(3).id },
  { id: "p4", src: room(0).image, author: "Azwar", mine: false, at: 9 * 60 + 22, roomId: room(0).id, caption: "Pintu keycard-nya keren." },
  { id: "p5", src: room(2).image, author: "Raka Pratama", mine: false, at: 9 * 60 + 18, roomId: room(2).id },
  { id: "p6", src: room(4).image, author: "Laras Ayuningtyas", mine: false, at: 9 * 60 + 12, roomId: room(4).id, caption: "Omakase corner!" },
];

/** Review cases: photos "picked" from the gallery without a real file dialog. */
export const SAMPLE_PICKS = (n: number): PickedPhoto[] =>
  Array.from({ length: n }, (_, i) => ({ key: `pick-${i}`, src: ROOMS[i % ROOMS.length].image, caption: "" }));

/**
 * The gallery as the admin screen works with it.
 *
 * `checked` stays a list of ids here because that is what the screen asks --
 * "which of these have we already looked at". The API stores it as a flag per
 * photo; the admin wiring folds one into the other.
 *
 * This used to live in data/galleryStore.ts alongside a localStorage copy of
 * the whole gallery. The photos are the server's now; only the shape is left.
 */
export type GalleryState = {
  photos: GalleryPhoto[];
  checked: string[];
};
