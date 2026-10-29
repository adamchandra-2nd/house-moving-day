import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./iconPaths";
import "./Toast.css";

type ToastProps = {
  /** Avatar, avatar stack or <ToastIcon/>. */
  lead: ReactNode;
  title: string;
  sub: string;
  /** One button (e.g. "Sapa"); shown on its own row under the text, full width. */
  action?: ReactNode;
  /** Two buttons on their own row (e.g. "Tetap di sini" + "Pindah sekarang"). */
  actions?: ReactNode;
  closing?: boolean;
};

/** Figma: Toast — solid card that scales in under the top card. Variants differ only in lead + actions. */
export function Toast({ lead, title, sub, action, actions, closing }: ToastProps) {
  return (
    <div className={`toast clay clay-light${closing ? " is-closing" : ""}`} role="status">
      <div className="toast__main">
        {lead}
        <div className="toast__text">
          <span className="t-p-h4-bold">{title}</span>
          <span className="t-p-h5 toast__sub">{sub}</span>
        </div>
      </div>
      {(action || actions) && <div className={`toast__actions${action && !actions ? " is-single" : ""}`}>{actions ?? action}</div>}
    </div>
  );
}

/** Round icon lead for toasts. accent = Orange Splash (events, moves), neutral = cream (info, locked, offline). */
export function ToastIcon({ icon, tone = "neutral" }: { icon: IconName; tone?: "accent" | "neutral" }) {
  return (
    <span className={`toast__icon${tone === "accent" ? " toast__icon--accent clay clay-accent" : " clay clay-light"}`}>
      <Icon name={icon} size={20} />
    </span>
  );
}
