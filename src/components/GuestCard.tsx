import dragonFront from "../assets/characters/dragon-front.webp";
import type { Guest } from "../data/guests";
import { Button } from "./Button";
import { Icon } from "./Icon";
import "./GuestCard.css";

type Props = { guest: Guest; collected: boolean; onOpen: () => void };

/** Figma: Guest Card — character portrait, name + role, Kenalan button. */
export function GuestCard({ guest, collected, onOpen }: Props) {
  return (
    <article className="guest-card card">
      <button type="button" className="guest-card__art" onClick={onOpen} aria-label={`Buka kartu ${guest.name}`}>
        <img src={dragonFront} alt="" draggable={false} />
        {/* Outfit tag stands in for the outfit art until it's drawn */}
        <span className="guest-card__outfit t-p-h5-bold">{guest.outfit}</span>
        <span className={`guest-card__status${collected ? " is-done clay clay-accent" : " clay clay-light"}`} aria-hidden="true">
          <Icon name={collected ? "Check" : "UserPlus"} size={16} />
        </span>
      </button>
      <div className="guest-card__info">
        <span className="t-p-h3-bold guest-card__name">{guest.name}</span>
        <span className="t-p-h5 guest-card__role">{guest.role}</span>
      </div>
      <Button block size="small" style={collected ? "tertiary" : "secondary"} onClick={onOpen}>
        {collected ? "Lihat kartu" : "Kenalan"}
      </Button>
    </article>
  );
}
