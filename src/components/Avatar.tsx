import dragonFront from "../assets/characters/dragon-front.webp";
import "./Avatar.css";

type AvatarProps = {
  initial: string;
  size?: "S" | "M" | "L" | "XL";
  /** Show the guest's own character (head crop) instead of the initial. */
  character?: boolean;
};

/** Figma: Avatar. Character head for the signed-in guest; initials for others until face crops exist. */
export function Avatar({ initial, size = "M", character }: AvatarProps) {
  if (character) {
    return (
      <span className={`avatar avatar--${size} avatar--character clay clay-light`} aria-hidden="true">
        <span className="avatar__face" style={{ backgroundImage: `url(${dragonFront})` }} />
      </span>
    );
  }
  return (
    <span className={`avatar avatar--${size} clay clay-accent`} aria-hidden="true">
      <span>{initial}</span>
    </span>
  );
}
