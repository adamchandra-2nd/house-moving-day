import { useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Countdown } from "../components/Countdown";
import { Dialog } from "../components/Dialog";
import { useEvent } from "../data/eventContext";
import { ROOMS } from "../data/rooms";

type Props = { onCancel: () => void; onDday: () => void };

/** Before D-day: count down, confirm attendance, keep a way to cancel. */
export function CountdownScreen({ onCancel, onDday }: Props) {
  const EVENT = useEvent();
  const [confirm, setConfirm] = useState(false);
  return (
    <main className="flow screen-enter">
      <div className="flow__bg" style={{ backgroundImage: `url(${ROOMS[0].image})` }} />
      <div className="flow__top">
        <section className="panel glass">
          <span className="event-card__tags">
            <Badge type="hadir">Kamu hadir</Badge>
          </span>
          <h1 className="t-display-h6 panel__title">Menuju {EVENT.name}</h1>
          <Countdown to={EVENT.startsAt} onDone={onDday} />
          <p className="t-p-h5 panel__body">
            {EVENT.dateLabel} · {EVENT.place}
          </p>
        </section>
      </div>
      <div className="flow__stage">
        <Character say="Sampai ketemu di rumah baru!" />
      </div>
      <div className="flow__bottom">
        <Button block style="danger" onClick={() => setConfirm(true)}>
          Batal hadir
        </Button>
      </div>
      {confirm && (
        <Dialog
          title="Batal hadir?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button block style="danger" onClick={onCancel}>
                Ya, batal hadir
              </Button>
              <Button block style="tertiary" onClick={() => setConfirm(false)}>
                Tetap hadir
              </Button>
            </>
          }
        >
          Tidak apa-apa. Kalau berubah pikiran, kamu masih bisa konfirmasi hadir lagi.
        </Dialog>
      )}
    </main>
  );
}
