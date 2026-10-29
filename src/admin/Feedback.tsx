import { useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { formatTime, statusAt } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import { downloadCsv } from "./csv";
import type { AdminEvent, EventFeedbackEntry } from "./data";
import type { Phase } from "./Dashboard";
import { Empty, Panel } from "./ui";

type Final = {
  ratings: number[];
  moods: Record<string, number>;
  messages: string[];
};
type Props = {
  events: AdminEvent[];
  now: number;
  phase: Phase;
  perEvent: Record<string, EventFeedbackEntry[]>;
  final: Final | null;
  /** Guests present (to show how many have answered). */
  present: number;
  initialTab?: string;
  onExported: () => void;
};

/** Star colours: distinct hues (not shades of one), so neighbouring slices stay apart, also for colour-blind eyes. */
const STAR_COLORS = ["", "#c62828", "#d6589f", "#8a63d2", "#2f6fdb", "#4e8a3e"];

/** Feedback results: per event (anonymous rating + text) and the final event feedback. */
export function Feedback({
  events,
  now,
  phase,
  perEvent,
  final,
  present,
  initialTab,
  onExported,
}: Props) {
  const status =
    phase === "ended"
      ? Object.fromEntries(events.map((e) => [e.id, "done"]))
      : phase === "pre"
        ? {}
        : statusAt(now);
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const [tab, setTab] = useState<string>(
    initialTab ?? sorted.find((e) => status[e.id] === "done")?.id ?? "akhir",
  );
  const event = events.find((e) => e.id === tab);
  const entries = perEvent[tab] ?? [];
  const finalCount = final ? final.ratings.reduce((a, b) => a + b, 0) : 0;

  const exportCsv = () => {
    downloadCsv("feedback-hmd.csv", [
      ["Acara", "Rating", "Feedback", "Jam"],
      ...Object.entries(perEvent).flatMap(([id, list]) =>
        list.map((f) => [
          events.find((e) => e.id === id)?.title ?? id,
          f.rating,
          f.text,
          formatTime(f.at),
        ]),
      ),
    ]);
    onExported();
  };

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Feedback</h1>
          <p className="t-p-h4 admin-sub">
            Semua feedback anonim. Nama tamu tidak pernah tercatat di sini.
          </p>
        </div>
        <div className="admin-actions">
          <Button
            size="small"
            style="tertiary"
            icon="Download"
            onClick={exportCsv}
          >
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* Event picker + what's being read, in one container */}
      <section className="fb-picker">
        <div className="pill-tabs" role="tablist">
          {sorted.map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={tab === e.id}
              className={`pill-tab t-p-h5-bold${tab === e.id ? " is-active clay clay-dark" : ""}`}
              onClick={() => setTab(e.id)}
            >
              {e.title}
              <span className="pill-tab__count">
                {(perEvent[e.id] ?? []).length}
              </span>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "akhir"}
            className={`pill-tab t-p-h5-bold${tab === "akhir" ? " is-active clay clay-dark" : ""}`}
            onClick={() => setTab("akhir")}
          >
            Feedback akhir
          </button>
        </div>

        <p className="t-p-h4 fb-context">
          <Icon name={event ? "Calendar" : "Star"} size={16} />
          <span>
            {event ? (
              <>
                <strong>{event.title}</strong> · {formatTime(event.start)}–
                {formatTime(event.end)} ·{" "}
                {ROOMS[roomIndexById(event.roomId)].name} ·{" "}
                <strong>
                  {entries.length} dari {present}
                </strong>{" "}
                tamu hadir sudah mengisi
              </>
            ) : (
              <>
                <strong>Feedback akhir</strong> · seluruh acara ·{" "}
                <strong>
                  {finalCount} dari {present}
                </strong>{" "}
                tamu hadir sudah mengisi
              </>
            )}
          </span>
        </p>
      </section>

      {event ? (
        status[event.id] !== "done" ? (
          <Panel icon="Star" tone="pink" title="Feedback acara">
            <Empty
              icon="Clock"
              tone="teal"
              title={`${event.title} belum selesai`}
              body="Form feedback dikirim ke tamu begitu acara diselesaikan."
            />
          </Panel>
        ) : entries.length === 0 ? (
          <Panel icon="Star" tone="pink" title="Feedback acara">
            <Empty
              icon="Star"
              tone="pink"
              title="Belum ada feedback"
              body="Tamu sedang mengisi. Hasilnya muncul di sini secara langsung."
            />
          </Panel>
        ) : (
          <div className="admin-fill fb-fill">
            <Panel
              icon="Message"
              tone="pink"
              title={`Komentar · ${entries.length}`}
            >
              <ul className="fb-list">
                {entries.map((f, i) => (
                  <li key={i} className="fb-list__item">
                    <span className="fb-list__head">
                      <Stars n={f.rating} />
                      <span className="t-p-h5 admin-muted">
                        Anonim · {formatTime(f.at)}
                      </span>
                    </span>
                    <span className="t-p-h4">{f.text}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Donut ratings={entries.map((e) => e.rating)} />
          </div>
        )
      ) : !final ? (
        <Panel icon="Star" tone="pink" title="Feedback akhir">
          <Empty
            icon="Lock"
            tone="slate"
            title="Feedback akhir belum dibuka"
            body="Tab Feedback di HP tamu terbuka setelah acara selesai."
          />
        </Panel>
      ) : (
        <div className="admin-fill fb-fill fb-fill--final">
          <Panel icon="Sparkle" tone="pink" title="Yang paling berkesan">
            <div className="fb-bubbles">
              {Object.entries(final.moods)
                .sort((a, b) => b[1] - a[1])
                .map(([m, n]) => {
                  const max = Math.max(...Object.values(final.moods));
                  return (
                    <span
                      key={m}
                      className="fb-bubble clay clay-accent"
                      style={
                        { "--s": 0.7 + (n / max) * 0.3 } as React.CSSProperties
                      }
                    >
                      <span className="fb-bubble__n">{n}</span>
                      <span className="fb-bubble__label">{m}</span>
                    </span>
                  );
                })}
            </div>
          </Panel>
          <Panel
            icon="Message"
            tone="pink"
            title={`Pesan buat Potara · ${final.messages.length}`}
          >
            <ul className="fb-list">
              {final.messages.map((m, i) => (
                <li key={i} className="fb-list__item">
                  <span className="t-p-h5 admin-muted">Anonim</span>
                  <span className="t-p-h4">{m}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Donut
            ratings={final.ratings.flatMap((n, i) => Array(n).fill(i + 1))}
          />
        </div>
      )}
    </div>
  );
}

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="fb-stars" aria-label={`${n} bintang`}>
      {[1, 2, 3, 4, 5].map((k) => (
        <Icon
          key={k}
          name={k <= Math.round(n) ? "StarFill" : "Star"}
          size={size}
        />
      ))}
    </span>
  );
}

/** Donut of the 1–5 star split, average in the middle, a verdict tag, and a legend. */
function Donut({ ratings }: { ratings: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = ratings.length;
  const avg = total ? ratings.reduce((a, b) => a + b, 0) / total : 0;
  const counts = [5, 4, 3, 2, 1].map((s) => ({
    s,
    n: ratings.filter((r) => r === s).length,
  }));
  const verdict =
    avg >= 4
      ? { type: "claimed" as const, text: "Mayoritas puas" }
      : avg >= 3
        ? { type: "warn" as const, text: "Cukup" }
        : { type: "danger" as const, text: "Perlu perhatian" };
  const R = 80;
  const STROKE = 28;
  const GAP = 2;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <Panel
      icon="Star"
      tone="pink"
      title="Rata-rata"
      aside={
        total ? <Badge type={verdict.type}>{verdict.text}</Badge> : undefined
      }
    >
      <div className="donut">
        <svg
          viewBox="0 0 200 200"
          className="donut__svg"
          role="img"
          aria-label={`Rata-rata ${avg.toFixed(1)} dari ${total} tamu`}
        >
          <circle cx="100" cy="100" r={R} className="donut__track" />
          {counts.map(({ s, n }) => {
            if (!n) return null;
            const len = (n / total) * C;
            const full = n === total;
            const seg = (
              <circle
                key={s}
                cx="100"
                cy="100"
                r={R}
                className={`donut__seg${hover === s ? " is-hover" : ""}${full ? " is-full" : ""}`}
                style={
                  full
                    ? { stroke: STAR_COLORS[s] }
                    : // Round caps stick out half the stroke at each end, so trim the dash by that plus the gap
                      {
                        stroke: STAR_COLORS[s],
                        strokeDasharray: `${Math.max(0.01, len - GAP - STROKE)} ${C}`,
                        strokeDashoffset: -(offset + GAP / 2 + STROKE / 2),
                      }
                }
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="donut__center">
          {hover ? (
            <>
              <span className="donut__avg">
                {counts.find((c) => c.s === hover)?.n}
              </span>
              <span className="t-p-h5 admin-muted">tamu memberi {hover}★</span>
            </>
          ) : (
            <>
              <span className="donut__avg">{avg.toFixed(1)}</span>
              <Stars n={avg} />
              <span className="t-p-h5 admin-muted">dari {total} tamu</span>
            </>
          )}
        </div>
      </div>
      <ul className="donut__legend">
        {counts.map(({ s, n }) => {
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li
              key={s}
              className={`donut__row${hover === s ? " is-hover" : ""}`}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="donut__dot"
                style={{ background: STAR_COLORS[s] }}
              />
              <span className="t-p-h5-bold donut__star">{s}★</span>
              <span className="donut__bar">
                <span
                  style={{ width: `${pct}%`, background: STAR_COLORS[s] }}
                />
              </span>
              <span className="t-p-h5 admin-muted donut__val">
                {n} tamu · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
