import { createContext, useContext } from "react";
import type { Outfit } from "../data/outfits";

export type StageStatus = "idle" | "loading" | "ready" | "failed" | "skipped";

export type CharacterStageValue = {
  status: StageStatus;
  /** 0–100 while the scene downloads. */
  progress: number;
  /**
   * Lends the one shared canvas to a slot, and returns the release function.
   * The most recently mounted slot wins, so the screen the guest is looking at
   * gets the 3D character while any other falls back to the sprite.
   */
  claim: (slot: HTMLElement) => () => void;
  /** The slot currently holding the canvas. */
  activeSlot: HTMLElement | null;
  /** Dress the character without committing it to guest state (/karakter). */
  previewOutfit: (outfit: Outfit | null) => void;
  /** The character as a cropped webp data URL, or null if it can't be read. */
  capture: () => string | null;
  /** Load now even though the connection heuristic chose to skip. */
  loadAnyway: () => void;
};

const NOOP: CharacterStageValue = {
  status: "idle",
  progress: 0,
  claim: () => () => {},
  activeSlot: null,
  previewOutfit: () => {},
  capture: () => null,
  loadAnyway: () => {},
};

/**
 * Defaults to a no-op so <Character> still works outside the guest tree — the
 * admin screens use it too, and they must never pull Spline in.
 */
export const CharacterStageContext = createContext<CharacterStageValue>(NOOP);

export const useCharacterStage = () => useContext(CharacterStageContext);
