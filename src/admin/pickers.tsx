import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ROOMS } from "../data/rooms";
import { roomStyle } from "./hooks";
import "./pickers.css";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const pad = (n: number) => String(n).padStart(2, "0");
const formatDateLabel = (d: Date) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

/** Date picker in the design-system style (not the browser's). Past days are disabled. */
export function DatePicker({ label, value, today, onChange }: { label: string; value: Date; today: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const [pick, setPick] = useState(value);
  const ref = useOutside(open, () => setOpen(false));
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const past = (d: Date) => d < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="field picker" ref={ref}>
      <span className="t-p-h5-bold field__label">{label}</span>
      <button type="button" className="field__input picker__field t-p-h3-bold" onClick={() => setOpen(!open)} aria-expanded={open}>
        {formatDateLabel(value)}
        <Icon name="Calendar" size={20} />
      </button>
      {open && (
        <div className="picker__pop clay clay-light" role="dialog" aria-label="Pilih tanggal">
          <div className="picker__month">
            <button type="button" className="icon-btn clay clay-light" aria-label="Bulan sebelumnya" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              <Icon name="ChevronLeft" size={20} />
            </button>
            <span className="t-p-h4-bold">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>
            <button type="button" className="icon-btn clay clay-light" aria-label="Bulan berikutnya" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              <Icon name="ChevronRight" size={20} />
            </button>
          </div>
          <div className="picker__grid">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <span key={d} className="t-p-h5-bold picker__dow">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`x${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const d = new Date(view.getFullYear(), view.getMonth(), i + 1);
              const sel = same(d, pick);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={past(d)}
                  className={`picker__day t-p-h4-bold${sel ? " is-selected clay clay-accent" : ""}${same(d, today) ? " is-today" : ""}`}
                  onClick={() => setPick(d)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="picker__actions">
            <Button size="small" style="tertiary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              size="small"
              onClick={() => {
                onChange(pick);
                setOpen(false);
              }}
            >
              Pilih
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 24-hour time picker (minutes in 5-minute steps), so it never shows AM/PM. */
export function TimePicker({ label, value, onChange, error, min = 7 * 60, max = 22 * 60 }: { label: string; value: number; onChange: (m: number) => void; error?: boolean; min?: number; max?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const h = Math.floor(value / 60);
  const m = value % 60;
  const hours = Array.from({ length: Math.floor(max / 60) - Math.floor(min / 60) + 1 }, (_, i) => Math.floor(min / 60) + i);
  const mins = Array.from({ length: 12 }, (_, i) => i * 5);
  return (
    <div className="field picker" ref={ref}>
      <span className="t-p-h5-bold field__label">{label}</span>
      <button type="button" className={`field__input picker__field t-p-h3-bold${error ? " is-error" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {pad(h)}.{pad(m)}
        <Icon name="Clock" size={20} />
      </button>
      {open && (
        <div className="picker__pop picker__pop--time clay clay-light" role="dialog" aria-label={`Pilih ${label.toLowerCase()}`}>
          <div className="picker__cols">
            <div className="picker__col scroll-fade" aria-label="Jam">
              {hours.map((x) => (
                <button key={x} type="button" className={`picker__opt t-p-h4-bold${x === h ? " is-selected clay clay-accent" : ""}`} onClick={() => onChange(x * 60 + m)}>
                  {pad(x)}
                </button>
              ))}
            </div>
            <div className="picker__col scroll-fade" aria-label="Menit">
              {mins.map((x) => (
                <button key={x} type="button" className={`picker__opt t-p-h4-bold${x === m ? " is-selected clay clay-accent" : ""}`} onClick={() => onChange(h * 60 + x)}>
                  {pad(x)}
                </button>
              ))}
            </div>
          </div>
          <Button block size="small" style="secondary" onClick={() => setOpen(false)}>
            Selesai
          </Button>
        </div>
      )}
    </div>
  );
}

export type Place = { name: string; address: string };
const PLACES: Place[] = [
  { name: "Kantor baru Potara", address: "Jl. Kemang Raya No. 18, Bangka, Mampang Prapatan, Jakarta Selatan" },
  { name: "Potara Studio (lama)", address: "Jl. Cipete Raya No. 7, Cipete Selatan, Cilandak, Jakarta Selatan" },
  { name: "Kemang Village", address: "Jl. Pangeran Antasari No. 36, Bangka, Jakarta Selatan" },
  { name: "Plaza Kemang 88", address: "Jl. Kemang Raya No. 88, Bangka, Jakarta Selatan" },
];

/** Place search styled like Google Maps autocomplete. Prototype uses sample places; plug in Google Places later. */
export function PlacePicker({ label, value, onChange, offline }: { label: string; value: Place | null; onChange: (p: Place | null) => void; offline?: boolean }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const results = q.trim().length < 2 ? [] : PLACES.filter((p) => (p.name + p.address).toLowerCase().includes(q.trim().toLowerCase()));

  if (value) {
    return (
      <div className="field">
        <span className="t-p-h5-bold field__label">{label}</span>
        <div className="place-card">
          <div className="place-card__map" aria-hidden="true">
            <span className="place-card__road place-card__road--a" />
            <span className="place-card__road place-card__road--b" />
            <span className="place-card__pin clay clay-accent">
              <Icon name="MapPin" size={20} />
            </span>
          </div>
          <div className="place-card__text">
            <span className="t-p-h4-bold">{value.name}</span>
            <span className="t-p-h5 admin-muted">{value.address}</span>
          </div>
          <div className="place-card__actions">
            <a className="btn btn--tertiary btn--small clay clay-light t-p-h4-bold" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.address)}`} target="_blank" rel="noreferrer">
              <span>Buka di Google Maps</span>
            </a>
            <Button size="small" style="tertiary" icon="Pencil" onClick={() => onChange(null)}>
              Ganti
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="field picker">
      <span className="t-p-h5-bold field__label">{label}</span>
      <label className="field__input picker__field picker__search">
        <Icon name="MapPin" size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => window.setTimeout(() => setFocus(false), 150)}
          placeholder="Cari nama gedung atau jalan…"
          className="t-p-h4"
          autoFocus
        />
      </label>
      {focus && q.trim().length >= 2 && (
        <div className="picker__pop clay clay-light" role="listbox">
          {offline ? (
            <span className="t-p-h5 field__hint field__hint--error">Gagal memuat saran lokasi. Cek koneksi.</span>
          ) : results.length === 0 ? (
            <span className="t-p-h5 admin-muted">Lokasi tidak ditemukan. Coba nama jalan atau gedung.</span>
          ) : (
            results.map((p) => (
              <button key={p.name} type="button" role="option" className="place-opt" onMouseDown={() => onChange(p)}>
                <Icon name="MapPin" size={20} />
                <span className="place-opt__text">
                  <span className="t-p-h4-bold">{p.name}</span>
                  <span className="t-p-h5 admin-muted">{p.address}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <span className="t-p-h5 field__hint">Tamu bisa membuka lokasi ini di Google Maps.</span>
    </div>
  );
}

/** Room dropdown: coloured clay room icon + name. `optional` adds an empty choice and a clear button. */
export function RoomPicker({ label, value, onChange, optional, emptyLabel = "Tidak ada", hint }: { label: string; value: string | null; onChange: (id: string | null) => void; optional?: boolean; emptyLabel?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const room = ROOMS.find((r) => r.id === value);
  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };
  return (
    <div className="field picker" ref={ref}>
      <span className="t-p-h5-bold field__label">{label}</span>
      <div className="room-select">
        <button type="button" className="field__input picker__field room-select__field" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
          {room ? (
            <span className="room-opt__main">
              <RoomIcon id={room.id} />
              <span className="t-p-h4-bold">{room.name}</span>
            </span>
          ) : (
            <span className="t-p-h4 admin-muted">{emptyLabel}</span>
          )}
          <Icon name="ChevronRight" size={20} className={`room-select__chev${open ? " is-open" : ""}`} />
        </button>
        {optional && room && (
          <button type="button" className="room-select__clear" aria-label="Kosongkan ruangan" onClick={() => onChange(null)}>
            <Icon name="Close" size={16} />
          </button>
        )}
      </div>
      {open && (
        <div className="picker__pop room-select__pop clay clay-light" role="listbox">
          {optional && (
            <button type="button" role="option" aria-selected={!value} className={`room-opt${!value ? " is-active" : ""}`} onClick={() => choose(null)}>
              <span className="room-opt__main">
                <span className="room-icon room-icon--empty clay clay-light">
                  <Icon name="Close" size={16} />
                </span>
                <span className="t-p-h4">{emptyLabel}</span>
              </span>
              {!value && <Icon name="Check" size={20} />}
            </button>
          )}
          {ROOMS.map((r) => (
            <button key={r.id} type="button" role="option" aria-selected={r.id === value} className={`room-opt${r.id === value ? " is-active" : ""}`} onClick={() => choose(r.id)}>
              <span className="room-opt__main">
                <RoomIcon id={r.id} />
                <span className="t-p-h4-bold">{r.name}</span>
              </span>
              {r.id === value && <Icon name="Check" size={20} />}
            </button>
          ))}
        </div>
      )}
      {hint && <span className="t-p-h5 field__hint">{hint}</span>}
    </div>
  );
}

function RoomIcon({ id }: { id: string }) {
  const r = ROOMS.find((x) => x.id === id)!;
  return (
    <span className="room-icon clay clay-accent" style={roomStyle(id)}>
      <Icon name={r.icon} size={16} />
    </span>
  );
}
