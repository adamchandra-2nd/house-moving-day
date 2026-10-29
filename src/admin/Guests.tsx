import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { RsvpTag } from "../components/RsvpTag";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { KENALAN_TARGET } from "../config";
import { formatTime } from "../data/agenda";
import { SHOW_CHECKIN_TIME } from "../config";
import { downloadCsv } from "./csv";
import type { AdminGuest } from "./data";
import { DataTable, Empty, Panel } from "./ui";

type Tab = "semua" | "hadir" | "masuk" | "belum" | "tidak";
type Confirm = { kind: "checkin" | "undo" | "reward"; guest: AdminGuest } | null;

type Props = {
  guests: AdminGuest[];
  search: string;
  selectedId: string | null;
  now: number;
  onSelect: (id: string | null) => void;
  onCheckIn: (id: string) => void;
  onUndoCheckIn: (id: string) => void;
  onClaimReward: (id: string) => void;
  onInvite: (id: string) => void;
  onExported: () => void;
};

/** RSVP = the answer to the invitation. Kehadiran = what happened on the day ("Hadir" = checked in + made a character). */
const rsvpTag = (g: AdminGuest) => <RsvpTag answer={g.rsvp} />;
const presenceOf = (g: AdminGuest): "hadir" | "masuk" | "belum" | "tidak" =>
  g.rsvp === "tidak" ? "tidak" : g.checkIn === null ? "belum" : g.hadir ? "hadir" : "masuk";
const presenceTag = (g: AdminGuest) => {
  const p = presenceOf(g);
  if (p === "hadir") return <Badge type="claimed">{SHOW_CHECKIN_TIME ? `Hadir · ${formatTime(g.checkIn as number)}` : "Hadir"}</Badge>;
  if (p === "masuk") return <Badge type="warn" icon="Smile">Sedang masuk</Badge>;
  if (p === "belum") return <Badge type="neutral" icon="Clock">Belum datang</Badge>;
  return <span className="admin-muted t-p-h5">–</span>;
};
const rewardTag = (g: AdminGuest) =>
  g.reward === "diambil" ? <Badge type="claimed">Diambil</Badge> : g.reward === "siap" ? <Badge type="ready">Siap</Badge> : <span className="admin-muted t-p-h5">–</span>;
const BY = { qr: "Scan QR", kode: "Kode pintu", panitia: "Panitia" };

