import { useState, type ReactNode } from "react";
import type { IconName } from "../components/iconPaths";
import { Badge } from "../components/Badge";
import { BottomNav } from "../components/BottomNav";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { Toast, ToastIcon } from "../components/Toast";
import { formatTime } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import type { Announcement } from "./data";
import { roomStyle } from "./hooks";
import { RoomPicker } from "./pickers";
import { Empty, Panel } from "./ui";

type Props = {
  history: Announcement[];
  recipients: number;
  now: number;
  /** Review case: sending fails. */
  failSend: boolean;
  onSend: (a: { title: string; body: string; roomId: string | null }) => void;
  onResend: (id: string) => void;
  /**
   * Live: any sent announcement can be shown on guests' phones again, not
   * only a failed one. Review cases keep "kirim ulang" for failures.
   */
  resendAny?: boolean;
  /** Removes it from the history and from guests' Notifikasi. */
  onDelete: (id: string) => void;
};

const ago = (min: number) => (min < 1 ? "baru saja" : min < 60 ? `${min} menit lalu` : `${Math.floor(min / 60)} jam lalu`);

/** One detail line: icon, label, value on the right (+ optional extra under it). */
function MetaRow({ icon, label, value, children }: { icon: IconName; label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="ann-meta__row">
      <Icon name={icon} size={16} />
      <dt className="t-p-h5 admin-muted">{label}</dt>
      <dd className="t-p-h5-bold">{value}</dd>
      {children && <span className="ann-meta__extra">{children}</span>}
    </div>
  );
}

/**
 * Manual announcements from the committee, for things outside the rundown. Guests get them as the
 * same toast they see for event notices, with an optional "Ke sana" button to a room.
 */
