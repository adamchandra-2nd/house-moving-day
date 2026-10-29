import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { IconBadge } from "../components/IconBadge";
import { TextField } from "../components/TextField";
import { Toggle } from "../components/Toggle";
import { formatTime } from "../data/agenda";
import { downloadCsv } from "./csv";
import { SAMPLE_CSV, type AdminGuest } from "./data";
import { DEFAULT_TEMPLATE, fillTemplate, issueOf, normalizePhone, parseCsv, simulateSend, type CsvIssue, type CsvRow } from "./invite";
import { DataTable, Empty, Panel, Stat } from "./ui";

export type UndanganDialog =
  | "single"
  | "tambah"
  | "tambah-error"
  | "tambah-duplikat"
  | "bulk-confirm"
  | "bulk-progress"
  | "bulk-result"
  | "template"
  | "csv-upload"
  | "csv-review"
  | "csv-error-format"
  | "csv-error-kolom"
  | "csv-error-kosong"
  | "csv-error-besar";

type Tab = "semua" | "belum" | "gagal" | "terkirim" | "dibaca" | "rsvp";
type Props = {
  guests: AdminGuest[];
  now: number;
  template: string;
  /** Review scenarios / deep link from a guest's detail. */
  initialTab?: Tab;
  initialSelected?: string[];
  initialDialog?: UndanganDialog;
  initialSingle?: string;
  onPatch: (id: string, patch: Partial<AdminGuest>) => void;
  onAdd: (rows: { name: string; phone: string }[]) => string[];
  onTemplate: (t: string) => void;
  onDone: (sent: number, failed: AdminGuest[]) => void;
  onToast: (title: string, sub: string) => void;
  /**
   * Really send, rather than simulate.
   *
   * Absent on the review links, which have no server behind them. When it is
   * there, the server mints the personal link and fills the template, and
   * this screen opens WhatsApp with it -- so the link the guest receives is
   * the one the API will recognise, not one assembled from a name.
   */
  onSendInvites?: (guestIds: string[]) => Promise<{ guestId: string; waUrl: string }[]>;
};

/** What the committee sees per guest: answered RSVP wins, otherwise the WhatsApp delivery status. */
const inviteState = (g: AdminGuest): Exclude<Tab, "semua"> | "mengirim" =>
  g.rsvp !== "belum" ? "rsvp" : g.invite === "mengirim" ? "mengirim" : g.invite;
/**
 * Anyone not mid-send can be picked. Guests who had already answered used to
 * be left out, which took away every checkbox once everybody had RSVP'd -- but
 * the link is also their way in on the day, and a guest who lost it needs it
 * sent again.
 */
const sendable = (g: AdminGuest) => g.invite !== "mengirim";
const firstName = (n: string) => n.split(" ")[0];
const newRow = (id: string, r: { name: string; phone: string }): AdminGuest => ({
  id,
  name: r.name,
  email: "",
  rsvp: "belum",
  checkIn: null,
  hadir: false,
  phone: r.phone,
  invite: "belum",
  cards: 0,
  reward: "mengumpulkan",
  finalFeedback: false,
});

function inviteTag(g: AdminGuest): ReactNode {
  switch (inviteState(g)) {
    case "rsvp":
      return <Badge type="claimed" icon="ChatCheck">Sudah RSVP</Badge>;
    case "dibaca":
      return <Badge type="neutral" icon="CheckDouble">Dibaca</Badge>;
    case "terkirim":
      return <Badge type="neutral" icon="Check">Terkirim</Badge>;
    case "gagal":
      return <Badge type="danger" icon="Close">Gagal</Badge>;
    case "mengirim":
      return <Badge type="warn" icon="Send">Mengirim…</Badge>;
    default:
      return <Badge type="done">Belum dikirim</Badge>;
  }
}