/** Guest list with a detail side panel and committee actions. */
export function Guests({ guests, search, selectedId, now, onSelect, onCheckIn, onUndoCheckIn, onClaimReward, onInvite, onExported }: Props) {
  const [tab, setTab] = useState<Tab>("semua");
  const [confirm, setConfirm] = useState<Confirm>(null);

  const inTab = (t: Tab, g: AdminGuest) => t === "semua" || presenceOf(g) === t;
  const q = search.trim().toLowerCase();
  const rows = guests.filter((g) => inTab(tab, g) && (!q || g.name.toLowerCase().includes(q) || g.phone.includes(q)));
  const count = (t: Tab) => guests.filter((g) => inTab(t, g)).length;
  const selected = guests.find((g) => g.id === selectedId);

  const exportCsv = () => {
    downloadCsv("tamu-hmd.csv", [
      ["Nama", "Nomor WA", "RSVP", "Kehadiran", "Check-in", "Lewat", "Kartu", "Hadiah"],
      ...guests.map((g) => [g.name, g.phone, g.rsvp, presenceOf(g), g.checkIn !== null ? formatTime(g.checkIn) : "", g.checkInBy ?? "", g.cards, g.reward]),
    ]);
    onExported();
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "semua", label: "Semua" },
    { id: "hadir", label: "Hadir" },
    { id: "masuk", label: "Sedang masuk" },
    { id: "belum", label: "Belum datang" },
    { id: "tidak", label: "Tidak bisa" },
  ];

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Daftar tamu</h1>
          <p className="t-p-h4 admin-sub">Hadir = sudah check-in di pintu dan selesai membuat karakter.</p>
        </div>
        <div className="admin-actions">
          <Button size="small" style="tertiary" icon="Download" onClick={exportCsv}>
            Ekspor CSV
          </Button>
        </div>
      </div>

      <div className="pill-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`pill-tab t-p-h5-bold${tab === t.id ? " is-active clay clay-dark" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="pill-tab__count">{count(t.id)}</span>
          </button>
        ))}
      </div>

      <div className="admin-fill guests-fill">
        <Panel icon="Users" tone="green" title={`Tamu · ${rows.length}`} flush>
          <DataTable
            columns={[
              { label: "Nama", width: "minmax(0, 1.6fr)" },
              { label: "RSVP", width: "minmax(0, 1fr)" },
              { label: "Kehadiran", width: "minmax(0, 1.2fr)" },
              { label: "Kartu", width: "64px" },
              { label: "Hadiah", width: "minmax(0, 0.8fr)" },
            ]}
            empty={
              <Empty
                icon="Search"
                tone="slate"
                title="Tidak ada tamu yang cocok"
                body={q ? `Tidak ada hasil untuk "${search}". Coba ejaan lain.` : "Belum ada tamu di kategori ini."}
              />
            }
            rows={rows.map((g) => ({
              id: g.id,
              selected: g.id === selectedId,
              onClick: () => onSelect(g.id),
              cells: [
                <span className="admin-cell-name">
                  <Avatar initial={g.name.charAt(0)} size="S" />
                  <span className="admin-cell-name__text">
                    <span className="t-p-h4-bold">{g.name}</span>
                    <span className="t-p-h5 admin-muted">{g.phone}</span>
                  </span>
                </span>,
                rsvpTag(g),
                presenceTag(g),
                <span className="t-p-h4">
                  {g.cards}/{KENALAN_TARGET}
                </span>,
                rewardTag(g),
              ],
            }))}
          />
        </Panel>

        {selected ? (
          <Panel
            icon="Users"
            tone="green"
            title="Detail tamu"
            aside={
              <button type="button" className="icon-btn clay clay-light guest-detail__close" onClick={() => onSelect(null)} aria-label="Tutup detail">
                <Icon name="Close" size={20} />
              </button>
            }
            footer={
              <>
                {selected.checkIn === null ? (
                  <Button block icon="Check" onClick={() => setConfirm({ kind: "checkin", guest: selected })}>
                    Check-in manual
                  </Button>
                ) : (
                  <Button block style="danger" onClick={() => setConfirm({ kind: "undo", guest: selected })}>
                    Batalkan check-in
                  </Button>
                )}
                {selected.reward === "siap" && (
                  <Button block style="secondary" icon="Gift" onClick={() => setConfirm({ kind: "reward", guest: selected })}>
                    Tandai hadiah diambil
                  </Button>
                )}
                <Button block style="tertiary" icon="Message" onClick={() => onInvite(selected.id)}>
                  {selected.invite === "belum" ? "Kirim undangan WA" : "Kirim ulang undangan WA"}
                </Button>
              </>
            }
          >
            <div className="admin-cell-name">
              <Avatar initial={selected.name.charAt(0)} size="L" />
              <span className="admin-cell-name__text">
                <span className="t-display-h6">{selected.name}</span>
                <span className="t-p-h5 admin-muted">{selected.phone}</span>
              </span>
            </div>
            <dl className="guest-detail__list">
              <Row label="RSVP" value={rsvpTag(selected)} />
              <Row label="Kehadiran" value={presenceTag(selected)} />
              <Row label="Check-in lewat" value={<span className="t-p-h4-bold">{selected.checkInBy ? BY[selected.checkInBy] : "–"}</span>} />
              <Row
                label="Kartu kenalan"
                value={
                  <span className="t-p-h4-bold">
                    {selected.cards} dari {KENALAN_TARGET}
                  </span>
                }
              />
              <Row label="Hadiah" value={rewardTag(selected)} />
            </dl>
          </Panel>
        ) : (
          <Panel icon="Users" tone="green" title="Detail tamu">
            <Empty icon="Users" tone="green" title="Pilih tamu" body="Detail dan aksi check-in muncul di sini." />
          </Panel>
        )}
      </div>

      {confirm && (
        <Dialog
          icon={confirm.kind === "reward" ? "Gift" : confirm.kind === "undo" ? "Close" : "Check"}
          iconTone={confirm.kind === "undo" ? "red" : confirm.kind === "reward" ? "ink" : "green"}
          title={
            confirm.kind === "checkin" ? `Check-in ${confirm.guest.name}?` : confirm.kind === "undo" ? `Batalkan check-in ${confirm.guest.name}?` : `Hadiah ${confirm.guest.name} sudah diambil?`
          }
          description={
            confirm.kind === "checkin"
              ? `${SHOW_CHECKIN_TIME ? `Tercatat masuk jam ${formatTime(now)} lewat panitia.` : "Tercatat masuk lewat panitia."} ${confirm.guest.name} jadi Hadir setelah membuat karakter.${confirm.guest.rsvp !== "ya" ? " Catatan: RSVP-nya bukan Akan datang." : ""}`
              : confirm.kind === "undo"
                ? "Status kehadirannya dihapus. Pakai ini hanya kalau salah check-in."
                : "Voucher hadiahnya ditandai sudah dipakai dan tidak bisa ditukar lagi."
          }
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button
                style={confirm.kind === "undo" ? "danger" : "primary"}
                onClick={() => {
                  if (confirm.kind === "checkin") onCheckIn(confirm.guest.id);
                  if (confirm.kind === "undo") onUndoCheckIn(confirm.guest.id);
                  if (confirm.kind === "reward") onClaimReward(confirm.guest.id);
                  setConfirm(null);
                }}
              >
                {confirm.kind === "checkin" ? "Ya, check-in" : confirm.kind === "undo" ? "Ya, batalkan" : "Ya, sudah diambil"}
              </Button>
              <Button style="tertiary" onClick={() => setConfirm(null)}>
                Kembali
              </Button>
            </>
          }
        >
          {confirm.kind === "reward" && <VoucherBox guest={confirm.guest} />}
        </Dialog>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="guest-detail__row">
      <dt className="t-p-h5 admin-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Small voucher summary shown in reward confirmations, so the committee doesn't mix guests up. */
export function VoucherBox({ guest }: { guest: AdminGuest }) {
  return (
    <div className="voucher-box">
      <Avatar initial={guest.name.charAt(0)} size="M" />
      <span className="admin-cell-name__text">
        <span className="t-p-h4-bold">{guest.name}</span>
        <span className="t-p-h5 admin-muted">
          HMD-{guest.name.slice(0, 3).toUpperCase()}-05 · {guest.cards} kartu terkumpul
        </span>
      </span>
    </div>
  );
}
