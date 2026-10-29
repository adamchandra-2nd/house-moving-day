import { Icon } from "./Icon";
import type { IconName } from "./iconPaths";
import "./Badge.css";

type BadgeProps = {
  type:
    | "live" | "now" | "on-air" | "room" | "sent" | "read" | "answered" | "next" | "done" | "hadir" | "pic" | "complete" | "plus-one"
    /* Soft tags: tinted, flat-looking labels that never read as buttons */
    | "ready" | "claimed" | "neutral" | "warn" | "danger";
  children: React.ReactNode;
  /** Leading icon (soft tags). */
  icon?: IconName;
  /** Trailing arrow: the tag is tappable and takes you somewhere. */
  arrow?: boolean;
};

const withDot = new Set(["live", "now", "on-air", "hadir", "complete"]);
const clayOf: Record<BadgeProps["type"], string> = {
  live: "clay clay-accent",
  now: "clay clay-dark",
  "on-air": "clay clay-accent",
  room: "clay clay-light",
  hadir: "clay clay-accent",
  pic: "clay clay-accent",
  "plus-one": "clay clay-accent",
  complete: "clay clay-dark",
  next: "",
  done: "",
  sent: "clay clay-light",
  read: "clay clay-light",
  answered: "clay clay-light",
  ready: "",
  claimed: "",
  neutral: "",
  warn: "",
  danger: "",
};

const softIcon: Partial<Record<BadgeProps["type"], IconName>> = { ready: "Gift", claimed: "Check" };

/** Message-status tags lead with a chat-style tick. */
const statusIcon = { sent: "Check", read: "CheckDouble", answered: "ChatCheck" } as const;

/** Figma: Badge — pill, 28px tall. */
export function Badge({ type, children, arrow, icon }: BadgeProps) {
  const lead = icon ?? softIcon[type];
  return (
    <span className={`badge badge--${type} ${clayOf[type]} t-p-h5-bold`}>
      {withDot.has(type) && <span className="badge__dot" />}
      {type === "room" && <Icon name="MapPin" size={16} />}
      {(type === "sent" || type === "read" || type === "answered") && <Icon name={statusIcon[type]} size={16} />}
      {lead && <Icon name={lead} size={16} />}
      <span>{children}</span>
      {arrow && <Icon name="ChevronRight" size={16} />}
    </span>
  );
}
