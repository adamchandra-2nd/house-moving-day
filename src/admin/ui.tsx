import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon";
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

export type RowMenuItem = { label: string; icon: IconName; onSelect: () => void; danger?: boolean };

/**
 * A row's secondary actions behind a "⋮" button, so a table row shows one
 * main action instead of a strip of buttons that crushes the other columns.
 *
 * The list is portalled to <body> and placed under the button: table rows
 * clip and scroll, and a menu inside one would be cut off at the row edge.
 * Closes on a choice, an outside click, Escape, or the page scrolling away.
 */
export function RowMenu({ items, label = "Aksi lainnya" }: Readonly<{ items: RowMenuItem[]; label?: string }>) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && (list.current?.contains(e.target as Node) || button.current?.contains(e.target as Node))) return;
      setAt(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [at]);

  if (!items.length) return null;
  const toggle = () => {
    if (at) return setAt(null);
    const r = button.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, right: window.innerWidth - r.right });
  };

  return (
    <>
      <button ref={button} type="button" className="icon-btn clay clay-light row-menu__btn" aria-label={label} aria-haspopup="menu" aria-expanded={!!at} onClick={toggle}>
        <Icon name="More" size={20} />
      </button>
      {at &&
        createPortal(
          <div ref={list} className="row-menu clay clay-light" role="menu" style={{ top: at.top, right: at.right }}>
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={`row-menu__item t-p-h4-bold${it.danger ? " is-danger" : ""}`}
                onClick={() => {
                  setAt(null);
                  it.onSelect();
                }}
              >
                <Icon name={it.icon} size={18} />
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
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
/**
 * `endsAt` (ms) is the exact end when it is known -- the stage records the
 * real start to the millisecond -- and wins over the minute arithmetic.
 */
export function LiveTimer({ end, now, start, endsAt, variant = "hero" }: { end: number; now: number; start: number; endsAt?: number; variant?: "hero" | "chip" }) {
  const [tick, setTick] = useState(() => Date.now());
  // Re-anchored whenever the minute moves: counting seconds from mount on top
  // of a `now` that also advances took every minute off twice.
  const [anchor, setAnchor] = useState(() => ({ now, at: Date.now() }));
  if (anchor.now !== now) setAnchor({ now, at: Date.now() });
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const secs = endsAt !== undefined ? Math.round((endsAt - tick) / 1000) : Math.round((end - now) * 60 - Math.max(0, tick - anchor.at) / 1000);
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
