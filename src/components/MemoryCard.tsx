import dragonFront from "../assets/characters/dragon-front.webp";
import { useEvent } from "../data/eventContext";
import "./MemoryCard.css";

type Props = { name: string; kenalanCount: number; roomsVisited: number };

/** Figma: Memory Card — story-sized keepsake to share on Instagram. */
export function MemoryCard({ name, kenalanCount, roomsVisited }: Props) {
  const EVENT = useEvent();
  return (
    <figure className="memory-card clay clay-accent" aria-label={`Memory card ${name}`}>
      <div className="memory-card__head">
        <span className="t-p-h5-bold">{EVENT.host}</span>
        <span className="t-p-h5-bold">08.11.2026</span>
      </div>
      <span className="memory-card__title">{EVENT.name}</span>
      <div className="memory-card__stage">
        <img src={dragonFront} alt="" />
      </div>
      <figcaption className="memory-card__foot">
        <span className="memory-card__name">{name}</span>
        <span className="memory-card__stats t-p-h5-bold">
          <span>{kenalanCount} kenalan baru</span>
          <span>·</span>
          <span>{roomsVisited} ruangan dijelajahi</span>
        </span>
      </figcaption>
    </figure>
  );
}
