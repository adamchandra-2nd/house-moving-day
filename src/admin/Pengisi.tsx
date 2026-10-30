import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { formatTime } from "../data/agenda";
import { SCRIPTS, type Person, type ScriptPart } from "../stage/data";
import { adminApi, stageLink, waLink, type PersonAccess } from "./api";
import type { AdminEvent } from "./data";
import { normalizePhone } from "./invite";
import { DataTable, Empty, Panel, RowMenu } from "./ui";

export type Access = PersonAccess;
const ACCESS: Record<Access, { label: string; type: "done" | "neutral" | "claimed" | "danger"; icon?: "Check" | "Send" | "Close" }> = {
  belum: { label: "Belum diundang", type: "done" },
  terkirim: { label: "Link terkirim", type: "neutral", icon: "Send" },
  masuk: { label: "Sudah masuk", type: "claimed", icon: "Check" },
  dicabut: { label: "Dicabut", type: "danger", icon: "Close" },
};

type Props = {
  /** Live: from GET /api/admin/people. Review cases: the bundled sample. */
  people: Person[];
  /** The rundown: the sessions a speaker is on, and the ones the MC scripts. */
  events: AdminEvent[];
  /** Live: each person's `access` from the server. Review cases: the sample map. */
  access: Record<string, Access>;
  scripts: Record<string, ScriptPart[]>;
  /**
   * Live: "Kirim link" opens WhatsApp with the personal link typed, and the
   * committee can add, edit and remove people. Review cases keep the
   * simulated send and the fixed list.
   */
  live?: boolean;
  initialEdit?: string;
  onSend: (id: string) => void;
  onRevoke: (id: string) => void;
  /** Live: turn a revoked link back on. */
  onRestore?: (id: string) => void;
  /** Live: the link went out by hand ("Salin"), which counts as sent. */
  onInvited?: (id: string) => void;
  onSaveScript: (sessionId: string, parts: ScriptPart[] | null) => void;
  /** Resolves once the server has it; the editor stays open on a refusal. */
  onSavePerson?: (p: Person | Omit<Person, "id">) => Promise<void>;
  onDeletePerson?: (id: string) => Promise<void>;
  onCopied?: (what: string) => void;
};

/** Scripts are suggestions for the sessions they were written for; any other session starts blank. */
const suggested = (id: string): ScriptPart[] => SCRIPTS[id]?.[0] ?? [];

const firstOf = (name: string) => name.split(" ")[0];

/** The WhatsApp message: who they are on the day, and the link to their screen. */
const inviteText = (p: Person) =>
  `Halo ${firstOf(p.name)}! Kamu jadi ${p.role === "mc" ? "MC" : "pembicara"} di House Moving Day.\n\nBuka layarmu di sini:\n${stageLink(p)}\n\nMasukkan kode panggung yang dikirim panitia saat diminta.`;

/** The server's built-in STAGE_CODE: it is in the repo, so it should be changed before the event. */
const DEFAULT_STAGE_CODE = "246810";

/**
 * The stage code, in a message of its own: a forwarded link alone does not
 * get anyone in. Nothing sends it automatically -- the committee sends this.
 */
const codeText = (p: Person, code: string) =>
  `Halo ${firstOf(p.name)}! Ini kode panggung untuk masuk ke layar ${p.role === "mc" ? "MC" : "pembicara"} House Moving Day:

${code}

Masukkan kode ini setelah membuka link dari panitia. Jangan dibagikan ke orang lain ya.`;