export function Announcements({ history, recipients, now, failSend, onSend, onResend, resendAny, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(false);
  const [resending, setResending] = useState<Announcement | null>(null);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const q = query.trim().toLowerCase();
  // Newest first by when it last went out: a resend moves it back to the top.
  const shown = [...history].sort((x, y) => y.at - x.at).filter((a) => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));
  const ready = title.trim() && body.trim();
  const previewRoom = roomId ? roomIndexById(roomId) : 0;

  const send = () => {
    setConfirm(false);
    if (failSend) return setError(true);
    onSend({ title: title.trim(), body: body.trim(), roomId });
    setTitle("");
    setBody("");
    setRoomId(null);
  };

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Pengumuman</h1>
          <p className="t-p-h4 admin-sub">Kirim kabar di luar rundown ke semua tamu yang sudah hadir.</p>
        </div>
      </div>

      <div className="admin-fill ann-fill">
        <Panel
          icon="Pencil"
          tone="coral"
          title="Tulis pengumuman"
          footer={
            <Button block icon="Megaphone" disabled={!ready} onClick={() => setConfirm(true)}>
              {error ? "Kirim lagi" : `Kirim ke ${recipients} tamu`}
            </Button>
          }
        >
          <TextField label="Judul" value={title} onChange={setTitle} placeholder="Foto bersama 5 menit lagi" maxLength={40} hint={`${title.length}/40`} />
          <TextField
            label="Isi"
            value={body}
            onChange={(v) => {
              setError(false);
              setBody(v);
            }}
            placeholder="Kumpul di Halaman Depan ya!"
            multiline
            maxLength={120}
            hint={`${body.length}/120`}
            error={error ? "Gagal mengirim. Cek koneksi, lalu kirim lagi." : undefined}
          />
          <RoomPicker
            label="Ruangan tujuan (opsional)"
            value={roomId}
            onChange={setRoomId}
            optional
            emptyLabel="Tidak ada"
            hint="Kalau dipilih, notifikasi di HP tamu punya tombol “Ke sana” ke ruangan itu."
          />
        </Panel>

        {/* What guests will see: a mini main area */}
        <Panel icon="Eye" tone="ink" title="Pratinjau di HP tamu" flush>
          <div className="ann-preview">
            <div className="ann-phone">
              <div className="ann-phone__screen" style={{ backgroundImage: `url(${ROOMS[previewRoom].image})` }}>
                <div className="ann-phone__toast">
                  <Toast
                    lead={<ToastIcon icon="Megaphone" tone="accent" />}
                    title={title.trim() || "Judul pengumuman"}
                    sub={body.trim() || "Isi pengumuman tampil di sini."}
                    action={
                      roomId ? (
                        <Button size="small" style="secondary">
                          Ke sana
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
                <div className="ann-phone__stage">
                  <Character />
                </div>
                <div className="ann-phone__nav">
                  <BottomNav active="ruangan" feedbackLocked onChange={() => undefined} />
                </div>
              </div>
            </div>
            <p className="t-p-h5 admin-muted ann-preview__note">
              <Icon name="Bell" size={16} />
              Tersimpan juga di Notifikasi tamu.
            </p>
          </div>
        </Panel>

        <Panel
          icon="Clock"
          tone="slate"
          title="Riwayat"
          aside={<Badge type="neutral">{q ? `${shown.length} dari ${history.length}` : `${history.length} pengumuman`}</Badge>}
        >
          {history.length > 0 && (
            <label className="admin-search ann-search">
              <Icon name="Search" size={20} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul atau isi…" aria-label="Cari pengumuman" className="t-p-h4" />
              {query && (
                <button type="button" className="ann-search__clear" onClick={() => setQuery("")} aria-label="Hapus pencarian">
                  <Icon name="Close" size={16} />
                </button>
              )}
            </label>
          )}
          {history.length === 0 ? (
            <Empty icon="Megaphone" tone="coral" title="Belum ada pengumuman" body="Pengumuman yang terkirim muncul di sini." />
          ) : shown.length === 0 ? (
            <Empty icon="Search" tone="slate" title="Tidak ada pengumuman yang cocok" body={`Tidak ada judul atau isi yang memuat "${query.trim()}".`} />
          ) : (
            <ul className="ann-history">
              {shown.map((a) => (
                <li key={a.id} className="ann-history__item">
                  <span className="ann-history__head">
                    <span className="t-p-h4-bold">{a.title}</span>
                    <span className="ann-history__tags">
                      {a.source === "mc" && (
                        <Badge type="ready" icon="Megaphone">
                          MC
                        </Badge>
                      )}
                      {a.failed ? <Badge type="danger">Gagal</Badge> : <Badge type="read">Terkirim</Badge>}
                      <button type="button" className="ann-history__delete" onClick={() => setDeleting(a)} aria-label={`Hapus pengumuman ${a.title}`}>
                        <Icon name="Trash" size={18} />
                      </button>
                    </span>
                  </span>
                  <span className="t-p-h5 admin-muted">{a.body}</span>
                  <dl className="ann-meta">
                    <MetaRow icon="Clock" label="Dikirim" value={`${formatTime(a.at)} · ${ago(now - a.at)}`} />
                    <MetaRow icon="Users" label="Penerima" value={a.failed ? "–" : `${a.recipients} tamu hadir`} />
                    {!a.failed && (
                      <MetaRow icon="Eye" label="Dibaca" value={`${a.read} dari ${a.recipients}`}>
                        <span className="stat__bar">
                          <span style={{ width: `${a.recipients ? (a.read / a.recipients) * 100 : 0}%` }} />
                        </span>
                      </MetaRow>
                    )}
                    <MetaRow
                      icon="MapPin"
                      label="Tombol “Ke sana”"
                      value={
                        a.roomId ? (
                          <span className="dash-room" style={roomStyle(a.roomId)}>
                            <span className="room-dot" />
                            {ROOMS[roomIndexById(a.roomId)].name}
                          </span>
                        ) : (
                          "Tidak ada"
                        )
                      }
                    />
                  </dl>
                  {a.failed ? (
                    <Button size="small" style="secondary" icon="ArrowRight" onClick={() => onResend(a.id)}>
                      Kirim ulang
                    </Button>
                  ) : (
                    resendAny && (
                      <Button size="small" style="tertiary" icon="ArrowRight" onClick={() => setResending(a)}>
                        Kirim ulang
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {deleting && (
        <Dialog
          icon="Trash"
          iconTone="red"
          title="Hapus pengumuman ini?"
          description="Hilang dari riwayat dan dari Notifikasi di HP tamu. Tidak bisa dibatalkan."
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button
                style="danger"
                onClick={() => {
                  onDelete(deleting.id);
                  setDeleting(null);
                }}
              >
                Ya, hapus
              </Button>
              <Button style="tertiary" onClick={() => setDeleting(null)}>
                Kembali
              </Button>
            </>
          }
        >
          <div className="voucher-box ann-confirm">
            <span className="admin-cell-name__text">
              <span className="t-p-h4-bold">{deleting.title}</span>
              <span className="t-p-h5 admin-muted">{deleting.body}</span>
            </span>
          </div>
        </Dialog>
      )}
      {resending && (
        <Dialog
          icon="Megaphone"
          iconTone="coral"
          title="Kirim ulang pengumuman?"
          description={`“${resending.title}” muncul lagi di HP ${recipients} tamu yang sudah hadir.`}
          onClose={() => setResending(null)}
          actions={
            <>
              <Button
                onClick={() => {
                  onResend(resending.id);
                  setResending(null);
                }}
              >
                Kirim ulang
              </Button>
              <Button style="tertiary" onClick={() => setResending(null)}>
                Kembali
              </Button>
            </>
          }
        />
      )}
      {confirm && (
        <Dialog
          icon="Megaphone"
          iconTone="coral"
          title="Kirim pengumuman?"
          description={`Muncul di HP ${recipients} tamu yang sudah hadir. Pengumuman tidak bisa ditarik setelah terkirim.`}
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button onClick={send}>Kirim sekarang</Button>
              <Button style="tertiary" onClick={() => setConfirm(false)}>
                Kembali
              </Button>
            </>
          }
        >
          <div className="voucher-box ann-confirm">
            <span className="admin-cell-name__text">
              <span className="t-p-h4-bold">{title.trim()}</span>
              <span className="t-p-h5 admin-muted">{body.trim()}</span>
            </span>
          </div>
        </Dialog>
      )}
    </div>
  );
}
