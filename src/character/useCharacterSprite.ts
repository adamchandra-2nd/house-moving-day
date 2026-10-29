import { useSyncExternalStore } from "react";
import { spriteSnapshot, subscribeSprite } from "./sprite";

/** The captured 3D character, or null while none has been made yet. */
export const useCharacterSprite = () => useSyncExternalStore(subscribeSprite, spriteSnapshot, spriteSnapshot);
