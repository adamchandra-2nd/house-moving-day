import { useEffect, useState, type ReactNode } from "react";
import { IconBadge, type IconTone } from "../components/IconBadge";
import type { IconName } from "../components/iconPaths";

/** Admin panel: icon + title (+ aside), a separator, a body that scrolls inside the panel, optional footer. */
export function Panel({
  icon,
  tone,
  title,
  aside,
  footer,
  children,
  className = "",
  flush,
}: {
  icon?: IconName;
  tone?: IconTone;
  title?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Body manages its own layout/scroll (tables, timelines). */
  flush?: boolean;
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {title && (
        <header className="admin-panel__head">
          {icon && <IconBadge icon={icon} tone={tone} size="S" />}
          <h2 className="t-p-h3-bold admin-panel__title">{title}</h2>
          {aside && <div className="admin-panel__aside">{aside}</div>}
        </header>
      )}
      <div className={flush ? "admin-panel__flush" : "admin-panel__body scroll-fade"}>{children}</div>
      {footer && <footer className="admin-panel__foot">{footer}</footer>}
    </section>
  );
}

export type Column = { label: ReactNode; width: string; align?: "end" };

/** Grid table: the header row stays put, only the rows scroll (with soft fades), so nothing gets cut off. */
export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: Column[];
  rows: { id: string; cells: ReactNode[]; selected?: boolean; onClick?: () => void }[];
  empty?: ReactNode;
}) {
  const template = columns.map((c) => c.width).join(" ");
  return (
    <div className="dtable" role="table">
      <div className="dtable__row dtable__head t-p-h5-bold" role="row" style={{ gridTemplateColumns: template }}>
        {columns.map((c, i) => (
          <span key={i} role="columnheader" className={c.align === "end" ? "is-end" : ""}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="dtable__empty">{empty}</div>
      ) : (
        <div className="dtable__body scroll-fade" role="rowgroup">
          {rows.map((r) => (
            <div
              key={r.id}
              role="row"
              className={`dtable__row${r.selected ? " is-selected" : ""}${r.onClick ? " is-clickable" : ""}`}
              style={{ gridTemplateColumns: template }}
              onClick={r.onClick}
            >
              {r.cells.map((c, i) => (
                <span key={i} role="cell" className={columns[i]?.align === "end" ? "is-end" : ""}>
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stat strip cell: icon, label, big value, then a bar or a note (same height everywhere). */
export function Stat({ icon, tone, label, value, of, note }: { icon: IconName; tone: IconTone; label: string; value: number | string; of?: number; note?: string }) {
  const n = typeof value === "number" ? value : 0;
  return (
    <div className="stat">
      <div className="stat__top">
        <IconBadge icon={icon} tone={tone} />
        <span className="t-p-h5-bold stat__label">{label}</span>
      </div>
      <span className="stat__row">
        <span className="stat__value">{value}</span>
        {of !== undefined && <span className="t-p-h4 admin-muted">/ {of}</span>}
      </span>
      {of !== undefined && (
        <span className="stat__bar">
          <span style={{ width: `${of ? Math.round((n / of) * 100) : 0}%` }} />
        </span>
      )}
      {note && <span className="t-p-h5 admin-muted">{note}</span>}
    </div>
  );
}

/** Empty state with a colourful clay icon. */
export function Empty({ icon, tone, title, body }: { icon: IconName; tone: IconTone; title: string; body?: string }) {
  return (
    <div className="admin-empty">
      <IconBadge icon={icon} tone={tone} size="L" />
      <span className="t-p-h4-bold admin-empty__title">{title}</span>
      {body && <span className="t-p-h5">{body}</span>}
    </div>
  );
}

/** Live countdown for the session on stage (brief: the rundown shows a timer). Ticks from the rundown clock. */
export function LiveTimer({ end, now, start, variant = "hero" }: { end: number; now: number; start: number; variant?: "hero" | "chip" }) {
  const [t0] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const secs = Math.round((end - now) * 60 - (tick - t0) / 1000);
  const a = Math.abs(secs);
  const text = `${secs < 0 ? "+" : ""}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  const tone = secs < 0 ? "over" : secs <= 300 ? "warn" : "ok";
  const pct = Math.max(0, Math.min(100, (1 - secs / ((end - start) * 60)) * 100));
  if (variant === "chip")
    return (
      <span className={`live-chip live-chip--${tone} t-p-h5-bold`} role="timer">
        <span className="live-chip__dot" />
        {secs < 0 ? "lewat" : "sisa"} {text}
      </span>
    );
  return (
    <div className={`live-timer live-timer--${tone}`} role="timer">
      <span className="live-timer__row">
        <span className="live-timer__time">{text}</span>
        <span className="t-p-h5-bold live-timer__state">{secs < 0 ? "Lewat waktu" : secs <= 300 ? "Hampir habis" : "sisa waktu"}</span>
      </span>
      <span className="live-timer__bar">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
