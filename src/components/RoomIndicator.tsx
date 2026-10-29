import { Badge } from "./Badge";
import { Dots } from "./Dots";
import "./RoomIndicator.css";

type RoomIndicatorProps = {
  name: string;
  index: number;
  total: number;
  live?: boolean;
};

/** Figma: Room Indicator — one slim row: room tag, LIVE tag, position dots. Sits just above the Bottom Nav. */
export function RoomIndicator({ name, index, total, live }: RoomIndicatorProps) {
  return (
    <div className="room-indicator glass" aria-live="polite">
      <span className="room-indicator__tags">
        <Badge type="room">{name}</Badge>
        {live && <Badge type="on-air">LIVE</Badge>}
      </span>
      <Dots index={index} total={total} label={`Ruangan ${index + 1} dari ${total}`} />
    </div>
  );
}
