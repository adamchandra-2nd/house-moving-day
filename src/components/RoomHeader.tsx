import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import "./RoomHeader.css";

export type RewardState = "collecting" | "ready" | "claimed";

type RoomHeaderProps = {
  name: string;
  kenalanCount: number;
  kenalanTarget: number;
  reward: RewardState;
  onKenalan?: () => void;
};

/** Figma: Room Header — profile chip on its own. */
export function ProfileChip({ name, character }: { name: string; character?: boolean }) {
  return (
    <div className="room-header__chip room-header__profile glass">
      <Avatar initial={name.charAt(0)} size="M" character={character} />
      <span className="t-p-h4-bold">{name}</span>
    </div>
  );
}

/** Figma: Room Header (Type=Event) — profile chip + Kenalan progress chip (turns into a reward reminder at 5/5). */
export function RoomHeader({ name, kenalanCount, kenalanTarget, reward, onKenalan }: RoomHeaderProps) {
  const progress = Math.min(kenalanCount / kenalanTarget, 1);
  const label = reward === "ready" ? "Hadiah!" : reward === "claimed" ? "Lengkap" : "Kenalan";
  return (
    <header className="room-header">
      <ProfileChip name={name} character />
      <button
        type="button"
        className="room-header__chip room-header__kenalan clay clay-accent"
        aria-label={`Kenalan ${kenalanCount} dari ${kenalanTarget}. ${label}`}
        onClick={onKenalan}
      >
        <span className={`room-header__kenalan-icon clay clay-light${reward === "ready" ? " is-pulsing" : ""}`}>
          <Icon name={reward === "ready" ? "Gift" : reward === "claimed" ? "Check" : "UserPlus"} size={16} />
        </span>
        <span className="room-header__kenalan-body">
          <span className="room-header__kenalan-row">
            <span className="t-p-h5-bold room-header__kenalan-label">{label}</span>
            <span className="t-p-h5-bold">
              {kenalanCount}/{kenalanTarget}
            </span>
          </span>
          <span className="room-header__bar" aria-hidden="true">
            <span className="room-header__bar-fill" style={{ width: `${progress * 100}%` }} />
          </span>
        </span>
      </button>
    </header>
  );
}
