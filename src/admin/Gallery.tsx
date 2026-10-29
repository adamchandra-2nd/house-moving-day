import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { formatTime } from "../data/agenda";
import { CENSOR_REASONS, CENSOR_REASON_MAX, type GalleryPhoto, type GalleryState } from "../data/gallery";
import { ROOMS, roomIndexById } from "../data/rooms";
import { Empty, Panel, Stat } from "./ui";

export type GalleryTab = "semua" | "belum" | "disensor";
export type GalleryDialog = "sensor" | "buka" | null;

type Props = {
  gallery: GalleryState;
  initialTab?: GalleryTab;
  selectedId: string | null;
  initialDialog?: GalleryDialog;
  onSelect: (id: string | null) => void;
  /** `reason` is optional and stays internal (guests never see it). */
  onCensor: (photo: GalleryPhoto, censored: boolean, reason?: string) => void;
  onCheckAll: (ids: string[]) => void;
  onDownload: (photo: GalleryPhoto) => void;
};

const roomName = (id: string) => ROOMS[roomIndexById(id)].name;

/** Galeri: every photo guests shared. The committee checks new ones and censors (blurs) anything inappropriate; it can be undone. */
export function AdminGallery({ gallery, initialTab, selectedId, initialDialog, onSelect, onCensor, onCheckAll, onDownload }: Props) {
  const [tab, setTab] = useState<GalleryTab>(initialTab ?? "semua");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<GalleryDialog>(initialDialog ?? null);
  const [reason, setReason] = useState("");
  const openDialog = (d: GalleryDialog) => {
    setReason("");
    setDialog(d);
  };

  const photos = [...gallery.photos].sort((a, b) => b.at - a.at);
  const isNew = (p: GalleryPhoto) => !gallery.checked.includes(p.id);
  const inTab = (t: GalleryTab, p: GalleryPhoto) => t === "semua" || (t === "belum" ? isNew(p) : !!p.censored);
  const q = query.trim().toLowerCase();
  const rows = photos.filter((p) => inTab(tab, p) && (!q || p.author.toLowerCase().includes(q)));
  const count = (t: GalleryTab) => photos.filter((p) => inTab(t, p)).length;
  const selected = photos.find((p) => p.id === selectedId);
  const authors = new Set(photos.map((p) => p.author)).size;
  const unchecked = photos.filter(isNew);

  const TABS: { id: GalleryTab; label: string }[] = [
    { id: "semua", label: "Semua" },
    { id: "belum", label: "Belum dicek" },
    { id: "disensor", label: "Disensor" },
  ];

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Galeri</h1>
          <p className="t-p-h4 admin-sub">Foto yang dibagikan tamu. Sensor foto yang tidak pantas: tamu akan melihatnya buram dan tidak bisa mengunduhnya.</p>
        </div>
      </div>

      <section className="stat-strip">
        <Stat icon="Image" tone="pink" label="Foto dibagikan" value={photos.length} note={`dari ${authors} tamu`} />
        <Stat icon="Eye" tone="amber" label="Belum dicek" value={unchecked.length} note="foto baru sejak terakhir dicek" />
        <Stat icon="Lock" tone="slate" label="Disensor" value={count("disensor")} note="buram di HP tamu" />
      </section>

      <div className="admin-gallery__bar">
        <div className="pill-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`pill-tab t-p-h5-bold${tab === t.id ? " is-active clay clay-dark" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
              <span className="pill-tab__count">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <label className="admin-search admin-gallery__search">
          <Icon name="Search" size={20} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama pengunggah…" aria-label="Cari nama pengunggah" className="t-p-h4" />
        </label>
      </div>

      <div className="admin-fill guests-fill">
        <Panel
          icon="Image"
          tone="pink"
          title={`Foto · ${rows.length}`}
          aside={
            tab === "belum" && unchecked.length > 0 ? (
              <Button size="small" style="tertiary" icon="Check" onClick={() => onCheckAll(unchecked.map((p) => p.id))}>
                Tandai semua sudah dicek
              </Button>
            ) : undefined
          }
        >
          {rows.length === 0 ? (
            <Empty
              icon={q ? "Search" : tab === "disensor" ? "Lock" : "Image"}
              tone={q ? "slate" : "pink"}
              title={q ? "Tidak ada foto yang cocok" : tab === "belum" ? "Semua foto sudah dicek" : tab === "disensor" ? "Belum ada foto yang disensor" : "Belum ada foto"}
              body={q ? `Tidak ada pengunggah bernama "${query}".` : tab === "semua" ? "Foto yang dibagikan tamu muncul di sini." : undefined}
            />
          ) : (
            <div className="admin-gallery__grid">
              {rows.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`admin-gallery__card${p.id === selectedId ? " is-selected" : ""}`}
                  aria-pressed={p.id === selectedId}
                  onClick={() => onSelect(p.id)}
                >
                  <span className={`admin-gallery__thumb${p.censored ? " is-censored" : ""}`}>
                    <img src={p.src} alt="" loading="lazy" />
                    <span className="admin-gallery__flags">
                      {isNew(p) && <Badge type="warn">Baru</Badge>}
                      {p.censored && <Badge type="danger" icon="Lock">Disensor</Badge>}
                    </span>
                  </span>
                  <span className="admin-gallery__info">
                    <span className="t-p-h4-bold admin-gallery__name">{p.author}</span>
                    <span className="t-p-h5 admin-muted">
                      {formatTime(p.at)} · {roomName(p.roomId)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {selected ? (
          <Panel
            icon="Image"
            tone="pink"
            title="Detail foto"
            aside={
              <button type="button" className="icon-btn clay clay-light guest-detail__close" onClick={() => onSelect(null)} aria-label="Tutup detail">
                <Icon name="Close" size={20} />
              </button>
            }
            footer={
              <>
                {selected.censored ? (
                  <Button block style="secondary" icon="Eye" onClick={() => openDialog("buka")}>
                    Buka sensor
                  </Button>
                ) : (
                  <Button block style="danger" icon="Lock" onClick={() => openDialog("sensor")}>
                    Sensor foto
                  </Button>
                )}
                <Button block style="tertiary" icon="Download" onClick={() => onDownload(selected)}>
                  Unduh
                </Button>
              </>
            }
          >
            <div className="admin-gallery__preview">
              <img src={selected.src} alt={selected.caption ?? `Foto dari ${selected.author}`} />
            </div>
            {selected.censored && (
              <p className="t-p-h5 admin-gallery__note">
                <Icon name="Lock" size={16} />
                Tamu melihat foto ini buram. Panitia tetap melihat aslinya.
              </p>
            )}
            <div className="admin-cell-name">
              <Avatar initial={selected.author.charAt(0)} size="M" />
              <span className="admin-cell-name__text">
                <span className="t-p-h3-bold">{selected.author}</span>
                <span className="t-p-h5 admin-muted">Diunggah {formatTime(selected.at)}</span>
              </span>
            </div>
            <dl className="guest-detail__list">
              <div className="guest-detail__row">
                <dt className="t-p-h5 admin-muted">Ruangan</dt>
                <dd>
                  <Badge type="room">{roomName(selected.roomId)}</Badge>
                </dd>
              </div>
              <div className="guest-detail__row">
                <dt className="t-p-h5 admin-muted">Status</dt>
                <dd>{selected.censored ? <Badge type="danger" icon="Lock">Disensor</Badge> : <Badge type="claimed">Tampil</Badge>}</dd>
              </div>
              {selected.censored && (
                <div className="guest-detail__row admin-gallery__caption">
                  <dt className="t-p-h5 admin-muted">Alasan sensor</dt>
                  <dd className="t-p-h4">{selected.censorReason ?? "–"}</dd>
                </div>
              )}
              <div className="guest-detail__row admin-gallery__caption">
                <dt className="t-p-h5 admin-muted">Caption</dt>
                <dd className="t-p-h4">{selected.caption ?? "–"}</dd>
              </div>
            </dl>
          </Panel>
        ) : (
          <Panel icon="Image" tone="pink" title="Detail foto">
            <Empty icon="Image" tone="pink" title="Pilih foto" body="Foto asli, info pengunggah dan tombol sensor muncul di sini." />
          </Panel>
        )}
      </div>

      {dialog && selected && (
        <Dialog
          form={dialog === "sensor"}
          icon={dialog === "sensor" ? "Lock" : "Eye"}
          iconTone={dialog === "sensor" ? "red" : "green"}
          title={dialog === "sensor" ? "Sensor foto ini?" : "Buka sensor foto ini?"}
          description={
            dialog === "sensor"
              ? `Foto dari ${selected.author} jadi buram untuk semua tamu dan tidak bisa dibuka atau diunduh. ${selected.author.split(" ")[0]} melihat label "Disensor panitia". Bisa dibuka lagi kapan saja.`
              : "Foto tampil normal lagi di galeri semua tamu dan bisa diunduh."
          }
          onClose={() => setDialog(null)}
          actions={
            <>
              <Button
                style={dialog === "sensor" ? "danger" : "primary"}
                onClick={() => {
                  onCensor(selected, dialog === "sensor", reason.trim() || undefined);
                  setDialog(null);
                }}
              >
                {dialog === "sensor" ? "Ya, sensor" : "Ya, buka sensor"}
              </Button>
              <Button style="tertiary" onClick={() => setDialog(null)}>
                Kembali
              </Button>
            </>
          }
        >
          {dialog === "sensor" && (
            <div className="admin-gallery__reason">
              <span className="t-p-h5-bold field__label">Alasan cepat</span>
              <div className="pill-tabs" role="group" aria-label="Alasan cepat">
                {CENSOR_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    className={`pill-tab t-p-h5-bold${reason === r ? " is-active clay clay-dark" : ""}`}
                    onClick={() => setReason(reason === r ? "" : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <TextField
                label="Alasan sensor (opsional)"
                value={reason}
                onChange={(v) => setReason(v.slice(0, CENSOR_REASON_MAX))}
                placeholder="Contoh: menampilkan data pribadi tamu lain"
                maxLength={CENSOR_REASON_MAX}
                hint={`Hanya terlihat oleh panitia · ${reason.length}/${CENSOR_REASON_MAX}`}
              />
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
