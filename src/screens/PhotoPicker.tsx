import { useRef } from "react";
import { GALLERY_MAX, PHOTO_MAX_MB, type PickedPhoto } from "../data/gallery";

export type PickResult = {
  picks: PickedPhoto[];
  /** Files that aren't images. */
  notImage: number;
  /** Images over PHOTO_MAX_MB. */
  tooBig: number;
  /** Valid photos left out because of the GALLERY_MAX limit. */
  overLimit: number;
};

/** Turn the chosen files into picks, keeping at most `room` of them (GALLERY_MAX minus what's already picked). */
export function readPicked(files: FileList | File[], room = GALLERY_MAX): PickResult {
  const result: PickResult = { picks: [], notImage: 0, tooBig: 0, overLimit: 0 };
  for (const f of Array.from(files)) {
    if (!f.type.startsWith("image/")) result.notImage++;
    else if (f.size > PHOTO_MAX_MB * 1024 * 1024) result.tooBig++;
    else if (result.picks.length >= room) result.overLimit++;
    // The File is kept alongside the preview URL: the upload resizes the
    // original, and an object URL cannot be read back into one.
    else result.picks.push({ key: `${f.name}-${f.lastModified}-${Math.random()}`, src: URL.createObjectURL(f), caption: "", file: f });
  }
  return result;
}

/**
 * Hidden file input that only opens the phone's photo library. No `capture`, so the app never asks for
 * the camera itself (some phones may still list their camera in the system picker).
 */
export function usePhotoPicker(onPicked: (files: FileList) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        if (e.target.files?.length) onPicked(e.target.files);
        e.target.value = "";
      }}
    />
  );
  return { open: () => ref.current?.click(), input };
}