/** MC and speakers (may be from outside Potara): personal WhatsApp link + code, no account. */
export function Pengisi({ people, events, access, scripts, live, initialEdit, onSend, onRevoke, onRestore, onInvited, onSaveScript, onSavePerson, onDeletePerson, onCopied }: Props) {
  const sessions = [...events].sort((a, b) => a.start - b.start);
  const [editing, setEditing] = useState<AdminEvent | null>(() => events.find((x) => x.id === initialEdit) ?? null);
  const [sending, setSending] = useState<Person | null>(null);
  const [revoking, setRevoking] = useState<Person | null>(null);
  /** null: closed. `{}`: adding someone new. */
  const [person, setPerson] = useState<Partial<Person> | null>(null);
  // Fetched up front: wa.me has to open inside the click, or a popup blocker eats it.
  const [stageCode, setStageCode] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    let on = true;
    adminApi
      .stageCode()
      .then((r) => on && setStageCode(r.code))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [live]);
  const sessionsOf = (p: Person) =>
    p.role === "mc"
      ? "Semua sesi"
      : sessions
          .filter((s) => s.speakerId === p.id)
          .map((s) => `${s.title} · ${formatTime(s.start)}`)
          .join(", ") || "Belum ada sesi";

  const copy = (p: Person) => {
    // Either way the link has left this screen, so the server hears it was sent.
    const manual = () => window.prompt("Salin link ini:", stageLink(p));
    const done = () => onInvited?.(p.id);
    if (!navigator.clipboard) {
      manual();
      return done();
    }
    void navigator.clipboard
      .writeText(stageLink(p))
      .then(() => onCopied?.(`Link ${firstOf(p.name)}`))
      .catch(manual)
      .finally(done);
  };

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Pengisi acara</h1>
          <p className="t-p-h4 admin-sub">MC dan pembicara masuk lewat link pribadi di WhatsApp, lalu kode 6 angka. Tidak perlu akun.</p>
          {stageCode && (
            <p className="t-p-h5 admin-muted">
              Kode panggung: <strong>{stageCode}</strong> · kirim ke mereka lewat ⋯ → Kirim kode
              {stageCode === DEFAULT_STAGE_CODE && " · masih kode bawaan, ganti STAGE_CODE di server sebelum acara"}
            </p>
          )}
        </div>
      </div>

      <div className="admin-fill pengisi-fill">
        <Panel
          icon="Sparkle"
          tone="sky"
          title={`MC & pembicara · ${people.length}`}
          aside={
            live && onSavePerson ? (
              <Button size="small" style="tertiary" icon="UserPlus" onClick={() => setPerson({ role: "pembicara" })}>
                Tambah
              </Button>
            ) : undefined
          }
          flush
        >
          <DataTable
            columns={[
              { label: "Nama & sesi", width: "minmax(200px, 1fr)" },
              { label: "Peran", width: "136px" },
              { label: "Akses", width: "168px" },
              // One main action and a "⋮" menu: four buttons per row crushed
              // the name down to an initial and cut the access status off.
              { label: "Aksi", width: "220px", align: "end" },
            ]}
            empty={<Empty icon="Sparkle" tone="sky" title="Belum ada MC atau pembicara" body="Tambahkan dulu, lalu kirim link pribadinya lewat WhatsApp." />}
            rows={people.map((p) => {
              const a = access[p.id] ?? "belum";
              return {
                id: p.id,
                cells: [
                  <span className="admin-cell-name">
                    <Avatar initial={p.name.charAt(0)} size="S" />
                    <span className="admin-cell-name__text">
                      <span className="t-p-h4-bold">{p.name}</span>
                      <span className="t-p-h5 admin-muted one-line">
                        {sessionsOf(p)} · {p.phone || "Tanpa nomor"}
                      </span>
                    </span>
                  </span>,
                  <Badge type="ready" icon={p.role === "mc" ? "Megaphone" : "Sparkle"}>
                    {p.role === "mc" ? "MC" : "Pembicara"}
                  </Badge>,
                  <Badge type={ACCESS[a].type} icon={ACCESS[a].icon}>
                    {ACCESS[a].label}
                  </Badge>,
                  <span className="pengisi-actions">
                    {/* A revoked link is turned back on first: sending it again would only reach a closed door. */}
                    {a === "dicabut" && live && onRestore ? (
                      <Button size="small" style="tertiary" icon="Lock" onClick={() => onRestore(p.id)}>
                        Pulihkan akses
                      </Button>
                    ) : (
                      <Button size="small" style="tertiary" icon="Send" disabled={live && !normalizePhone(p.phone)} onClick={() => setSending(p)}>
                        {a === "belum" ? "Kirim link" : "Kirim ulang"}
                      </Button>
                    )}
                    <RowMenu
                      label={`Aksi lain untuk ${p.name}`}
                      items={[
                        ...(live ? [{ label: "Ubah", icon: "Pencil" as const, onSelect: () => setPerson(p) }] : []),
                        ...(live && a !== "dicabut" && stageCode && normalizePhone(p.phone)
                          ? [{ label: "Kirim kode", icon: "Lock" as const, onSelect: () => window.open(waLink(p.phone, codeText(p, stageCode)), "_blank", "noopener") }]
                          : []),
                        ...(live && a !== "dicabut" ? [{ label: "Salin link", icon: "Copy" as const, onSelect: () => copy(p) }] : []),
                        ...(a !== "dicabut" && a !== "belum" ? [{ label: "Cabut akses", icon: "Close" as const, danger: true, onSelect: () => setRevoking(p) }] : []),
                      ]}
                    />
                  </span>,
                ],
              };
            })}
          />
        </Panel>

        <Panel icon="Pencil" tone="ink" title="Naskah MC">
          <span className="t-p-h5 admin-muted">Disusun Claude dari rundown, tampil di layar MC per sesi. Klik untuk mengubah.</span>
          {sessions.length === 0 ? (
            <Empty icon="Calendar" tone="slate" title="Rundown masih kosong" body="Tambah sesi di menu Rundown, naskahnya muncul di sini." />
          ) : (
            <ul className="naskah-list">
              {sessions.map((s) => (
                <li key={s.id} className="naskah-item is-clickable" role="button" tabIndex={0} onClick={() => setEditing(s)} onKeyDown={(e) => e.key === "Enter" && setEditing(s)}>
                  <span className="t-p-h5-bold admin-muted">{formatTime(s.start)}</span>
                  <span className="naskah-item__text">
                    <span className="t-p-h4-bold">{s.title}</span>
                    <span className="t-p-h5 admin-muted">
                      {(scripts[s.id] ?? suggested(s.id)).length} baris{s.pic ? ` · PIC ${s.pic}` : ""}
                    </span>
                  </span>
                  {scripts[s.id] ? <Badge type="neutral" icon="Pencil">Diedit</Badge> : SCRIPTS[s.id] ? <Badge type="ready" icon="Sparkle">Claude</Badge> : <Badge type="done">Kosong</Badge>}
                </li>
              ))}
            </ul>
          )}
          <div className="setting-box setting-box--note">
            <Icon name="Eye" size={20} />
            <span className="t-p-h5">
              Lihat seperti mereka: <a href="#mc">layar MC</a> · <a href="#pembicara">layar pembicara</a>
            </span>
          </div>
        </Panel>
      </div>

      {editing && (
        <ScriptEditor
          session={editing}
          value={scripts[editing.id] ?? suggested(editing.id)}
          edited={!!scripts[editing.id]}
          onClose={() => setEditing(null)}
          onSave={(parts) => {
            onSaveScript(editing.id, parts);
            setEditing(null);
          }}
        />
      )}
      {person && onSavePerson && (
        <PersonEditor
          value={person}
          onClose={() => setPerson(null)}
          onSave={async (p) => {
            await onSavePerson(p);
            setPerson(null);
          }}
          onDelete={
            person.id && onDeletePerson
              ? async () => {
                  await onDeletePerson(person.id!);
                  setPerson(null);
                }
              : undefined
          }
        />
      )}
      {sending && (
        <Dialog
          icon="Send"
          iconTone="green"
          title={`Kirim link ke ${firstOf(sending.name)}?`}
          description={
            live
              ? `WhatsApp terbuka dengan pesan berisi link pribadi ${firstOf(sending.name)}, siap dikirim ke ${sending.phone}. Setelah itu kirim kodenya lewat ⋯ → Kirim kode.`
              : `Link pribadi dikirim ke WhatsApp ${sending.phone}. Saat dibuka, ${firstOf(sending.name)} memasukkan kode 6 angka yang kami kirim ke nomor yang sama.`
          }
          onClose={() => setSending(null)}
          actions={
            <>
              <Button
                icon="Send"
                onClick={() => {
                  // Opened inside the click, or a popup blocker eats it.
                  if (live) window.open(waLink(sending.phone, inviteText(sending)), "_blank", "noopener");
                  onSend(sending.id);
                  setSending(null);
                }}
              >
                {live ? "Buka WhatsApp" : "Kirim link"}
              </Button>
              <Button style="tertiary" onClick={() => setSending(null)}>
                Kembali
              </Button>
            </>
          }
        />
      )}
      {revoking && (
        <Dialog
          icon="Lock"
          iconTone="red"
          title={`Cabut akses ${firstOf(revoking.name)}?`}
          description={
            live
              ? "Link langsung tidak berlaku dan layarnya keluar di permintaan berikutnya. Bisa dipulihkan kapan saja."
              : "Link langsung tidak berlaku dan layarnya keluar. Kamu bisa kirim link baru kapan saja."
          }
          onClose={() => setRevoking(null)}
          actions={
            <>
              <Button
                style="danger"
                onClick={() => {
                  onRevoke(revoking.id);
                  setRevoking(null);
                }}
              >
                Cabut akses
              </Button>
              <Button style="tertiary" onClick={() => setRevoking(null)}>
                Kembali
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}

/** Add or edit one MC/speaker. The server mints the id, which is what their link carries. */
function PersonEditor({
  value,
  onClose,
  onSave,
  onDelete,
}: {
  value: Partial<Person>;
  onClose: () => void;
  onSave: (p: Person | Omit<Person, "id">) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(value.name ?? "");
  const [role, setRole] = useState<Person["role"]>(value.role ?? "pembicara");
  const [title, setTitle] = useState(value.title ?? "");
  const [phone, setPhone] = useState(value.phone ?? "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameError = !name.trim() ? "Nama wajib diisi." : null;
  const phoneError = !normalizePhone(phone) ? "Nomor WhatsApp belum benar, contoh 0812 3456 7890." : null;

  /** Keeps the dialog open on a refusal, with the server's reason under the fields. */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan. Coba lagi.");
      setBusy(false);
    }
  };

  const save = () => {
    setTried(true);
    if (nameError || phoneError) return;
    const p = { name: name.trim(), role, title: title.trim(), phone: normalizePhone(phone)! };
    void run(() => onSave(value.id ? { ...p, id: value.id } : p));
  };

  if (confirmDelete && onDelete)
    return (
      <Dialog
        icon="Trash"
        iconTone="red"
        title={`Hapus ${firstOf(value.name ?? "")}?`}
        description="Linknya langsung tidak berlaku, dan sesinya di rundown jadi tanpa pembicara."
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button style="danger" disabled={busy} onClick={() => void run(onDelete)}>
              Hapus
            </Button>
            <Button style="tertiary" onClick={() => setConfirmDelete(false)}>
              Kembali
            </Button>
          </>
        }
      >
        {error && (
          <span className="t-p-h5 field__hint field__hint--error" role="alert">
            {error}
          </span>
        )}
      </Dialog>
    );

  return (
    <Dialog
      form
      icon={value.id ? "Pencil" : "UserPlus"}
      iconTone="sky"
      title={value.id ? `Ubah ${firstOf(value.name ?? "")}` : "Tambah MC / pembicara"}
      description="Link pribadinya dikirim ke nomor WhatsApp ini."
      onClose={onClose}
      danger={
        onDelete ? (
          <Button style="tertiary" icon="Trash" onClick={() => setConfirmDelete(true)}>
            Hapus
          </Button>
        ) : undefined
      }
      actions={
        <>
          <Button disabled={busy} onClick={save}>
            {busy ? "Menyimpan…" : value.id ? "Simpan" : "Tambah"}
          </Button>
          <Button style="tertiary" onClick={onClose}>
            Batal
          </Button>
        </>
      }
    >
      <TextField label="Nama" value={name} onChange={setName} placeholder="Nama lengkap" maxLength={60} error={tried ? (nameError ?? undefined) : undefined} autoFocus />
      <div className="field">
        <span className="t-p-h5-bold field__label">Peran</span>
        {/* The same pills as the Feedback tabs: the chosen one is filled, which
            the dashed token chips used here before never showed. */}
        <div className="pill-tabs" role="radiogroup" aria-label="Peran">
          {(["mc", "pembicara"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              className={`pill-tab t-p-h5-bold${role === r ? " is-active clay clay-dark" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => setRole(r)}
            >
              {role === r && <Icon name="Check" size={16} />}
              {r === "mc" ? "MC" : "Pembicara"}
            </button>
          ))}
        </div>
      </div>
      <TextField label="Jabatan (opsional)" value={title} onChange={setTitle} placeholder="Contoh: Head of Design, Potara" maxLength={60} />
      <TextField label="Nomor WhatsApp" value={phone} onChange={setPhone} inputMode="tel" placeholder="0812 3456 7890" error={tried ? (phoneError ?? undefined) : undefined} />
      {error && (
        <span className="t-p-h5 field__hint field__hint--error" role="alert">
          {error}
        </span>
      )}
    </Dialog>
  );
}

const LABELS: ScriptPart["label"][] = ["Pembuka", "Poin", "Transisi", "Penutup"];

/** Edit the MC script for one session. Saving pushes it straight to the MC's screen. */
function ScriptEditor({ session, value, edited, onClose, onSave }: { session: AdminEvent; value: ScriptPart[]; edited: boolean; onClose: () => void; onSave: (parts: ScriptPart[] | null) => void }) {
  const [parts, setParts] = useState<ScriptPart[]>(value);
  const [tried, setTried] = useState(false);
  const set = (i: number, patch: Partial<ScriptPart>) => setParts(parts.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const empty = parts.some((p) => !p.text.trim()) || parts.length === 0;
  const suggestion = suggested(session.id);

  return (
    <Dialog
      form
      wide
      icon="Pencil"
      iconTone="ink"
      title={`Naskah MC · ${session.title}`}
      description="Tampil di layar MC saat sesi ini berjalan. Perubahan langsung terkirim begitu disimpan."
      onClose={onClose}
      danger={
        // Only where there is a suggestion to go back to: a session added on the day has none.
        suggestion.length > 0 || edited ? (
          <Button style="tertiary" icon="Sparkle" disabled={!edited && JSON.stringify(parts) === JSON.stringify(suggestion)} onClick={() => (edited ? onSave(null) : setParts(suggestion))}>
            {suggestion.length ? "Pakai saran Claude" : "Kosongkan naskah"}
          </Button>
        ) : undefined
      }
      actions={
        <>
          <Button
            onClick={() => {
              setTried(true);
              if (!empty) onSave(parts.map((p) => ({ ...p, text: p.text.trim() })));
            }}
          >
            Simpan naskah
          </Button>
          <Button style="tertiary" onClick={onClose}>
            Batal
          </Button>
        </>
      }
    >
      <ol className="script-edit">
        {parts.map((p, i) => (
          <li key={i} className="script-edit__item">
            <div className="script-edit__labels" role="radiogroup" aria-label={`Jenis baris ${i + 1}`}>
              {LABELS.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={p.label === l} className={`token-chip script-edit__label t-p-h5-bold${p.label === l ? " is-active" : ""}`} onClick={() => set(i, { label: l })}>
                  {l}
                </button>
              ))}
              <button type="button" className="icon-btn clay clay-light script-edit__del" aria-label={`Hapus baris ${i + 1}`} onClick={() => setParts(parts.filter((_, k) => k !== i))}>
                <Icon name="Trash" size={16} />
              </button>
            </div>
            <textarea
              className={`field__input field__input--multiline t-p-h4${tried && !p.text.trim() ? " is-error" : ""}`}
              value={p.text}
              rows={2}
              maxLength={240}
              placeholder="Tulis yang perlu disampaikan MC…"
              onChange={(e) => set(i, { text: e.target.value })}
            />
          </li>
        ))}
      </ol>
      {tried && empty && <span className="t-p-h5 field__hint field__hint--error">{parts.length ? "Ada baris yang masih kosong." : "Tambah minimal satu baris."}</span>}
      <Button style="tertiary" icon="Plus" onClick={() => setParts([...parts, { label: "Poin", text: "" }])}>
        Tambah baris
      </Button>
    </Dialog>
  );
}
