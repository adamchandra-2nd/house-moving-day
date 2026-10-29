import { useState } from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { IconBadge } from "../components/IconBadge";
import { TextField } from "../components/TextField";
import { Toggle } from "../components/Toggle";
import { formatTime } from "../data/agenda";
import { DatePicker, PlacePicker, TimePicker, type Place } from "./pickers";
import { CodeBoxes } from "./Rewards";
import { Panel } from "./ui";

export type AdminSettings = {
  eventName: string;
  date: Date;
  place: Place | null;
  doorCode: string;
  panitiaPin: string;
  countdown: boolean;
  /** Minutes since 00:00. */
  finalFeedbackAt: number;
  codesChangedAt: number;
};

type Props = { settings: AdminSettings; today: Date; onSave: (s: AdminSettings) => void; onCopied: (what: string) => void };

/** Event settings: Akses (codes) is the ink hero; unsaved changes show a sticky save bar. */
export function Settings({ settings, today, onSave, onCopied }: Props) {
  const [s, setS] = useState(settings);
  const [tried, setTried] = useState(false);
  const [show, setShow] = useState({ door: true, pin: false });
  const [changing, setChanging] = useState<"doorCode" | "panitiaPin" | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const set = (patch: Partial<AdminSettings>) => setS({ ...s, ...patch });
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const nameError = !s.eventName.trim() ? "Nama acara wajib diisi." : undefined;
  const placeError = !s.place ? "Pilih lokasi acara." : undefined;

  const save = () => {
    setTried(true);
    if (!nameError && !placeError) onSave(s);
  };
  const copy = (code: string, what: string) => {
    navigator.clipboard?.writeText(code).catch(() => undefined);
    onCopied(what);
  };

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Pengaturan</h1>
          <p className="t-p-h4 admin-sub">Berlaku langsung di HP semua tamu setelah disimpan.</p>
        </div>
      </div>

      <div className="admin-fill settings-fill">
        <Panel icon="Calendar" tone="teal" title="Data acara">
          <TextField label="Nama acara" value={s.eventName} onChange={(v) => set({ eventName: v })} error={tried ? nameError : undefined} />
          <DatePicker label="Tanggal" value={s.date} today={today} onChange={(d) => set({ date: d })} />
          <PlacePicker label="Tempat" value={s.place} onChange={(p) => set({ place: p })} />
          {tried && placeError && <span className="t-p-h5 field__hint field__hint--error">{placeError}</span>}
        </Panel>

        <section className="admin-panel akses-hero clay clay-dark">
          <header className="admin-panel__head">
            <span className="icon-badge icon-badge--orange icon-badge--S clay clay-accent">
              <Icon name="Lock" size={16} />
            </span>
            <h2 className="t-p-h3-bold admin-panel__title">Akses</h2>
          </header>
          <div className="admin-panel__body scroll-fade">
            {(
              [
                { key: "doorCode", label: "Kode pintu", note: "Tertempel di bawah QR pintu masuk.", shown: show.door, toggle: () => setShow({ ...show, door: !show.door }) },
                { key: "panitiaPin", label: "PIN panitia", note: "Untuk menandai hadiah diambil di HP tamu.", shown: show.pin, toggle: () => setShow({ ...show, pin: !show.pin }) },
              ] as const
            ).map((c) => (
              <div key={c.key} className="akses-code">
                <span className="akses-code__label">
                  <span className="t-p-h4-bold">{c.label}</span>
                  <span className="t-p-h5 akses-hero__note">{c.note}</span>
                </span>
                <CodeBoxes code={s[c.key]} hidden={!c.shown} />
                <div className="akses-hero__actions">
                  <Button size="small" style="tertiary" icon="Eye" onClick={c.toggle}>
                    {c.shown ? "Sembunyi" : "Tampilkan"}
                  </Button>
                  <Button size="small" style="tertiary" icon="Copy" onClick={() => copy(s[c.key], c.label)}>
                    Salin
                  </Button>
                  <Button
                    size="small"
                    icon="Pencil"
                    onClick={() => {
                      setDraftCode("");
                      setChanging(c.key);
                    }}
                  >
                    Ganti
                  </Button>
                </div>
              </div>
            ))}
            <span className="t-p-h5 akses-hero__note">Terakhir diganti {formatTime(s.codesChangedAt)} oleh Admin.</span>
          </div>
        </section>

        <Panel icon="Sliders" tone="slate" title="Mode acara">
          <div className="setting-box clay clay-light">
            <IconBadge icon="Clock" tone="teal" size="S" />
            <Toggle orange label="Countdown sebelum hari H" hint="Matikan saat Test Day." checked={s.countdown} onChange={(v) => set({ countdown: v })} />
          </div>
          <TimePicker label="Feedback akhir dibuka jam" value={s.finalFeedbackAt} onChange={(m) => set({ finalFeedbackAt: m })} />
          <span className="t-p-h5 field__hint">Sebelum jam ini, tab Feedback di HP tamu terkunci.</span>
        </Panel>
      </div>

      {dirty && (
        <div className="settings-bar clay clay-dark" role="status">
          <span className="t-p-h4-bold">Ada perubahan yang belum disimpan</span>
          <div className="admin-actions">
            <Button
              size="small"
              style="tertiary"
              onClick={() => {
                setS(settings);
                setTried(false);
              }}
            >
              Batalkan
            </Button>
            <Button size="small" onClick={save}>
              Simpan
            </Button>
          </div>
        </div>
      )}

      {changing && (
        <Dialog
          form
          icon="Lock"
          iconTone="orange"
          title={changing === "doorCode" ? "Ganti kode pintu" : "Ganti PIN panitia"}
          description={changing === "doorCode" ? "Ganti juga kode yang tertempel di pintu masuk." : "Kabari semua panitia di meja hadiah."}
          onClose={() => setChanging(null)}
          actions={
            <>
              <Button
                disabled={draftCode.length !== 4}
                onClick={() => {
                  set({ [changing]: draftCode, codesChangedAt: s.codesChangedAt } as Partial<AdminSettings>);
                  setChanging(null);
                }}
              >
                Terapkan
              </Button>
              <Button style="tertiary" onClick={() => setChanging(null)}>
                Batal
              </Button>
            </>
          }
        >
          <TextField label="Kode baru (4 angka)" value={draftCode} onChange={(v) => setDraftCode(v.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0000" autoFocus />
        </Dialog>
      )}
    </div>
  );
}
