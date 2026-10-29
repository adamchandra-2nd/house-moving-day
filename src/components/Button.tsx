import { Icon } from "./Icon";
import type { IconName } from "./iconPaths";
import "./Button.css";

export type ButtonStyle = "primary" | "secondary" | "tertiary" | "danger";

type ButtonProps = {
  children: React.ReactNode;
  /** primary = Orange Splash (main action), secondary = Ink, tertiary = white (back/cancel), danger = red. No text-only buttons. */
  style?: ButtonStyle;
  size?: "large" | "small";
  icon?: IconName;
  disabled?: boolean;
  /** Stretch to the container width (stacked actions in a card). */
  block?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
};

const clayOf: Record<ButtonStyle, string> = {
  primary: "clay clay-accent",
  secondary: "clay clay-dark",
  tertiary: "clay clay-light",
  danger: "clay clay-accent",
};

/** Figma: Button — Style × Size × State. */
export function Button({ children, style = "primary", size = "large", icon, disabled, block, type = "button", onClick }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${style} btn--${size}${block ? " btn--block" : ""} ${disabled ? "" : clayOf[style]} ${size === "large" ? "t-p-h3-bold" : "t-p-h4-bold"}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{children}</span>
      {icon && <Icon name={icon} size={size === "large" ? 24 : 20} />}
    </button>
  );
}
