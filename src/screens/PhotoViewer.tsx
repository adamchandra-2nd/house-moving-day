import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { formatTime } from "../data/agenda";
import { firstName, type GalleryPhoto } from "../data/gallery";
import { ROOMS, roomIndexById } from "../data/rooms";
import "./Gallery.css";

const SWIPE = 50;

type Props = {
  photos: GalleryPhoto[];
  startId: string;
  /** Review case: open straight on the delete confirmation. */
  confirmDelete?: boolean;
  onClose: () => void;
  onDownload: (photo: GalleryPhoto) => void;
  onDelete: (photo: GalleryPhoto) => void;
};

/** Full-screen photo: swipe or tap the arrows for the next one; download any, delete your own. */
export function PhotoViewer({ photos, startId, confirmDelete, onClose, onDownload, onDelete }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)));
  const [deleting, setDeleting] = useState(!!confirmDelete);
  const touch = useRef<number | null>(null);
  const photo = photos[Math.min(index, photos.length - 1)];
  const go = (d: number) => setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Escape" && !deleting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!photo) return null;
  const room = ROOMS[roomIndexById(photo.roomId)].name;

  return (
    <div className="overlay-screen viewer screen-enter" role="dialog" aria-modal="true" aria-label="Foto">
      <div className="viewer__top">
        <button type="button" className="icon-btn clay clay-light" onClick={onClose} aria-label="Tutup">
          <Icon name="Close" />
        </button>
        <span className="t-p-h4-bold viewer__count">
          {index + 1} / {photos.length}
        </span>
      </div>

      <div
        className="viewer__stage"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <img key={photo.id} className={photo.censored ? "is-censored" : undefined} src={photo.src} alt={photo.caption ?? `Foto dari ${firstName(photo.author)}`} />
        {index > 0 && (
          <button type="button" className="viewer__nav viewer__nav--prev clay clay-light" onClick={() => go(-1)} aria-label="Foto sebelumnya">
            <Icon name="ChevronLeft" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" className="viewer__nav viewer__nav--next clay clay-light" onClick={() => go(1)} aria-label="Foto berikutnya">
            <Icon name="ChevronRight" />
          </button>
        )}
      </div>

      <section className="viewer__info clay clay-light">
        <div className="viewer__who">
          <Avatar initial={photo.author.charAt(0)} size="S" character={photo.mine} />
          <span className="viewer__who-text">
            <span className="t-p-h4-bold">{photo.mine ? "Kamu" : firstName(photo.author)}</span>
            <span className="t-p-h5 viewer__meta">
              {formatTime(photo.at)} · {room}
            </span>
          </span>
        </div>
        {photo.caption && <p className="t-p-h4 viewer__caption">{photo.caption}</p>}
        {photo.censored && (
          <p className="t-p-h5 viewer__censored" role="status">
            <Icon name="Lock" size={16} />
            Fotomu disensor panitia. Tamu lain melihatnya buram dan tidak bisa membuka atau mengunduhnya.
          </p>
        )}
        <div className={`viewer__actions${photo.mine && !photo.censored ? "" : " is-single"}`}>
          {!photo.censored && (
            <Button block style="secondary" icon="Download" onClick={() => onDownload(photo)}>
              Unduh
            </Button>
          )}
          {photo.mine && (
            <Button block style="danger" icon="Trash" onClick={() => setDeleting(true)}>
              Hapus
            </Button>
          )}
        </div>
      </section>

      {deleting && (
        <Dialog
          title="Hapus foto ini?"
          icon="Trash"
          onClose={() => setDeleting(false)}
          actions={
            <>
              <Button
                block
                style="danger"
                onClick={() => {
                  setDeleting(false);
                  onDelete(photo);
                }}
              >
                Ya, hapus
              </Button>
              <Button block style="tertiary" onClick={() => setDeleting(false)}>
                Batal
              </Button>
            </>
          }
        >
          Tamu lain tidak bisa melihat atau mengunduhnya lagi.
        </Dialog>
      )}
    </div>
  );
}
