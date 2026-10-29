import { useEffect, useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { CAPTION_MAX, GALLERY_MAX, PHOTO_MAX_MB, type PickedPhoto } from "../data/gallery";
import { readPicked, usePhotoPicker, type PickResult } from "./PhotoPicker";
import "./Gallery.css";

const STEP_MS = 700;

type Props = {
  initial: PickResult;
  roomName: string;
  /** Upload fails (no connection). */
  offline: boolean;
  onBack: () => void;
  onShared: (picks: PickedPhoto[]) => void;
};

/** Notes about files that were left out when picking. */
function skippedNotes(r: Omit<PickResult, "picks">): string[] {
  const notes: string[] = [];
  if (r.overLimit) notes.push(`Maksimal ${GALLERY_MAX} foto sekali unggah, jadi ${r.overLimit} foto tidak ikut dipilih.`);
  if (r.notImage) notes.push(`${r.notImage} file dilewati karena bukan gambar.`);
  if (r.tooBig) notes.push(`${r.tooBig} foto dilewati karena lebih dari ${PHOTO_MAX_MB} MB.`);
  return notes;
}

/** Preview before sharing: up to GALLERY_MAX photos, an optional caption each, then one tap to share them all. */
export function UploadScreen({ initial, roomName, offline, onBack, onShared }: Props) {
  const [picks, setPicks] = useState(initial.picks);
  const [active, setActive] = useState(0);
  const [notes, setNotes] = useState(() => skippedNotes(initial));
  const [sending, setSending] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const picker = usePhotoPicker((files) => {
    const r = readPicked(files, GALLERY_MAX - picks.length);
    setPicks((p) => [...p, ...r.picks]);
    if (r.picks.length) setActive(picks.length);
    setNotes(skippedNotes(r));
  });

  const current = picks[Math.min(active, picks.length - 1)];
  const remove = (key: string) => {
    const i = picks.findIndex((p) => p.key === key);
    const next = picks.filter((p) => p.key !== key);
    setPicks(next);
    setActive(Math.max(0, Math.min(i, next.length - 1)));
  };
  const setCaption = (text: string) => setPicks((p) => p.map((x) => (x.key === current.key ? { ...x, caption: text.slice(0, CAPTION_MAX) } : x)));

  // Uploads one by one so the guest sees progress; with no connection it stops after the first try.
  const share = () => {
    setFailed(false);
    setSending(1);
    if (offline) {
      timers.current.push(window.setTimeout(() => (setSending(null), setFailed(true)), STEP_MS * 1.5));
      return;
    }
    picks.forEach((_, i) => timers.current.push(window.setTimeout(() => setSending(i + 1), STEP_MS * i)));
    timers.current.push(window.setTimeout(() => onShared(picks), STEP_MS * picks.length));
  };

  const busy = sending !== null;
  return (
    <div className="overlay-screen screen-enter">
      {picker.input}
      <div className="page__scroll upload">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} disabled={busy} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <span className="t-p-h3-bold">Unggah foto</span>
          <span className="t-p-h5 upload__count">
            {picks.length}/{GALLERY_MAX} foto
          </span>
        </div>

        {current ? (
          <div className="upload__preview">
            <img src={current.src} alt={`Foto ${active + 1} yang dipilih`} />
          </div>
        ) : (
          <section className="card upload__none">
            <h3 className="t-p-h3-bold panel__title">Belum ada foto dipilih</h3>
            <p className="t-p-h5 panel__body">Pilih foto dari galeri HP-mu, maksimal {GALLERY_MAX} sekali unggah.</p>
          </section>
        )}

        <div className="upload__strip" role="listbox" aria-label="Foto yang dipilih">
          {picks.map((p, i) => (
            <span key={p.key} className={`upload__thumb${p.key === current?.key ? " is-active" : ""}`}>
              <button type="button" role="option" aria-selected={p.key === current?.key} aria-label={`Foto ${i + 1}`} onClick={() => setActive(i)}>
                <img src={p.src} alt="" />
                {p.caption && <span className="upload__thumb-dot" aria-label="ada caption" />}
              </button>
              {!busy && (
                <button type="button" className="upload__thumb-remove clay clay-dark" aria-label={`Hapus foto ${i + 1} dari pilihan`} onClick={() => remove(p.key)}>
                  <Icon name="Close" size={14} />
                </button>
              )}
            </span>
          ))}
          {picks.length < GALLERY_MAX && !busy && (
            <button type="button" className="upload__add" onClick={picker.open} aria-label="Tambah foto dari galeri">
              <Icon name="Plus" />
              <span className="t-p-h5-bold">Tambah</span>
            </button>
          )}
        </div>

        {notes.length > 0 && (
          <div className="upload__notes" role="status">
            {notes.map((n) => (
              <span key={n} className="t-p-h5">
                {n}
              </span>
            ))}
          </div>
        )}

        {current && (
          <section className="card">
            <TextField
              key={current.key}
              label={`Caption foto ${active + 1} (opsional)`}
              value={current.caption}
              onChange={setCaption}
              placeholder="Ceritakan sedikit soal foto ini…"
              maxLength={CAPTION_MAX}
              hint={`${current.caption.length}/${CAPTION_MAX} karakter`}
            />
            <span className="upload__where">
              <span className="t-p-h5 upload__where-label">Ditandai di</span>
              <Badge type="room">{roomName}</Badge>
            </span>
          </section>
        )}

        <p className="t-p-h5 upload__privacy">
          <Icon name="Eye" size={16} />
          Foto bisa dilihat dan diunduh semua tamu yang hadir. Kamu bisa menghapusnya kapan saja.
        </p>
      </div>

      <div className="page__bottom question__bottom upload__bottom">
        {failed && (
          <span className="t-p-h5-bold upload__error" role="alert">
            Gagal mengunggah. Cek koneksimu, lalu coba lagi.
          </span>
        )}
        {picks.length === 0 ? (
          <Button block icon="Image" onClick={picker.open}>
            Pilih dari galeri
          </Button>
        ) : (
          <Button block icon={busy ? undefined : "Upload"} disabled={busy} onClick={share}>
            {busy ? `Mengunggah ${sending} dari ${picks.length}…` : failed ? "Coba lagi" : `Bagikan ${picks.length} foto`}
          </Button>
        )}
      </div>
    </div>
  );
}
