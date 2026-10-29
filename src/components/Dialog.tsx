import { useEffect, type ReactNode } from "react";
import { IconBadge, type IconTone } from "./IconBadge";
import type { IconName } from "./iconPaths";
import "./Dialog.css";

type DialogProps = {
  title: string;
  /** Short explanation under the title. */
  description?: ReactNode;
  /** Body: plain text for confirms, or form fields when `form` is set. */
  children?: ReactNode;
  /** Buttons. Mobile: stacked, main action first. Desktop (admin): side by side, main action on the right. */
  actions: ReactNode;
  /** Destructive action kept apart from the others (desktop: far left). */
  danger?: ReactNode;
  /** Optional visual above the title (avatar, QR…). */
  lead?: ReactNode;
  icon?: IconName;
  iconTone?: IconTone;
  /** Form dialogs separate header, fields and buttons with lines; the fields scroll. */
  form?: boolean;
  wide?: boolean;
  /** Extra-wide (review tables). */
  xl?: boolean;
  onClose: () => void;
};

/** Figma: Dialog — centered card over a dimmed scrim. Tap outside or Esc to close. */
export function Dialog({ title, description, children, actions, danger, lead, icon, iconTone, form, wide, xl, onClose }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div
        className={`dialog clay clay-light${form ? " dialog--form" : ""}${wide ? " dialog--wide" : ""}${xl ? " dialog--xl" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__head">
          {icon && <IconBadge icon={icon} tone={iconTone} size="L" />}
          {lead && <div className="dialog__lead">{lead}</div>}
          <div className="dialog__text">
            <h2 className="t-display-h6 dialog__title">{title}</h2>
            {description && <div className="t-p-h4 dialog__body">{description}</div>}
            {!form && children && <div className="t-p-h4 dialog__body">{children}</div>}
          </div>
        </div>
        {form && children && <div className="dialog__content">{children}</div>}
        <div className="dialog__actions">
          {actions}
          {danger && <div className="dialog__danger">{danger}</div>}
        </div>
      </div>
    </div>
  );
}
