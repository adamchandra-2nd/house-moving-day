import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Icon } from "../components/Icon";
import { OfflineBanner } from "../components/SystemState";
import { formatTime } from "../data/agenda";
import { firstName, type GalleryPhoto } from "../data/gallery";
import "./Gallery.css";

export type GalleryFilter = "semua" | "fotoku";

type Props = {
  photos: GalleryPhoto[];
  filter: GalleryFilter;
  loading: boolean;
  offline: boolean;
  onBack: () => void;
  onFilter: (f: GalleryFilter) => void;
  onUpload: () => void;
  onOpen: (photo: GalleryPhoto) => void;
};

/** Galeri: every photo shared by guests who are here, newest first. Anyone can download; you can delete your own. */
export function GalleryScreen({ photos, filter, loading, offline, onBack, onFilter, onUpload, onOpen }: Props) {
  const sorted = [...photos].sort((a, b) => b.at - a.at);
  const mine = sorted.filter((p) => p.mine);
  const shown = filter === "fotoku" ? mine : sorted;
  const authors = new Set(photos.map((p) => p.author)).size;

  return (
    <div className="overlay-screen screen-enter">
    <div className="page__scroll gallery">
      <header className="page__header">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <h1 className="t-display-h6 page__title">Galeri</h1>
          <span className="gallery__upload">
            <Button size="small" icon="Upload" onClick={onUpload}>
              Unggah foto
            </Button>
          </span>
        </div>
        <p className="t-p-h5 page__sub">
          {photos.length > 0 ? `${photos.length} foto dari ${authors} tamu. ` : ""}Semua tamu yang hadir bisa melihat dan mengunduhnya.
        </p>
      </header>

      {offline && <OfflineBanner />}

      <div className="gallery__filters" role="tablist" aria-label="Filter foto">
        {(["semua", "fotoku"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`gallery__filter t-p-h5-bold${filter === f ? " is-active clay clay-dark" : ""}`}
            onClick={() => onFilter(f)}
          >
            {f === "semua" ? `Semua · ${photos.length}` : `Fotoku · ${mine.length}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="gallery__grid" aria-busy="true" aria-label="Memuat foto">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="gallery__tile gallery__tile--skeleton" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <section className="card gallery__empty">
          {filter === "semua" ? (
            <>
              <div className="gallery__empty-art">
                <Character say="Belum ada foto…" />
              </div>
              <h3 className="t-p-h3-bold panel__title">Jadi yang pertama berbagi!</h3>
              <p className="t-p-h5 panel__body">Pilih foto dari galeri HP-mu, maksimal 5 sekali unggah.</p>
            </>
          ) : (
            <>
              <h3 className="t-p-h3-bold panel__title">Kamu belum berbagi foto</h3>
              <p className="t-p-h5 panel__body">Foto yang kamu unggah muncul di sini. Kamu bisa menghapusnya kapan saja.</p>
            </>
          )}
          <Button block icon="Upload" onClick={onUpload}>
            Unggah foto
          </Button>
        </section>
      ) : (
        <div className="gallery__grid">
          {shown.map((p) => {
            const who = p.mine ? "Kamu" : firstName(p.author);
            const inner = (
              <>
                <img src={p.src} alt="" loading="lazy" />
                {p.censored && (
                  <span className="gallery__censored t-p-h5-bold">
                    <Icon name="Lock" size={16} />
                    Disensor panitia
                  </span>
                )}
                <span className="gallery__tile-meta">
                  <span className="t-p-h5-bold one-line">{who}</span>
                  <span className="t-p-h5">{formatTime(p.at)}</span>
                </span>
              </>
            );
            // Other guests' censored photos stay blurred and can't be opened.
            return p.censored && !p.mine ? (
              <div key={p.id} className="gallery__tile is-censored" role="img" aria-label={`Foto dari ${who}, disensor panitia`}>
                {inner}
              </div>
            ) : (
              <button
                key={p.id}
                type="button"
                className={`gallery__tile${p.censored ? " is-censored" : ""}`}
                onClick={() => onOpen(p)}
                aria-label={`Foto dari ${p.mine ? "kamu" : who}${p.censored ? ", disensor panitia" : ""}`}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
