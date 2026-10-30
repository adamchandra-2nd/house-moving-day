import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { useEvent } from "../data/eventContext";
import { DAY_END, DAY_START, formatTime, hasQna, statusAt, useAgenda, type AgendaStatus } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import "./AgendaScreen.css";

/** Pixels per minute: a 30-minute slot is ~108px, like Google Calendar's day view. */
const PX = 3.6;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);
const HALF_HOURS = HOURS.slice(0, -1).map((h) => h + 30);

const STATUS: Record<AgendaStatus, { type: "now" | "next" | "done"; label: string } | null> = {
  now: { type: "now", label: "Sekarang" },
  next: { type: "next", label: "Berikutnya" },
  done: { type: "done", label: "Selesai" },
  later: null,
};

type Props = {
  now: number;
  currentRoomIndex: number;
  /** Item that just moved in the rundown (shows a "Diubah" tag). */
  changedId?: string;
  ended: boolean;
  onGoToRoom: (roomIndex: number) => void;
  onFeedback: () => void;
  /** Opens the question form for that session (several can run at once). */
  onAsk: (eventId: string) => void;
  /** Per-event feedback already sent (event id → rating). */
  feedbackSent: Record<string, number>;
  /** The final survey is in: the ended card points at the memory card instead. */
  finalFeedbackSent: boolean;
};

/**
 * Side-by-side columns for sessions that overlap in time, like Google
 * Calendar's day view. Without this, a 09.00–10.00 and a 09.30–10.35 session
 * were drawn at the same x and the later card covered the earlier one.
 *
 * Sessions are swept in start order into clusters of mutually overlapping
 * ones; each takes the first column free at its start, and every session in a
 * cluster shares that cluster's column count so the widths line up.
 */
function columnsOf(items: { id: string; start: number; end: number }[]) {
  const out: Record<string, { col: number; cols: number }> = {};
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: string[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => cluster.forEach((id) => (out[id].cols = colEnds.length));
  for (const it of sorted) {
    if (it.start >= clusterEnd) {
      close();
      cluster = [];
      colEnds = [];
      clusterEnd = it.end;
    }
    let col = colEnds.findIndex((end) => end <= it.start);
    if (col === -1) col = colEnds.push(it.end) - 1;
    else colEnds[col] = it.end;
    out[it.id] = { col, cols: 1 };
    cluster.push(it.id);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  close();
  return out;
}

/** Agenda as a day timeline: hour column on the left, cards sized by duration, and a live "now" line. */
export function AgendaScreen({ now, currentRoomIndex, changedId, ended, onGoToRoom, onFeedback, onAsk, feedbackSent, finalFeedbackSent }: Props) {
  const EVENT = useEvent();
  const agenda = useAgenda();
  const status = statusAt(now);
  const y = (min: number) => (min - DAY_START) * PX;
  const showNow = now >= DAY_START && now <= DAY_END;
  const columns = columnsOf(agenda);

  return (
    <div className="page__scroll screen-enter">
      <header className="page__header">
        <h1 className="t-display-h6 page__title">Agenda</h1>
        <p className="t-p-h5 page__sub">
          {EVENT.dateLabel} · {ended ? "acara sudah selesai, terima kasih sudah datang!" : "kami kabari kalau rundown berubah."}
        </p>
      </header>

      {ended && (
        <section className="card agenda-ended">
          <span className="t-p-h4-bold">Semua acara sudah selesai</span>
          <button type="button" className="agenda-ended__link t-p-h5-bold" onClick={onFeedback}>
            {finalFeedbackSent ? "Lihat memory card-mu →" : "Isi feedback dan dapatkan memory card →"}
          </button>
        </section>
      )}

      {agenda.length === 0 && (
        <section className="card agenda-ended">
          <span className="t-p-h4-bold">Rundown belum tersedia</span>
          <span className="t-p-h5">Panitia sedang menyiapkan jadwalnya. Nanti muncul di sini.</span>
        </section>
      )}

      <div className="timeline" style={{ height: y(DAY_END) + 16 }}>
        {HOURS.map((h) => (
          <div key={h} className="timeline__hour" style={{ top: y(h) }}>
            <span className="t-p-h5 timeline__label">{formatTime(h)}</span>
            <span className="timeline__rule" />
          </div>
        ))}
        {HALF_HOURS.map((h) => (
          <span key={h} className="timeline__half" style={{ top: y(h) }} />
        ))}

        {agenda.map((item) => {
          const s = status[item.id];
          const tag = STATUS[s];
          const roomIndex = roomIndexById(item.roomId);
          const here = roomIndex === currentRoomIndex;
          const height = (item.end - item.start) * PX - 4;
          const compact = item.end - item.start <= 45;
          const { col, cols } = columns[item.id];
          return (
            <article
              key={item.id}
              className={`timeline__event card agenda-card--${s}${compact ? " is-compact" : ""}${cols > 1 ? " is-split" : ""}`}
              style={{ top: y(item.start) + 2, height, "--col": col, "--cols": cols } as React.CSSProperties}
            >
              {(tag || item.id === changedId) && (
                <span className="agenda-card__tags">
                  {/* A finished event you rated shows that instead of "Selesai" (the faded card already says it's over) */}
                  {s === "done" && item.id in feedbackSent ? (
                    <Badge type="hadir">Feedback terkirim</Badge>
                  ) : (
                    tag && <Badge type={tag.type}>{tag.label}</Badge>
                  )}
                  {item.id === changedId && <Badge type="on-air">Diubah</Badge>}
                </span>
              )}
              <h2 className="agenda-card__title">{item.title}</h2>
              <span className="agenda-card__meta t-p-h5">
                {s === "done" ? (
                  <span className="agenda-card__room">
                    <Icon name="MapPin" size={16} />
                    {ROOMS[roomIndex].name}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="agenda-card__room is-link t-p-h5-bold"
                    onClick={() => onGoToRoom(roomIndex)}
                    aria-label={here ? "Kamu di ruangan ini" : `Pindah ke ${ROOMS[roomIndex].name}`}
                  >
                    <Icon name="MapPin" size={16} />
                    {here ? "Kamu di sini" : ROOMS[roomIndex].name}
                    {!here && <Icon name="ChevronRight" size={16} />}
                  </button>
                )}
                {!compact && <span className="agenda-card__time">{formatTime(item.start)}–{formatTime(item.end)}</span>}
              </span>
              {/* Only where the committee switched Q&A on: no button that leads to a closed form */}
              {s === "now" && hasQna(item) && (
                <Button size="small" style="tertiary" icon="Message" onClick={() => onAsk(item.id)}>
                  Tanya pembicara
                </Button>
              )}
            </article>
          );
        })}

        {showNow && (
          <>
            {/* Line runs behind the cards so it never strikes through a title */}
            <span className="timeline__now-line" style={{ top: y(now) }} />
            <span className="timeline__now" style={{ top: y(now) }} aria-label={`Sekarang ${formatTime(now)}`}>
              <span className="timeline__now-time t-p-h5-bold">{formatTime(now)}</span>
              <span className="timeline__now-dot" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
