import { iconPaths, type IconName } from "./iconPaths";

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

/** Remix Icon (line). Color follows `currentColor`, like the Figma "Icon" variable modes. */
export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {iconPaths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
