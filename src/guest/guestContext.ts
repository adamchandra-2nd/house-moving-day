import { createContext, useContext } from "react";
import type { GuestState } from "./state";

export type PageToast = { icon: "Lock" | "Share" | "Check"; title: string; sub: string };

export type GuestContextValue = {
  state: GuestState;
  set: (patch: Partial<GuestState>) => void;
  toast: PageToast | null;
  showToast: (t: PageToast) => void;
};

export const GuestContext = createContext<GuestContextValue | null>(null);

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest must be used inside GuestProvider");
  return ctx;
}
