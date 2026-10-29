import { useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { Toggle } from "../components/Toggle";
import { DAY_END, DAY_START, formatTime, statusAt, type AgendaStatus } from "../data/agenda";
import { ROOMS } from "../data/rooms";
import type { AdminEvent } from "./data";
import type { Phase } from "./Dashboard";
import { RoomPicker, TimePicker } from "./pickers";
import { roomStyle, useHeight } from "./hooks";
import { LiveTimer } from "./ui";
import type { Person } from "../stage/data";

const SNAP = 5;
const MIN_DURATION = 15;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

type Drag = { id: string; mode: "move" | "resize"; x: number; y: number; start: number; end: number; room: number; moved: boolean };

type Props = {
  events: AdminEvent[];
  now: number;
  phase: Phase;
  /** Review cases: open with a draft already changed / an event open in the editor. */
  initialDraft?: AdminEvent[];
  initialEditId?: string;
  /** Who can be picked as a session's speaker: live, the API's list; review cases, the sample. */
  people: Person[];
  onSave: (events: AdminEvent[], notify: boolean) => void;
};

const roomIndex = (id: string) => ROOMS.findIndex((r) => r.id === id);
const snap = (m: number) => Math.round(m / SNAP) * SNAP;

function conflicts(events: AdminEvent[]) {
  const out: [AdminEvent, AdminEvent][] = [];
  events.forEach((a, i) =>
    events.slice(i + 1).forEach((b) => {
      if (a.roomId === b.roomId && a.start < b.end && b.start < a.end) out.push([a, b]);
    }),
  );
  return out;
}

/**
 * Rundown editor: one coloured column per room, the whole day fitted to the panel. Drag a card to move it
 * (time and room), drag its bottom edge to change duration, or click it to edit. Changes stay a draft until saved.
 */
export function Rundown({ events, now, phase, initialDraft, initialEditId, people, onSave }: Props) {
  const [draft, setDraft] = useState<AdminEvent[]>(initialDraft ?? events);
  const [editing, setEditing] = useState<AdminEvent | "new" | null>(initialEditId ? (events.find((e) => e.id === initialEditId) ?? null) : null);
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const cols = useRef<HTMLDivElement>(null);
  const [bodyRef, bodyH] = useHeight<HTMLDivElement>();
  const PX = bodyH ? bodyH / (DAY_END - DAY_START) : 1.7;

  const status: Record<string, AgendaStatus> = phase === "pre" ? {} : phase === "ended" ? Object.fromEntries(draft.map((e) => [e.id, "done"])) : statusAt(now);
  const locked = (e: AdminEvent) => status[e.id] === "done";
  const changed = draft.filter((d) => {
    const o = events.find((e) => e.id === d.id);
    return !o || o.start !== d.start || o.end !== d.end || o.roomId !== d.roomId || o.title !== d.title || o.pic !== d.pic || o.speakerId !== d.speakerId;
  });
  const removed = events.filter((e) => !draft.some((d) => d.id === e.id));
  const dirty = changed.length > 0 || removed.length > 0;
  const clashes = conflicts(draft);
  const clashIds = new Set(clashes.flat().map((e) => e.id));
  const sorted = [...draft].sort((a, b) => a.start - b.start);
  const doneCount = sorted.filter((e) => status[e.id] === "done").length;
  const liveEvent = phase === "live" ? sorted.find((e) => status[e.id] === "now") : undefined;

  const update = (id: string, patch: Partial<AdminEvent>) => setDraft((d) => d.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const onPointerDown = (e: React.PointerEvent, ev: AdminEvent, mode: Drag["mode"]) => {
    if (locked(ev)) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: ev.id, mode, x: e.clientX, y: e.clientY, start: ev.start, end: ev.end, room: roomIndex(ev.roomId), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 4 && Math.abs(e.clientX - d.x) < 4) return;
    d.moved = true;
    const dMin = snap(dy / PX);
    if (d.mode === "resize") {
      update(d.id, { end: Math.min(DAY_END, Math.max(d.start + MIN_DURATION, d.end + dMin)) });
      return;
    }
    const dur = d.end - d.start;
    const start = Math.min(DAY_END - dur, Math.max(DAY_START, d.start + dMin));
    let room = d.room;
    const box = cols.current?.getBoundingClientRect();
    if (box) room = Math.min(ROOMS.length - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * ROOMS.length)));
    update(d.id, { start, end: start + dur, roomId: ROOMS[room].id });
  };
  const onPointerUp = (ev: AdminEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setEditing(ev);
  };

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Rundown</h1>
          <p className="t-p-h4 admin-sub">Geser kartu untuk pindah, tarik tepi bawah untuk durasi, klik untuk edit.</p>
        </div>
        <div className="admin-actions">
          {dirty && (
            <Button size="small" style="tertiary" onClick={() => setDraft(events)}>
              Batalkan perubahan
            </Button>
          )}
          <Button size="small" style="secondary" icon="Plus" onClick={() => setEditing("new")}>
            Tambah acara
          </Button>
          <Button size="small" disabled={!dirty || clashes.length > 0} onClick={() => setSaving(true)}>
            Simpan perubahan
          </Button>
        </div>
      </div>

      {/* Progress of the day, as a stepper */}
      <section className="stepper" aria-label="Progres hari ini">
        <span className="stepper__title t-p-h5-bold">
          Progres hari ini
          <span className="admin-muted">
            {doneCount} dari {sorted.length} selesai
          </span>
          {liveEvent && <LiveTimer variant="chip" start={liveEvent.start} end={liveEvent.end} now={now} />}
        </span>
        <ol className="stepper__steps">
          {sorted.map((e, i) => {
            const s = status[e.id] ?? "later";
            return (
              <li key={e.id} className={`stepper__step is-${s}`} style={roomStyle(e.roomId)}>
                <button type="button" className="stepper__btn" onClick={() => setFocus(e.id)} title="Sorot di timeline">
                  <span className={`stepper__mark t-p-h5-bold${s === "now" ? " clay clay-accent" : ""}`}>
                    {s === "done" ? <Icon name="Check" size={16} /> : s === "now" ? <span className="stepper__pulse" /> : i + 1}
                  </span>
                  <span className="stepper__text">
                    <span className="t-p-h5 admin-muted">{formatTime(e.start)}</span>
                    <span className="t-p-h5-bold stepper__name">
                      <span className="room-dot" />
                      {e.title}
                    </span>
                  </span>
                </button>
                {i < sorted.length - 1 && <span className={`stepper__line${s === "done" ? " is-filled" : s === "now" ? " is-half" : ""}`} />}
              </li>
            );
          })}
        </ol>
      </section>

      {(dirty || clashes.length > 0) && (
        <div className={`rundown-banner t-p-h5-bold${clashes.length ? " is-error" : ""}`} role="status">
          <Icon name={clashes.length ? "Close" : "Pencil"} size={16} />
          {clashes.length
            ? `Jadwal bentrok di ${ROOMS[roomIndex(clashes[0][0].roomId)].name}: ${clashes[0][0].title} dan ${clashes[0][1].title}. Geser salah satunya dulu.`
            : `${changed.length + removed.length} perubahan belum disimpan.`}
        </div>
      )}

      <section className="admin-panel rundown">
        <div className="rundown__head">
          <span />
          {ROOMS.map((r) => (
            <span key={r.id} className="rundown__room t-p-h5-bold clay clay-light" style={roomStyle(r.id)}>
              <Icon name={r.icon} size={16} />
              {r.name}
            </span>
          ))}
        </div>
        <div className="rundown__body" ref={bodyRef}>
          {HOURS.map((h) => (
            <div key={h} className="rundown__hour" style={{ top: (h - DAY_START) * PX }}>
              <span className="t-p-h5 rundown__label">{formatTime(h)}</span>
              <span className="rundown__rule" />
            </div>
          ))}
          <div ref={cols} className="rundown__cols">
            {ROOMS.map((r) => (
              <div key={r.id} className="rundown__col" style={roomStyle(r.id)} />
            ))}
            {draft.map((e) => {
              const s = status[e.id] ?? "later";
              const lock = locked(e);
              const col = roomIndex(e.roomId);
              const h = (e.end - e.start) * PX;
              const size = h < 64 ? "is-s" : h < 100 ? "is-m" : "is-l";
              const clash = clashIds.has(e.id);
              const isChanged = changed.some((c) => c.id === e.id);
              const tag = clash ? (
                <Badge type="danger">Bentrok</Badge>
              ) : isChanged ? (
                <Badge type="neutral" icon="Pencil">Diubah</Badge>
              ) : s === "now" ? (
                <Badge type="now">Sekarang</Badge>
              ) : s === "next" ? (
                <Badge type="next" icon="Clock">Berikutnya</Badge>
              ) : s === "done" ? (
                <Badge type="done">Selesai</Badge>
              ) : null;
              return (
                <article
                  key={e.id}
                  className={`rundown__event clay clay-light is-${s} ${size}${clash ? " is-clash" : ""}${lock ? " is-locked" : ""}${focus === e.id ? " is-focus" : ""}`}
                  style={{
                    ...roomStyle(e.roomId),
                    top: (e.start - DAY_START) * PX,
                    height: h,
                    left: `calc(${(col / ROOMS.length) * 100}% + 4px)`,
                    width: `calc(${100 / ROOMS.length}% - 8px)`,
                  }}
                  onPointerDown={(p) => onPointerDown(p, e, "move")}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(e)}
                  onAnimationEnd={() => setFocus(null)}
                  title={lock ? "Acara sudah selesai, tidak bisa diubah" : "Geser untuk pindah, klik untuk edit"}
                >
                  {size !== "is-s" && tag && <span className="rundown__tags">{tag}</span>}
                  <span className="rundown__event-title t-p-h5-bold">{e.title}</span>
                  {size === "is-l" && (
                    <span className="t-p-h5 rundown__event-time">
                      {formatTime(e.start)}–{formatTime(e.end)}
                      {e.pic ? ` · PIC ${e.pic}` : ""}
                    </span>
                  )}
                  {lock ? (
                    <Icon name="Lock" size={16} className="rundown__lock" />
                  ) : (
                    <span
                      className="rundown__resize"
                      aria-label="Ubah durasi"
                      onPointerDown={(p) => onPointerDown(p, e, "resize")}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => (drag.current = null)}
                    />
                  )}
                </article>
              );
            })}
          </div>
          {phase === "live" && now >= DAY_START && now <= DAY_END && (
            <>
              {/* Line runs behind the cards; the time label stays on top in the hour column */}
              <span className="rundown__now-line" style={{ top: (now - DAY_START) * PX }} />
              <span className="rundown__now-dot" style={{ top: (now - DAY_START) * PX }} aria-hidden="true" />
              <span className="t-p-h5-bold rundown__now-time" style={{ top: (now - DAY_START) * PX }}>
                {formatTime(now)}
              </span>
            </>
          )}
        </div>
      </section>

      {editing && (
        <EventEditor
          event={editing === "new" ? null : editing}
          people={people}
          onClose={() => setEditing(null)}
          onApply={(ev) => {
            setDraft((d) => (d.some((x) => x.id === ev.id) ? d.map((x) => (x.id === ev.id ? ev : x)) : [...d, ev]));
            setEditing(null);
          }}
          onDelete={(id) => {
            setDraft((d) => d.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}

      {saving && (
        <Dialog
          icon="Calendar"
          iconTone="blue"
          title="Simpan perubahan rundown?"
          description={`${changed.length + removed.length} acara berubah. Tamu melihat jadwal baru begitu disimpan.`}
          onClose={() => setSaving(false)}
          actions={
            <>
              <Button
                onClick={() => {
                  onSave(draft, notify);
                  setSaving(false);
                }}
              >
                Simpan
              </Button>
              <Button style="tertiary" onClick={() => setSaving(false)}>
                Kembali
              </Button>
            </>
          }
        >
          <ul className="diff-list">
            {changed.map((c) => {
              const o = events.find((e) => e.id === c.id);
              return (
                <li key={c.id} className="diff-list__row" style={roomStyle(c.roomId)}>
                  <span className="room-dot" />
                  <span className="t-p-h4-bold diff-list__name">{c.title}</span>
                  <span className="t-p-h5 diff-list__change">
                    {o ? (
                      <>
                        <s>
                          {formatTime(o.start)}–{formatTime(o.end)}
                          {o.roomId !== c.roomId ? `, ${ROOMS[roomIndex(o.roomId)].name}` : ""}
                        </s>
                        <Icon name="ArrowRight" size={16} />
                      </>
                    ) : (
                      <Badge type="claimed">Baru</Badge>
                    )}
                    <strong>
                      {formatTime(c.start)}–{formatTime(c.end)}
                      {!o || o.roomId !== c.roomId ? `, ${ROOMS[roomIndex(c.roomId)].name}` : ""}
                    </strong>
                  </span>
                </li>
              );
            })}
            {removed.map((r) => (
              <li key={r.id} className="diff-list__row is-removed">
                <span className="room-dot" />
                <span className="t-p-h4-bold diff-list__name">{r.title}</span>
                <Badge type="danger">Dihapus</Badge>
              </li>
            ))}
          </ul>
          <div className="dialog-gap" />
          <Toggle dark label="Kirim notifikasi ke tamu" hint="Tamu dapat notifikasi “Rundown berubah”." checked={notify} onChange={setNotify} />
        </Dialog>
      )}
    </div>
  );
}

function EventEditor({ event, people, onClose, onApply, onDelete }: { event: AdminEvent | null; people: Person[]; onClose: () => void; onApply: (e: AdminEvent) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [roomId, setRoomId] = useState(event?.roomId ?? ROOMS[0].id);
  const [start, setStart] = useState(event?.start ?? 13 * 60 + 30);
  const [end, setEnd] = useState(event?.end ?? 14 * 60);
  const [pic, setPic] = useState(event?.pic ?? "");
  const [speakerId, setSpeakerId] = useState<string | undefined>(event?.speakerId);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timeError = end <= start ? "Jam selesai harus setelah jam mulai." : start < DAY_START || end > DAY_END ? "Di luar jam acara (09.00–14.00)." : null;
  const titleError = !title.trim() ? "Judul acara wajib diisi." : null;
  const picError = !pic.trim() ? "Isi nama PIC dari panitia." : null;

  const apply = () => {
    setTried(true);
    if (timeError || titleError || picError) return;
    onApply({ id: event?.id ?? `acara-${Date.now()}`, title: title.trim(), roomId, start, end, pic: pic.trim(), speakerId });
  };

  if (confirmDelete && event) {
    return (
      <Dialog
        icon="Trash"
        iconTone="red"
        title={`Hapus ${event.title}?`}
        description="Acara ini hilang dari rundown tamu setelah perubahan disimpan."
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button style="danger" onClick={() => onDelete(event.id)}>
              Ya, hapus
            </Button>
            <Button style="tertiary" onClick={() => setConfirmDelete(false)}>
              Kembali
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Dialog
      form
      icon={event ? "Pencil" : "Plus"}
      iconTone="blue"
      title={event ? "Edit acara" : "Tambah acara"}
      description="Perubahan baru terlihat tamu setelah kamu klik “Simpan perubahan”."
      onClose={onClose}
      danger={
        event ? (
          <Button style="danger" icon="Trash" onClick={() => setConfirmDelete(true)}>
            Hapus
          </Button>
        ) : undefined
      }
      actions={
        <>
          <Button onClick={apply}>{event ? "Terapkan" : "Tambah ke rundown"}</Button>
          <Button style="tertiary" onClick={onClose}>
            Batal
          </Button>
        </>
      }
    >
      <TextField label="Judul acara" value={title} onChange={setTitle} maxLength={40} error={tried ? (titleError ?? undefined) : undefined} />
      <RoomPicker label="Ruangan" value={roomId} onChange={(id) => id && setRoomId(id)} />
      <div className="editor-times">
        <TimePicker label="Mulai" value={start} onChange={setStart} error={tried && !!timeError} min={DAY_START} max={DAY_END} />
        <TimePicker label="Selesai" value={end} onChange={setEnd} error={tried && !!timeError} min={DAY_START} max={DAY_END} />
      </div>
      {tried && timeError && (
        <span className="t-p-h5 field__hint field__hint--error" role="alert">
          {timeError}
        </span>
      )}
      <TextField label="PIC (panitia)" value={pic} onChange={setPic} placeholder="Nama panitia" maxLength={30} error={tried ? (picError ?? undefined) : undefined} />
      <div className="field">
        <span className="t-p-h5-bold field__label">Pembicara (opsional)</span>
        <div className="speaker-pick">
          {[{ id: undefined, name: "Tanpa pembicara", title: "MC saja" }, ...people.filter((p) => p.role === "pembicara")].map((p) => (
            <button
              key={p.id ?? "none"}
              type="button"
              className={`speaker-pick__opt clay clay-light${speakerId === p.id ? " is-active" : ""}`}
              aria-pressed={speakerId === p.id}
              onClick={() => setSpeakerId(p.id)}
            >
              <Icon name={p.id ? "Sparkle" : "Megaphone"} size={16} />
              <span className="speaker-pick__text">
                <span className="t-p-h5-bold">{p.name}</span>
                <span className="t-p-h5 admin-muted">{p.title}</span>
              </span>
              {speakerId === p.id && <Icon name="Check" size={16} />}
            </button>
          ))}
        </div>
        <span className="t-p-h5 field__hint">Pembicara dapat link akses dari menu Pengisi acara.</span>
      </div>
    </Dialog>
  );
}
