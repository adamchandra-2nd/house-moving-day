import { useCallback, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { Scanner, type ScanState } from "../components/Scanner";
import { TextField } from "../components/TextField";
import type { Guest } from "../data/guests";
import "./QuestionCard.css";

type Props = {
  guest: Guest;
  /** Note saved with the card; undefined = not collected yet. */
  savedNote?: string;
  onBack: () => void;
  onCollected: (note: string) => void;
};

/**
 * Figma: Question Card — ask the guest in person, then prove you met by scanning their QR
 * (or typing the 4-digit code under it). The note is optional; the scan is what counts.
 */
export function QuestionCard({ guest, savedNote, onBack, onCollected }: Props) {
  const [note, setNote] = useState(savedNote ?? "");
  const [mode, setMode] = useState<"card" | "scan">("card");
  const [scan, setScan] = useState<ScanState>("scanning");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const saved = savedNote !== undefined;

  const onRead = useCallback(() => {
    setScan("found");
    window.setTimeout(() => onCollected(note.trim()), 700);
  }, [note, onCollected]);

  const submitCode = () => {
    if (code === guest.code) return onCollected(note.trim());
    setCodeError(true);
  };

  if (mode === "scan") {
    return (
      <div className="question question--scan screen-enter">
        <div className="page__scroll question__scroll">
          <div className="topbar">
            <button type="button" className="icon-btn clay clay-light" onClick={() => setMode("card")} aria-label="Kembali">
              <Icon name="ArrowLeft" />
            </button>
            <span className="t-p-h3-bold">Scan QR {guest.name}</span>
          </div>
          <div className="question__scanner">
            <Scanner state={scan} onRead={codeOpen ? undefined : onRead} />
          </div>
          <section className="card question__scan-copy">
            <h2 className="t-p-h3-bold panel__title">{scan === "found" ? "Kartu tersimpan!" : `Minta ${guest.name} buka QR-nya`}</h2>
            <p className="t-p-h5 panel__body">
              {scan === "found"
                ? `${guest.name} juga dapat kartumu.`
                : `QR ada di tab Kenalan > QR-ku di HP ${guest.name}. Arahkan kamera ke sana.`}
            </p>
          </section>
        </div>
        {scan !== "found" && (
          <div className="page__bottom question__bottom">
            <Button block style="tertiary" icon="KeyCard" onClick={() => setCodeOpen(true)}>
              Pakai kode {guest.name}
            </Button>
          </div>
        )}
        {codeOpen && (
          <Dialog
            title={`Kode kenalan ${guest.name}`}
            onClose={() => setCodeOpen(false)}
            actions={
              <>
                <Button block disabled={code.length < 4} onClick={submitCode}>
                  Simpan kartu
                </Button>
                <Button block style="tertiary" onClick={() => setCodeOpen(false)}>
                  Kembali
                </Button>
              </>
            }
          >
            <TextField
              label="Kode 4 angka"
              value={code}
              onChange={(v) => {
                setCodeError(false);
                setCode(v.replace(/\D/g, "").slice(0, 4));
              }}
              placeholder="0000"
              inputMode="numeric"
              maxLength={4}
              error={codeError ? `Kodenya tidak cocok. Minta ${guest.name} cek lagi di bawah QR-nya.` : undefined}
              hint={`Kodenya ada di bawah QR ${guest.name}.`}
              autoFocus
            />
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="question screen-enter">
      <div className="page__scroll question__scroll">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <span className="t-p-h3-bold">Kartu kenalan</span>
        </div>

        <section className="card">
          {/* Tag row first, then the content row */}
          {saved && (
            <span className="agenda-card__tags">
              <Badge type="hadir">Kartu didapat</Badge>
            </span>
          )}
          <div className="question__guest">
            <Avatar initial={guest.name.charAt(0)} size="L" />
            <div className="question__who">
              <span className="t-display-h6">{guest.name}</span>
              <span className="t-p-h5 guest-card__role">{guest.role}</span>
            </div>
          </div>
        </section>

        {/* The question is the hero of this screen */}
        <section className="question__card clay clay-dark">
          <span className="t-p-h5-bold question__eyebrow">Tanyakan langsung ke {guest.name}</span>
          <p className="t-display-h6 question__text">“{guest.question}”</p>
        </section>

        {saved ? (
          <section className="card">
            <span className="t-p-h5-bold field__label">Catatanmu</span>
            <p className="t-p-h4 question__answer">{savedNote || "Tidak ada catatan."}</p>
          </section>
        ) : (
          <>
            <ol className="question__steps t-p-h5">
              <li>Ngobrol dan tanyakan pertanyaan di atas. Tidak ada jawaban yang salah.</li>
              <li>Scan QR di HP {guest.name} untuk menyimpan kartu. Kalian berdua sama-sama dapat kartu.</li>
            </ol>
            <TextField
              label="Catatan jawaban (opsional)"
              value={note}
              onChange={setNote}
              placeholder={`Biar ingat jawaban ${guest.name}`}
              multiline
              maxLength={160}
            />
          </>
        )}
      </div>
      <div className="page__bottom question__bottom">
        {saved ? (
          <Button block style="tertiary" onClick={onBack}>
            Kembali
          </Button>
        ) : (
          <Button block icon="Scan" onClick={() => setMode("scan")}>
            Scan QR {guest.name}
          </Button>
        )}
      </div>
    </div>
  );
}
