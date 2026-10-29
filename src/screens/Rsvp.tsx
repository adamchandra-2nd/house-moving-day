import { useState } from "react";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Dialog } from "../components/Dialog";
import { EventCard } from "../components/EventCard";
import { ROOMS } from "../data/rooms";

type RsvpProps = { onYes: () => void; onNo: () => void };

/** RSVP: answer before anything else. "Tidak" asks once more so a mis-tap doesn't lock the guest out. */
export function Rsvp({ onYes, onNo }: RsvpProps) {
  const [confirmNo, setConfirmNo] = useState(false);
  return (
    <main className="flow screen-enter">
      <div className="flow__bg" style={{ backgroundImage: `url(${ROOMS[0].image})` }} />
      <div className="flow__top">
        <EventCard>
          <h2 className="t-p-h3-bold panel__title">Kamu bisa hadir?</h2>
          <p className="t-p-h5 panel__body">Potara pindah rumah! Datang dan rayakan bareng kami di kantor baru.</p>
        </EventCard>
      </div>
      <div className="flow__stage">
        <Character say="Kamu datang, kan?" />
      </div>
      <div className="flow__bottom">
        <Button block onClick={onYes}>
          Ya, aku hadir
        </Button>
        <Button block style="secondary" onClick={() => setConfirmNo(true)}>
          Tidak bisa hadir
        </Button>
      </div>
      {confirmNo && (
        <Dialog
          title="Yakin tidak bisa hadir?"
          onClose={() => setConfirmNo(false)}
          actions={
            <>
              <Button block style="danger" onClick={onNo}>
                Ya, tidak bisa
              </Button>
              <Button block style="tertiary" onClick={() => setConfirmNo(false)}>
                Kembali
              </Button>
            </>
          }
        >
          Kamu masih bisa mengubahnya nanti kalau rencanamu berubah.
        </Dialog>
      )}
    </main>
  );
}
