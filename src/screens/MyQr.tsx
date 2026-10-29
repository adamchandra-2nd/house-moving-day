import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { QrCode } from "../components/QrCode";
import { MY_KENALAN_CODE } from "../config";
import "./MyQr.css";

/** The guest's own kenalan QR: another guest scans it (or types the code) to save the card for both. */
export function MyQr({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <Dialog
      title="QR kenalanku"
      onClose={onClose}
      lead={
        <div className="my-qr">
          <QrCode value={`kenalan:${name}:${MY_KENALAN_CODE}`} label={`QR kenalan ${name}`} />
          <span className="my-qr__code" aria-label={`Kode ${MY_KENALAN_CODE.split("").join(" ")}`}>
            {MY_KENALAN_CODE.split("").map((d, i) => (
              <span key={i} className="my-qr__digit clay clay-light">
                {d}
              </span>
            ))}
          </span>
        </div>
      }
      actions={
        <Button block style="tertiary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      Tunjukkan ke tamu yang baru kamu ajak ngobrol. Begitu mereka scan, kalian berdua dapat kartu.
    </Dialog>
  );
}