function Check({ checked, mixed, disabled, label, onChange }: { checked: boolean; mixed?: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      className={`check${checked || mixed ? " is-on clay clay-accent" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      {checked && <Icon name="Check" size={16} />}
      {mixed && !checked && <span className="check__dash" />}
    </button>
  );
}

/** WhatsApp chat bubble preview of the invitation. */
export function WaBubble({ text, at }: { text: string; at: string }) {
  return (
    <div className="wa-chat">
      <div className="wa-bubble t-p-h5">
        {text.split(/(hmd\.potara\.id\/u\/\S+)/).map((part, i) => (i % 2 ? <span key={i} className="wa-bubble__link">{part}</span> : part))}
        <span className="wa-bubble__meta">
          {at} <Icon name="CheckDouble" size={14} />
        </span>
      </div>
    </div>
  );
}

const ISSUE: Record<Exclude<CsvIssue, "ok">, { tag: string; type: "danger" | "warn" | "neutral" }> = {
  nama: { tag: "Nama kosong", type: "danger" },
  nomor: { tag: "Nomor tidak valid", type: "danger" },
  duplikat: { tag: "Duplikat", type: "warn" },
  terdaftar: { tag: "Sudah pernah diundang", type: "neutral" },
};

const SAMPLE_ERRORS: Record<string, string> = {
  "csv-error-format": "File harus berformat .csv. Simpan dari Excel/Sheets sebagai CSV dulu.",
  "csv-error-kolom": "Kolom tidak sesuai. Baris pertama harus: nama,nomor_wa (pakai template).",
  "csv-error-kosong": "File kosong. Isi minimal satu tamu di bawah baris judul.",
  "csv-error-besar": "File terlalu besar (maks. 1 MB atau sekitar 5.000 tamu).",
};

/**
 * WhatsApp invitations (prototype: delivery is simulated; production sends through the WhatsApp Business API).
 * Send one by one or in bulk. A CSV import only adds guests to the list after a review; nothing is sent until
 * the committee presses Kirim.
 */
export function Undangan({ guests, now, template, initialTab, initialSelected, initialDialog, initialSingle, onPatch, onAdd, onTemplate, onDone, onToast, onSendInvites }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "semua");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [single, setSingle] = useState<AdminGuest | null>(() => (initialSingle ? (guests.find((g) => g.id === initialSingle) ?? null) : null));
  const [bulkConfirm, setBulkConfirm] = useState(initialDialog === "bulk-confirm");
  /** `links` is set live only: the server mints the WhatsApp links, the committee taps each one. */
  const [run, setRun] = useState<{ ids: string[]; done: number; failed: AdminGuest[]; finished: boolean; links?: { id: string; name: string; waUrl: string }[] } | null>(null);
  const [editing, setEditing] = useState(initialDialog === "template");
  const [adding, setAdding] = useState(initialDialog?.startsWith("tambah") ?? false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [csv, setCsv] = useState<{ step: "upload" | "review"; error?: string; file?: string; rows: CsvRow[] } | null>(() => {
    if (initialDialog === "csv-upload") return { step: "upload", rows: [] };
    if (initialDialog?.startsWith("csv-error")) return { step: "upload", rows: [], error: SAMPLE_ERRORS[initialDialog], file: initialDialog === "csv-error-format" ? "daftar-tamu.xlsx" : "daftar-tamu.csv" };
    if (initialDialog === "csv-review") {
      const p = parseCsv(SAMPLE_CSV, "daftar-tamu.csv", SAMPLE_CSV.length);
      return p.ok ? { step: "review", file: "daftar-tamu.csv", rows: p.rows.map((r) => ({ ...r, include: true })) } : null;
    }
    return null;
  });
  const timer = useRef<number | undefined>(undefined);

  const counts: Record<Tab, number> = { semua: guests.length, belum: 0, gagal: 0, terkirim: 0, dibaca: 0, rsvp: 0 };
  guests.forEach((g) => {
    const s = inviteState(g);
    if (s !== "mengirim") counts[s]++;
  });
  const rows = guests.filter((g) => tab === "semua" || inviteState(g) === tab);
  const selectable = rows.filter(sendable);
  const allOn = selectable.length > 0 && selectable.every((g) => selected.has(g.id));
  const someOn = selectable.some((g) => selected.has(g.id));
  const picked = guests.filter((g) => selected.has(g.id) && sendable(g));
  const unsent = guests.filter((g) => g.rsvp === "belum" && (g.invite === "belum" || g.invite === "gagal"));

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  /** Briefly highlights a row and scrolls it into view. */
  const flash = (id: string) => {
    setHighlight(id);
    window.setTimeout(() => document.querySelector(".undangan-fill .dtable__row.is-selected")?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 2600);
  };

  /** Sends one guest at a time (like the Business API queue), updating each row as it goes. */
  const startBulk = (list: AdminGuest[]) => {
    setBulkConfirm(false);
    setSelected(new Set());
    const ids = list.map((g) => g.id);
    ids.forEach((id) => onPatch(id, { invite: "mengirim", inviteError: undefined }));
    setRun({ ids, done: 0, failed: [], finished: false });

    if (onSendInvites) {
      // Live: one request for the whole batch. Nothing is delivered by the
      // server yet -- it marks the batch sent and hands back a wa.me link per
      // guest. A browser allows one popup per click at most, so the links are
      // listed in the result for the committee to open one by one.
      void onSendInvites(ids)
        .then((plans) => {
          ids.forEach((id) => onPatch(id, { invite: "terkirim", invitedAt: now, inviteError: undefined }));
          const links = plans.map((p) => ({ id: p.guestId, name: list.find((g) => g.id === p.guestId)?.name ?? "", waUrl: p.waUrl }));
          setRun({ ids, done: ids.length, failed: [], finished: true, links });
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Gagal mengirim";
          const failed = list.map((g) => ({ ...g, invite: "gagal" as const, inviteError: msg }));
          ids.forEach((id) => onPatch(id, { invite: "gagal", invitedAt: now, inviteError: msg }));
          setRun({ ids, done: ids.length, failed, finished: true });
          onDone(0, failed);
        });
      return;
    }

    let i = 0;
    const failed: AdminGuest[] = [];
    const step = () => {
      const g = list[i];
      const r = simulateSend(g.phone);
      if (r.ok) onPatch(g.id, { invite: "terkirim", invitedAt: now, inviteError: undefined });
      else {
        onPatch(g.id, { invite: "gagal", invitedAt: now, inviteError: r.error });
        failed.push({ ...g, invite: "gagal", inviteError: r.error });
      }
      i++;
      setRun({ ids, done: i, failed: [...failed], finished: i === list.length });
      if (i < list.length) timer.current = window.setTimeout(step, 450);
      else onDone(list.length - failed.length, failed);
    };
    timer.current = window.setTimeout(step, 600);
  };

  const sendOne = (g: AdminGuest) => {
    setSingle(null);
    onPatch(g.id, { invite: "mengirim", inviteError: undefined });

    if (onSendInvites) {
      // Opened in the same gesture as the click where possible; a popup
      // blocker is the usual reason this does nothing, so the link is also
      // reported in the toast.
      void onSendInvites([g.id])
        .then(([plan]) => {
          onPatch(g.id, { invite: "terkirim", invitedAt: now });
          if (plan) window.open(plan.waUrl, "_blank", "noopener");
          onToast(`WhatsApp dibuka untuk ${g.name}`, "Tekan kirim di WhatsApp untuk mengirim undangannya.");
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Gagal mengirim";
          onPatch(g.id, { invite: "gagal", invitedAt: now, inviteError: msg });
          onDone(0, [{ ...g, inviteError: msg }]);
        });
      return;
    }

    timer.current = window.setTimeout(() => {
      const r = simulateSend(g.phone);
      if (r.ok) {
        onPatch(g.id, { invite: "terkirim", invitedAt: now });
        onToast(`Undangan terkirim ke ${g.name}`, "Status berubah jadi Dibaca begitu pesannya dibuka.");
      } else {
        onPatch(g.id, { invite: "gagal", invitedAt: now, inviteError: r.error });
        onDone(0, [{ ...g, inviteError: r.error }]);
      }
    }, 900);
  };

  // Review scenarios that start mid-flow
  useEffect(() => {
    if (initialDialog === "bulk-progress" || initialDialog === "bulk-result") {
      const list = guests.filter((g) => initialSelected?.includes(g.id));
      if (initialDialog === "bulk-progress") startBulk(list);
      else {
        const failed = list.filter((g) => !simulateSend(g.phone).ok).map((g) => ({ ...g, invite: "gagal" as const, inviteError: "Nomor tidak terdaftar di WhatsApp" }));
        list.forEach((g) => onPatch(g.id, failed.some((f) => f.id === g.id) ? { invite: "gagal", invitedAt: now, inviteError: "Nomor tidak terdaftar di WhatsApp" } : { invite: "terkirim", invitedAt: now }));
        setSelected(new Set());
        setRun({ ids: list.map((g) => g.id), done: list.length, failed, finished: true });
      }
    }
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "semua", label: "Semua" },
    { id: "belum", label: "Belum dikirim" },
    { id: "gagal", label: "Gagal" },
    { id: "terkirim", label: "Terkirim" },
    { id: "dibaca", label: "Dibaca" },
    { id: "rsvp", label: "Sudah RSVP" },
  ];
  const sample = guests.find((g) => g.invite === "belum") ?? guests[0];

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Undangan WA</h1>
          <p className="t-p-h4 admin-sub">Kirim link RSVP lewat WhatsApp, satu per satu atau sekaligus.</p>
        </div>
        <div className="admin-actions">
          <Button size="small" style="tertiary" icon="Upload" onClick={() => setCsv({ step: "upload", rows: [] })}>
            Impor CSV
          </Button>
          <Button size="small" icon="Plus" onClick={() => setAdding(true)}>
            Tambah tamu
          </Button>
        </div>
      </div>

      <section className="stat-strip" aria-label="Ringkasan undangan">
        <Stat icon="Mail" tone="slate" label="Belum dikirim" value={counts.belum} note="siap diundang" />
        <Stat icon="Check" tone="blue" label="Terkirim" value={counts.terkirim} note="belum dibuka" />
        <Stat icon="CheckDouble" tone="sky" label="Dibaca" value={counts.dibaca} note="dibuka, belum jawab RSVP" />
        <Stat icon="ChatCheck" tone="green" label="Sudah RSVP" value={counts.rsvp} of={guests.length} note="dari semua yang diundang" />
        <Stat icon="Close" tone="red" label="Gagal" value={counts.gagal} note={counts.gagal ? "cek nomornya, lalu kirim ulang" : "semua lancar"} />
      </section>

      <div className="admin-fill undangan-fill">
        <Panel
          icon="Users"
          tone="blue"
          title="Daftar undangan"
          flush
          aside={
            <Button size="small" style="tertiary" icon="Check" disabled={unsent.length === 0} onClick={() => setSelected(new Set(unsent.map((g) => g.id)))}>
              Pilih semua yang belum dikirim
            </Button>
          }
          footer={
            picked.length > 0 ? (
              <div className="bulk-bar clay clay-dark">
                <span className="t-p-h4-bold">{picked.length} tamu dipilih</span>
                <button type="button" className="bulk-bar__clear t-p-h5-bold" onClick={() => setSelected(new Set())}>
                  Batal pilih
                </button>
                <Button size="small" icon="Send" onClick={() => setBulkConfirm(true)}>
                  Kirim undangan ({picked.length})
                </Button>
              </div>
            ) : undefined
          }
        >
          <div className="pill-tabs undangan-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`pill-tab t-p-h5-bold${tab === t.id ? " is-active clay clay-dark" : ""}`} onClick={() => setTab(t.id)}>
                {t.label} <span className="pill-tab__count">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <DataTable
            columns={[
              {
                label: <Check checked={allOn} mixed={someOn} disabled={!selectable.length} label="Pilih semua di tab ini" onChange={(on) => selectable.forEach((g) => toggle(g.id, on))} />,
                width: "40px",
              },
              { label: "Tamu", width: "minmax(0, 1.3fr)" },
              { label: "Status", width: "minmax(0, 1.2fr)" },
              { label: "Dikirim", width: "90px" },
              { label: "Aksi", width: "176px", align: "end" },
            ]}
            empty={<Empty icon="Mail" tone="green" title={tab === "gagal" ? "Tidak ada yang gagal" : "Belum ada tamu di sini"} body={tab === "gagal" ? "Semua undangan berhasil terkirim." : "Impor CSV untuk menambah tamu."} />}
            rows={rows.map((g) => ({
              id: g.id,
              selected: selected.has(g.id) || highlight === g.id,
              onClick: sendable(g) ? () => toggle(g.id, !selected.has(g.id)) : undefined,
              cells: [
                sendable(g) ? <Check checked={selected.has(g.id)} label={`Pilih ${g.name}`} onChange={(on) => toggle(g.id, on)} /> : <span />,
                <span className="admin-cell-name">
                  <Avatar initial={g.name.charAt(0)} size="S" />
                  <span className="admin-cell-name__text">
                    <span className="t-p-h4-bold">{g.name}</span>
                    <span className="t-p-h5 admin-muted">{g.phone}</span>
                  </span>
                </span>,
                <span className="invite-status">
                  {inviteTag(g)}
                  {g.invite === "gagal" && g.rsvp === "belum" && <span className="t-p-h5 invite-status__err">{g.inviteError}</span>}
                </span>,
                <span className="t-p-h5 admin-muted">{g.invitedAt !== undefined && g.invite !== "belum" ? formatTime(g.invitedAt) : "–"}</span>,
                g.invite === "mengirim" ? (
                  <span className="t-p-h5 admin-muted">Mengirim…</span>
                ) : (
                  <Button size="small" style="tertiary" icon="Send" onClick={() => setSingle(g)}>
                    {g.invite === "belum" ? "Kirim" : g.rsvp === "belum" ? "Kirim ulang" : "Kirim ulang link"}
                  </Button>
                ),
              ],
            }))}
          />
        </Panel>

        <Panel
          icon="Message"
          tone="blue"
          title="Pesan undangan"
          footer={
            <Button block style="secondary" icon="Pencil" onClick={() => setEditing(true)}>
              Ubah pesan
            </Button>
          }
        >
          <p className="t-p-h5 admin-muted">Pratinjau untuk {sample?.name ?? "tamu"}. {"{nama}"} dan {"{link}"} diganti otomatis per tamu.</p>
          <WaBubble text={fillTemplate(template, sample?.name ?? "Tamu")} at={formatTime(now)} />
          <div className="setting-box setting-box--note">
            <Icon name="Lock" size={20} />
            <span className="t-p-h5">Dikirim dari WhatsApp Business resmi Potara.</span>
          </div>
        </Panel>
      </div>

      {single && (
        <Dialog
          icon="Send"
          iconTone="green"
          title={single.invite === "belum" ? `Kirim undangan ke ${firstName(single.name)}?` : `Kirim ulang ke ${firstName(single.name)}?`}
          description={
            single.invite === "gagal"
              ? `Pengiriman sebelumnya gagal: ${single.inviteError}. Pastikan nomornya benar.`
              : single.invite === "belum"
                ? `Pesan dikirim ke ${single.phone} lewat WhatsApp.`
                : `${firstName(single.name)} sudah menerima undangan jam ${formatTime(single.invitedAt ?? now)}. Kirim lagi sebagai pengingat?`
          }
          form
          onClose={() => setSingle(null)}
          actions={
            <>
              <Button icon="Send" onClick={() => sendOne(single)}>
                {single.invite === "belum" ? "Kirim" : "Kirim ulang"}
              </Button>
              <Button style="tertiary" onClick={() => setSingle(null)}>
                Kembali
              </Button>
            </>
          }
        >
          <WaBubble text={fillTemplate(template, single.name)} at={formatTime(now)} />
        </Dialog>
      )}

      {bulkConfirm && (
        <Dialog
          icon="Send"
          iconTone="green"
          title={`Kirim undangan ke ${picked.length} tamu?`}
          description="Tiap tamu dapat pesan dengan nama dan link pribadinya sendiri (untuk RSVP dan check-in). Pengiriman tidak bisa dibatalkan."
          form
          onClose={() => setBulkConfirm(false)}
          actions={
            <>
              <Button icon="Send" onClick={() => startBulk(picked)}>
                Kirim ke {picked.length} tamu
              </Button>
              <Button style="tertiary" onClick={() => setBulkConfirm(false)}>
                Kembali
              </Button>
            </>
          }
        >
          <div className="bulk-names">
            {picked.slice(0, 8).map((g) => (
              <span key={g.id} className="bulk-names__chip t-p-h5-bold">
                {g.name}
              </span>
            ))}
            {picked.length > 8 && <span className="bulk-names__chip t-p-h5-bold">+{picked.length - 8} lainnya</span>}
          </div>
          {picked[0] && <WaBubble text={fillTemplate(template, picked[0].name)} at={formatTime(now)} />}
        </Dialog>
      )}

      {run && !run.finished && (
        <Dialog
          icon="Send"
          iconTone="green"
          title={`Mengirim ${Math.min(run.done + 1, run.ids.length)} dari ${run.ids.length}`}
          description="Boleh tutup jendela ini, pengiriman tetap jalan dan statusnya muncul di daftar."
          form
          onClose={() => setRun(null)}
          actions={
            <Button style="tertiary" onClick={() => setRun(null)}>
              Tutup, lanjut di latar
            </Button>
          }
        >
          <div className="send-progress">
            <span className="stat__bar">
              <span style={{ width: `${Math.round((run.done / run.ids.length) * 100)}%` }} />
            </span>
            <span className="t-p-h5 admin-muted">
              {run.done - run.failed.length} terkirim{run.failed.length ? ` · ${run.failed.length} gagal` : ""}
            </span>
          </div>
        </Dialog>
      )}

      {run?.finished && (
        <Dialog
          icon={run.failed.length ? "Close" : "Check"}
          iconTone={run.failed.length ? "red" : "green"}
          title={run.failed.length ? `${run.ids.length - run.failed.length} terkirim, ${run.failed.length} gagal` : run.links ? `${run.ids.length} link WhatsApp siap` : `${run.ids.length} undangan terkirim`}
          description={
            run.failed.length
              ? "Cek nomor yang gagal. Kirim ulang setelah nomornya benar, atau coba lagi sekarang."
              : run.links
                ? "Buka satu per satu, lalu tekan kirim di WhatsApp."
                : "Status berubah jadi Dibaca begitu tamu membuka pesannya."
          }
          form={run.failed.length > 0 || !!run.links?.length}
          onClose={() => setRun(null)}
          actions={
            run.failed.length ? (
              <>
                <Button
                  icon="Send"
                  onClick={() => {
                    const again = guests.filter((g) => run.failed.some((f) => f.id === g.id));
                    setRun(null);
                    startBulk(again);
                  }}
                >
                  Kirim ulang yang gagal
                </Button>
                <Button style="tertiary" onClick={() => setRun(null)}>
                  Selesai
                </Button>
              </>
            ) : (
              <Button onClick={() => setRun(null)}>Selesai</Button>
            )
          }
        >
          {!!run.links?.length && (
            <ul className="diff-list">
              {run.links.map((l) => (
                <li key={l.id} className="diff-list__row">
                  <span className="t-p-h4-bold diff-list__name">{l.name}</span>
                  <a className="t-p-h5 diff-list__change" href={l.waUrl} target="_blank" rel="noopener noreferrer">
                    Buka WhatsApp
                  </a>
                </li>
              ))}
            </ul>
          )}
          {run.failed.length > 0 && (
            <ul className="diff-list">
              {run.failed.map((g) => (
                <li key={g.id} className="diff-list__row">
                  <span className="t-p-h4-bold diff-list__name">{g.name}</span>
                  <span className="t-p-h5 diff-list__change">
                    {g.phone} · {g.inviteError}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}

      {adding && (
        <AddGuest
          guests={guests}
          template={template}
          now={now}
          sample={initialDialog === "tambah-error" ? "error" : initialDialog === "tambah-duplikat" ? "duplikat" : undefined}
          onClose={() => setAdding(false)}
          onShow={(id) => {
            setAdding(false);
            setTab("semua");
            flash(id);
          }}
          onAdd={(row, sendNow, again) => {
            const [id] = onAdd([row]);
            if (!again) setAdding(false);
            setTab("semua");
            flash(id);
            if (sendNow) sendOne(newRow(id, row));
            else onToast(`${row.name} ditambahkan`, "Status Belum dikirim. Kirim kapan saja dari daftar.");
          }}
        />
      )}

      {editing && (
        <TemplateEditor
          value={template}
          now={now}
          onClose={() => setEditing(false)}
          onSave={(t) => {
            onTemplate(t);
            setEditing(false);
          }}
        />
      )}

      {csv && (
        <CsvImport
          state={csv}
          guests={guests}
          sample={!onSendInvites}
          onChange={setCsv}
          onClose={() => setCsv(null)}
          onConfirm={(add, resend) => {
            const ids = onAdd(add);
            setCsv(null);
            setTab("belum");
            setSelected(new Set([...ids, ...resend]));
            onToast(`${add.length} tamu ditambahkan`, "Sudah dipilih. Periksa lagi, lalu tekan Kirim undangan.");
          }}
        />
      )}
    </div>
  );
}

/** Add one guest by hand. Adds to the list only, unless "Langsung kirim undangan" is on. */
function AddGuest({
  guests,
  template,
  now,
  sample,
  onClose,
  onShow,
  onAdd,
}: {
  guests: AdminGuest[];
  template: string;
  now: number;
  sample?: "error" | "duplikat";
  onClose: () => void;
  onShow: (id: string) => void;
  onAdd: (row: { name: string; phone: string }, sendNow: boolean, again: boolean) => void;
}) {
  const [name, setName] = useState(sample === "duplikat" ? "Laras" : sample === "error" ? "" : "");
  const [phone, setPhone] = useState(sample === "duplikat" ? "0812 3441 114" : sample === "error" ? "08123" : "");
  const [sendNow, setSendNow] = useState(false);
  const [tried, setTried] = useState(!!sample);
  const [added, setAdded] = useState<string | null>(null);
  const p = normalizePhone(phone);
  const existing = p ? guests.find((g) => normalizePhone(g.phone) === p) : undefined;
  const nameError = !name.trim() ? "Nama wajib diisi." : undefined;
  const phoneError = !phone.trim() ? "Nomor WA wajib diisi." : !p ? "Nomor tidak valid. Contoh: 081234567890" : undefined;
  const ok = !nameError && !phoneError && !existing;

  const submit = (again: boolean) => {
    setTried(true);
    if (!ok) return;
    onAdd({ name: name.trim(), phone: p! }, sendNow, again);
    if (again) {
      setAdded(name.trim());
      setName("");
      setPhone("");
      setTried(false);
    }
  };

  return (
    <Dialog
      icon="UserPlus"
      iconTone="blue"
      title="Tambah tamu"
      description="Tamu masuk ke daftar undangan. Undangan baru terkirim kalau kamu menekan Kirim, atau nyalakan Langsung kirim."
      form
      wide
      onClose={onClose}
      danger={
        <Button style="tertiary" icon="Plus" onClick={() => submit(true)}>
          Simpan & tambah lagi
        </Button>
      }
      actions={
        <>
          <Button icon={sendNow ? "Send" : "UserPlus"} onClick={() => submit(false)}>
            {sendNow ? "Tambah & kirim" : "Tambah tamu"}
          </Button>
          <Button style="tertiary" onClick={onClose}>
            Kembali
          </Button>
        </>
      }
    >
      {added && (
        <div className="add-done t-p-h5-bold">
          <Icon name="Check" size={16} /> {added} ditambahkan. Lanjut isi tamu berikutnya.
        </div>
      )}
      <TextField label="Nama" value={name} onChange={setName} placeholder="Nama tamu" error={tried ? nameError : undefined} autoFocus />
      <div className="add-phone">
        <TextField label="Nomor WA" value={phone} onChange={setPhone} placeholder="081234567890" inputMode="tel" error={tried ? phoneError : undefined} hint={!tried || !phoneError ? "Format 08… atau +62…" : undefined} />
        {existing && (
          <div className="dup-note">
            <span className="t-p-h5 field__hint--error">Nomor ini sudah terdaftar atas nama {existing.name}.</span>
            <Button size="small" style="tertiary" icon="ArrowRight" onClick={() => onShow(existing.id)}>
              Lihat
            </Button>
          </div>
        )}
      </div>
      <Toggle dark label="Langsung kirim undangan" hint="Kirim lewat WhatsApp begitu disimpan" checked={sendNow} onChange={setSendNow} />
      {sendNow && <WaBubble text={fillTemplate(template, name.trim() || "Tamu")} at={formatTime(now)} />}
    </Dialog>
  );
}

function TemplateEditor({ value, now, onSave, onClose }: { value: string; now: number; onSave: (t: string) => void; onClose: () => void }) {
  const [t, setT] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const error = !t.includes("{link}") ? "Pesan wajib berisi {link} supaya tamu bisa RSVP." : t.length > 600 ? "Maksimal 600 karakter." : undefined;
  const insert = (token: string) => {
    const el = ref.current;
    const at = el?.selectionStart ?? t.length;
    setT(t.slice(0, at) + token + t.slice(el?.selectionEnd ?? at));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  return (
    <Dialog
      icon="Pencil"
      iconTone="green"
      title="Ubah pesan undangan"
      description="Berlaku untuk undangan berikutnya. Yang sudah terkirim tidak berubah."
      form
      wide
      onClose={onClose}
      danger={
        <Button style="tertiary" disabled={t === DEFAULT_TEMPLATE} onClick={() => setT(DEFAULT_TEMPLATE)}>
          Pakai pesan awal
        </Button>
      }
      actions={
        <>
          <Button disabled={!!error || t === value} onClick={() => onSave(t)}>
            Simpan pesan
          </Button>
          <Button style="tertiary" onClick={onClose}>
            Kembali
          </Button>
        </>
      }
    >
      <div className="template-editor">
        <div className="field">
          <span className="t-p-h5-bold field__label">Isi pesan</span>
          <textarea ref={ref} className={`field__input field__input--multiline t-p-h4 template-editor__input${error ? " is-error" : ""}`} value={t} onChange={(e) => setT(e.target.value)} />
          <div className="template-editor__tools">
            <button type="button" className="token-chip t-p-h5-bold" onClick={() => insert("{nama}")}>
              <Icon name="Plus" size={16} /> {"{nama}"}
            </button>
            <button type="button" className="token-chip t-p-h5-bold" onClick={() => insert("{link}")}>
              <Icon name="Plus" size={16} /> {"{link}"}
            </button>
            <span className="t-p-h5 admin-muted template-editor__count">{t.length}/600</span>
          </div>
          {error && <span className="t-p-h5 field__hint field__hint--error">{error}</span>}
        </div>
        <div className="field">
          <span className="t-p-h5-bold field__label">Pratinjau di WhatsApp</span>
          <WaBubble text={fillTemplate(t, "Andini")} at={formatTime(now)} />
        </div>
      </div>
    </Dialog>
  );
}

type CsvState = { step: "upload" | "review"; error?: string; file?: string; rows: CsvRow[] };

function CsvImport({
  state,
  guests,
  sample,
  onChange,
  onClose,
  onConfirm,
}: {
  state: CsvState;
  guests: AdminGuest[];
  /** Offers the bundled sample file. Review cases only: live it would import fake guests. */
  sample: boolean;
  onChange: (s: CsvState) => void;
  onClose: () => void;
  onConfirm: (add: { name: string; phone: string }[], resend: string[]) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const existing = new Map(guests.map((g) => [normalizePhone(g.phone) ?? g.phone, g]));
  const phones = new Set(existing.keys());

  const load = (text: string, name: string, size: number) => {
    const p = parseCsv(text, name, size);
    onChange(p.ok ? { step: "review", file: name, rows: p.rows } : { step: "upload", rows: [], error: p.error, file: name });
  };
  const readFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name) || f.size > 1024 * 1024) return load("", f.name, f.size);
    f.text().then((t) => load(t, f.name, f.size));
  };

  if (state.step === "upload") {
    return (
      <Dialog
        icon="Upload"
        iconTone="blue"
        title="Impor tamu dari CSV"
        description="Langkah 1 dari 2 · Unggah file. Setelah ini kamu periksa dulu isinya, belum ada yang dikirim."
        form
        wide
        onClose={onClose}
        danger={
          <Button style="tertiary" icon="Download" onClick={() => downloadCsv("template-undangan.csv", [["nama", "nomor_wa"], ["Andini", "081298765432"]])}>
            Unduh template
          </Button>
        }
        actions={
          <Button style="tertiary" onClick={onClose}>
            Kembali
          </Button>
        }
      >
        <div
          className={`dropzone${over ? " is-over" : ""}${state.error ? " has-error" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            readFile(e.dataTransfer.files[0]);
          }}
        >
          <IconBadge icon={state.error ? "Close" : "Upload"} tone={state.error ? "red" : "blue"} size="L" />
          {state.error ? (
            <>
              <span className="t-p-h4-bold">{state.file} tidak bisa dibaca</span>
              <span className="t-p-h5 dropzone__err">{state.error}</span>
            </>
          ) : (
            <>
              <span className="t-p-h4-bold">Tarik file CSV ke sini</span>
              <span className="t-p-h5 admin-muted">Kolom: nama, nomor_wa · maks. 1 MB</span>
            </>
          )}
          <div className="dropzone__actions">
            <Button size="small" style="secondary" icon="File" onClick={() => input.current?.click()}>
              {state.error ? "Pilih file lain" : "Pilih file"}
            </Button>
            {sample && (
              <Button size="small" style="tertiary" onClick={() => load(SAMPLE_CSV, "contoh-tamu.csv", SAMPLE_CSV.length)}>
                Pakai contoh data
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
      </Dialog>
    );
  }

  const rows = state.rows;
  const issues = rows.map((r) => issueOf(r, rows, phones));
  const set = (line: number, patch: Partial<CsvRow>) => onChange({ ...state, rows: rows.map((r) => (r.line === line ? { ...r, ...patch } : r)) });
  const blocking = rows.filter((r, i) => r.include && (issues[i] === "nama" || issues[i] === "nomor" || issues[i] === "duplikat"));
  const ready = rows.filter((r, i) => r.include && issues[i] === "ok");
  const answered = (r: CsvRow) => existing.get(normalizePhone(r.phone) ?? "")?.rsvp !== "belum";
  const resend = rows.filter((r, i) => r.include && issues[i] === "terdaftar" && !answered(r));
  const skipped = rows.filter((r) => !r.include);

  return (
    <Dialog
      icon="File"
      iconTone="blue"
      title={`Periksa ${state.file}`}
      description="Langkah 2 dari 2 · Perbaiki baris yang bermasalah atau lewati. Tamu hanya ditambahkan ke daftar, belum dikirimi undangan."
      form
      xl
      onClose={onClose}
      danger={
        <Button style="tertiary" icon="ArrowLeft" onClick={() => onChange({ step: "upload", rows: [] })}>
          Ganti file
        </Button>
      }
      actions={
        <>
          <Button
            icon="UserPlus"
            disabled={blocking.length > 0 || ready.length + resend.length === 0}
            onClick={() =>
              onConfirm(
                ready.map((r) => ({ name: r.name.trim(), phone: normalizePhone(r.phone)! })),
                resend.map((r) => existing.get(normalizePhone(r.phone)!)!.id),
              )
            }
          >
            {blocking.length ? `${blocking.length} baris perlu diperbaiki` : `Tambahkan ${ready.length} tamu`}
          </Button>
          <Button style="tertiary" onClick={onClose}>
            Batal
          </Button>
        </>
      }
    >
      <div className="csv-summary">
        <Badge type="claimed">{ready.length} siap ditambahkan</Badge>
        {blocking.length > 0 && <Badge type="danger" icon="Close">{blocking.length} perlu diperbaiki</Badge>}
        {resend.length > 0 && <Badge type="neutral" icon="Send">{resend.length} diundang ulang</Badge>}
        {skipped.length > 0 && <Badge type="done">{skipped.length} dilewati</Badge>}
      </div>
      <div className="csv-review">
        <DataTable
          columns={[
            { label: "Baris", width: "56px" },
            { label: "Nama", width: "minmax(0, 1fr)" },
            { label: "Nomor WA", width: "minmax(0, 1fr)" },
            { label: "Hasil cek", width: "minmax(0, 1.2fr)" },
            { label: "Aksi", width: "130px", align: "end" },
          ]}
          rows={rows.map((r, i) => {
            const issue = issues[i];
            const dupOf = issue === "duplikat" ? rows.find((o) => o.include && normalizePhone(o.phone) === normalizePhone(r.phone))?.line : undefined;
            const who = issue === "terdaftar" ? existing.get(normalizePhone(r.phone)!) : undefined;
            return {
              id: String(r.line),
              cells: [
                <span className="t-p-h5 admin-muted">{r.line}</span>,
                <input
                  className={`cell-input t-p-h5${r.include && issue === "nama" ? " has-error" : ""}`}
                  value={r.name}
                  placeholder="Isi nama"
                  disabled={!r.include}
                  aria-label={`Nama baris ${r.line}`}
                  onChange={(e) => set(r.line, { name: e.target.value })}
                />,
                <input
                  className={`cell-input t-p-h5${r.include && issue === "nomor" ? " has-error" : ""}`}
                  value={r.phone}
                  placeholder="08…"
                  inputMode="tel"
                  disabled={!r.include}
                  aria-label={`Nomor WA baris ${r.line}`}
                  onChange={(e) => set(r.line, { phone: e.target.value })}
                />,
                !r.include ? (
                  <Badge type="done">Dilewati</Badge>
                ) : issue === "ok" ? (
                  <Badge type="claimed">Siap</Badge>
                ) : (
                  <span className="invite-status">
                    <Badge type={ISSUE[issue].type} icon={ISSUE[issue].type === "danger" ? "Close" : undefined}>
                      {ISSUE[issue].tag}
                    </Badge>
                    <span className="t-p-h5 admin-muted">
                      {issue === "duplikat" ? `Sama dengan baris ${dupOf}` : issue === "terdaftar" ? (answered(r) ? `${who?.name} sudah jawab RSVP · tidak dikirim lagi` : `${who?.name} sudah ada · diundang ulang`) : issue === "nomor" ? "Contoh: 081234567890" : "Wajib diisi"}
                    </span>
                  </span>
                ),
                r.include ? (
                  <Button size="small" style="tertiary" onClick={() => set(r.line, { include: false })}>
                    Lewati
                  </Button>
                ) : (
                  <Button size="small" style="tertiary" onClick={() => set(r.line, { include: true })}>
                    Sertakan
                  </Button>
                ),
              ],
            };
          })}
        />
      </div>
    </Dialog>
  );
}
