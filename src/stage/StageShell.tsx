import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { IconBadge, type IconTone } from "../components/IconBadge";
import type { IconName } from "../components/iconPaths";
import { fmtClock } from "./store";
import "./stage.css";

export type NavItem<T extends string> = { id: T; label: string; icon: IconName; count?: number };

type Props<T extends string> = {
  nav: NavItem<T>[];
  active: T;
  onNav: (id: T) => void;
  /** Always-visible strip at the top (timer). */
  strip?: ReactNode;
  banner?: ReactNode;
  toast?: ReactNode;
  children: ReactNode;
};

/**
 * MC / speaker layout: one column + floating bottom nav (like the guest app), on phones and tablets.
 * Tablets get a 24px gutter, full-width toasts and floating dialogs; a rotated tablet keeps the same layout.
 */
export function StageShell<T extends string>({ nav, active, onNav, strip, banner, toast, children }: Props<T>) {
  return (
    <div className="stage">
      <nav className="stage-nav clay clay-dark" aria-label="Navigasi">
        {nav.map((n) => {
          const on = n.id === active;
          return (
            <button
              key={n.id}
              type="button"
              className={`stage-nav__item clay ${on ? "is-active clay-accent" : "clay-grey"}`}
              aria-current={on ? "page" : undefined}
              aria-label={n.label}
              onClick={() => onNav(n.id)}
            >
              <Icon name={n.icon} />
              <span className="t-p-h4-bold stage-nav__label">{n.label}</span>
              {n.count ? <span className="stage-nav__count clay clay-accent t-p-h5-bold">{n.count}</span> : null}
            </button>
          );
        })}
      </nav>
      <div className="stage-col stage-col--main">
        {strip}
        {banner}
        <div className="stage-scroll">{children}</div>
      </div>
      {toast && <div className="stage-toast">{toast}</div>}
    </div>
  );
}

/** Timer strip: what's on stage and how long is left, visible on every tab. */
export function TimerStrip({ title, secs = 0, label, display }: { title: string; secs?: number; label?: string; /** Fixed text instead of a countdown (start time, "Selesai"…). */ display?: string }) {
  const tone = display ? "idle" : secs < 0 ? "over" : secs <= 300 ? "warn" : "ok";
  return (
    <div className={`timer-strip timer-strip--${tone} clay clay-dark`} role="timer" aria-live="off">
      <span className="timer-strip__dot" />
      <span className="t-p-h4-bold timer-strip__title">{title}</span>
      {(label || !display) && <span className="t-p-h5 timer-strip__label">{label ?? (secs < 0 ? "lewat" : "sisa")}</span>}
      <span className="timer-strip__time">{display ?? fmtClock(secs)}</span>
    </div>
  );
}

/** Big countdown inside the "Sekarang" card. */
export function BigTimer({ secs, total }: { secs: number; total: number }) {
  const tone = secs < 0 ? "over" : secs <= 300 ? "warn" : "ok";
  const pct = Math.max(0, Math.min(100, ((total - secs) / total) * 100));
  return (
    <div className={`big-timer big-timer--${tone}`}>
      <span className="big-timer__time">{fmtClock(secs)}</span>
      <span className="t-p-h5-bold big-timer__state clay clay-accent">{secs < 0 ? "Lewat waktu" : secs <= 300 ? "Hampir habis" : "Sesuai jadwal"}</span>
      <span className="big-timer__bar">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/** Section card with the admin panel header pattern: clay icon + title (+ aside), separator, body. */
export function StageCard({ icon, tone, title, aside, children, className = "" }: { icon?: IconName; tone?: IconTone; title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`stage-card ${className}`}>
      {title && (
        <header className="stage-card__head">
          {icon && <IconBadge icon={icon} tone={tone} size="S" />}
          <h2 className="t-p-h3-bold stage-card__title">{title}</h2>
          {aside && <div className="stage-card__aside">{aside}</div>}
        </header>
      )}
      <div className="stage-card__body">{children}</div>
    </section>
  );
}
