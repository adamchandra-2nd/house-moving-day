import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { QrCode } from "../components/QrCode";
import "./MyQr.css";

/** The guest's own kenalan QR: another guest scans it (or types the code) to save the card for both. */
/** `code` is this guest's own, from /api/invite; empty until the server has answered. */
export function MyQr({ name, code, onClose }: { name: string; code: string; onClose: () => void }) {
  return (
    <Dialog
      title="QR kenalanku"
      onClose={onClose}
      lead={
        <div className="my-qr">
          <QrCode value={`kenalan:${name}:${code}`} label={`QR kenalan ${name}`} />
          <span className="my-qr__code" aria-label={code ? `Kode ${code.split("").join(" ")}` : "Kode belum tersedia"}>
            {(code || "····").split("").map((d, i) => (
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
