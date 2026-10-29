import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { EventCard } from "../components/EventCard";
import { ROOMS } from "../data/rooms";

/** D-day: one clear action to walk in. */
export function Start({ onStart }: { onStart: () => void }) {
  return (
    <main className="flow screen-enter">
      <div className="flow__bg" style={{ backgroundImage: `url(${ROOMS[0].image})` }} />
      <div className="flow__top">
        <EventCard status={<Badge type="now">Hari ini</Badge>}>
          <h2 className="t-p-h3-bold panel__title">Hari ini harinya!</h2>
          <p className="t-p-h5 panel__body">Sudah sampai di depan kantor? Scan QR di pintu untuk masuk.</p>
        </EventCard>
      </div>
      <div className="flow__stage">
        <Character say="Yuk, masuk!" />
      </div>
      <div className="flow__bottom">
        <Button block icon="ArrowRight" onClick={onStart}>
          Mulai masuk Potara
        </Button>
      </div>
    </main>
  );
}
