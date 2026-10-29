import { Icon } from "./Icon";
import type { IconName } from "./iconPaths";
import "./IconBadge.css";

export type IconTone = "orange" | "ink" | "blue" | "green" | "purple" | "amber" | "coral" | "slate" | "red" | "teal" | "pink" | "sky";

type Props = { icon: IconName; tone?: IconTone; size?: "S" | "M" | "L" };

/** Colourful clay icon circle — panel titles, stats, empty states, dialogs. */
export function IconBadge({ icon, tone = "orange", size = "M" }: Props) {
  const px = size === "S" ? 16 : size === "M" ? 20 : 28;
  return (
    <span className={`icon-badge icon-badge--${tone} icon-badge--${size} clay clay-accent`} aria-hidden="true">
      <Icon name={icon} size={px} />
    </span>
  );
}
