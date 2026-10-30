import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { formatTime } from "../data/agenda";
import type { AdminGuest } from "./data";
import { VoucherBox } from "./Guests";
import { DataTable, Empty, IconAction, Panel, Stat } from "./ui";

type Props = { guests: AdminGuest[]; pin: string; changedAt: number; onClaim: (id: string) => void; onChangePin: (pin: string) => void };

/** Rewards: who can claim, who already did, and the committee PIN used on guests' phones. */
export function Rewards({ guests, pin, changedAt, onClaim, onChangePin }: Props) {
  const [showPin, setShowPin] = useState(false);
  const [changing, setChanging] = useState(false);
  const [next, setNext] = useState("");
  const [claiming, setClaiming] = useState<AdminGuest | null>(null);
  const ready = guests.filter((g) => g.reward === "siap");
  const claimed = guests.filter((g) => g.reward === "diambil");
  const collecting = guests.filter((g) => g.reward === "mengumpulkan" && g.checkIn !== null);
  const rows = [...ready, ...claimed];

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Hadiah</h1>
          <p className="t-p-h4 admin-sub">Tamu dengan 5 kartu kenalan menukar voucher di meja panitia.</p>
        </div>
      </div>

      <section className="stat-strip">
        <Stat icon="Gift" tone="amber" label="Siap ditukar" value={ready.length} note="belum diambil di meja panitia" />
        <Stat icon="Check" tone="green" label="Sudah diambil" value={claimed.length} of={ready.length + claimed.length} note="dari semua hadiah siap" />
        <Stat icon="UserPlus" tone="purple" label="Masih mengumpulkan" value={collecting.length} note="tamu hadir, kurang dari 5 kartu" />
      </section>

      <div className="admin-fill rewards-fill">
        <Panel icon="Gift" tone="amber" title={`Voucher · ${rows.length}`} flush>
          <DataTable
            columns={[
              { label: "Tamu", width: "minmax(0, 1.4fr)" },
              { label: "Voucher", width: "minmax(0, 1fr)" },
              { label: "Status", width: "minmax(0, 0.8fr)" },
              { label: "Aksi", width: "180px", align: "end" },
            ]}
            empty={<Empty icon="Gift" tone="amber" title="Belum ada yang mengumpulkan 5 kartu" body="Tamu muncul di sini begitu kartunya lengkap." />}
            rows={rows.map((g) => ({
              id: g.id,
              cells: [
                <span className="admin-cell-name">
                  <Avatar initial={g.name.charAt(0)} size="S" />
                  <span className="t-p-h4-bold">{g.name}</span>
                </span>,
                <span className="t-p-h4">HMD-{g.name.slice(0, 3).toUpperCase()}-05</span>,
                g.reward === "diambil" ? <Badge type="claimed">Diambil</Badge> : <Badge type="ready">Siap</Badge>,
                g.reward === "siap" ? (
                  <Button size="small" style="secondary" onClick={() => setClaiming(g)}>
                    Tandai diambil
                  </Button>
                ) : (
                  <span className="t-p-h5 admin-muted">Diambil {g.claimedAt ? formatTime(g.claimedAt) : ""}</span>
                ),
              ],
            }))}
          />
        </Panel>

        <section className="admin-panel akses-hero clay clay-dark">
          <header className="admin-panel__head">
            <span className="icon-badge icon-badge--orange icon-badge--S clay clay-accent">
              <Icon name="Lock" size={16} />
            </span>
            <h2 className="t-p-h3-bold admin-panel__title">PIN panitia</h2>
          </header>
          <div className="admin-panel__body">
            <span className="t-p-h5 akses-hero__note">Dipakai panitia di HP tamu untuk menandai voucher sudah ditukar.</span>
            <CodeBoxes code={pin} hidden={!showPin} />
            <div className="akses-hero__actions">
              <IconAction icon={showPin ? "EyeOff" : "Eye"} label={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"} tip={showPin ? "Sembunyikan" : "Tampilkan"} onClick={() => setShowPin(!showPin)} />
              <Button size="small" style="primary" icon="Pencil" onClick={() => setChanging(true)}>
                Ganti PIN
              </Button>
            </div>
            <span className="t-p-h5 akses-hero__note">Terakhir diganti {formatTime(changedAt)} oleh Admin.</span>
          </div>
        </section>
      </div>

      {claiming && (
        <Dialog
          icon="Gift"
          iconTone="ink"
          title={`Hadiah ${claiming.name} sudah diambil?`}
          description="Voucher hadiahnya ditandai sudah dipakai dan tidak bisa ditukar lagi."
          onClose={() => setClaiming(null)}
          actions={
            <>
              <Button
                onClick={() => {
                  onClaim(claiming.id);
                  setClaiming(null);
                }}
              >
                Ya, sudah diambil
              </Button>
              <Button style="tertiary" onClick={() => setClaiming(null)}>
                Kembali
              </Button>
            </>
          }
        >
          <VoucherBox guest={claiming} />
        </Dialog>
      )}
      {changing && (
        <Dialog
          form
          icon="Lock"
          iconTone="orange"
          title="Ganti PIN panitia"
          description="Kabari semua panitia di meja hadiah setelah PIN diganti."
          onClose={() => setChanging(false)}
          actions={
            <>
              <Button
                disabled={next.length !== 4}
                onClick={() => {
                  onChangePin(next);
                  setNext("");
                  setChanging(false);
                }}
              >
                Simpan PIN baru
              </Button>
              <Button style="tertiary" onClick={() => setChanging(false)}>
                Batal
              </Button>
            </>
          }
        >
          <TextField label="PIN baru (4 angka)" value={next} onChange={(v) => setNext(v.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0000" autoFocus />
        </Dialog>
      )}
    </div>
  );
}

/** Code shown as separate digit boxes (like the PIN input). */
export function CodeBoxes({ code, hidden }: { code: string; hidden?: boolean }) {
  return (
    <span className="code-boxes" aria-label={hidden ? "Kode disembunyikan" : `Kode ${code.split("").join(" ")}`}>
      {code.split("").map((d, i) => (
        <span key={i} className="code-boxes__digit clay clay-grey">
          {hidden ? "•" : d}
        </span>
      ))}
    </span>
  );
}
