import { createContext, useContext } from "react";
import type { GuestState } from "./state";

export type PageToast = { icon: "Lock" | "Share" | "Check" | "Megaphone"; title: string; sub: string };

export type GuestContextValue = {
  state: GuestState;
  set: (patch: Partial<GuestState>) => void;
  toast: PageToast | null;
  showToast: (t: PageToast) => void;
  /** A review case (?demo= or an old #token): sample data and a fixed clock. */
  demo: boolean;
  /** The invite token this session runs on; null when no invite link was opened. */
  session: string | null;
  /** Banks the token from an invite link, resetting progress if it is another guest's. */
  startSession: (token: string) => void;
};

export const GuestContext = createContext<GuestContextValue | null>(null);

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest must be used inside GuestProvider");
  return ctx;
}
