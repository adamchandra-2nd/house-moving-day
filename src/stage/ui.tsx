import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Icon } from "../components/Icon";
import { IconBadge, type IconTone } from "../components/IconBadge";
import type { IconName } from "../components/iconPaths";
import { formatTime } from "../data/agenda";
import { ROOMS } from "../data/rooms";
import { HELP_SHORT, panitiaContact, type SpeakerHelp, type StageQuestion } from "./data";
import "./stage.css";

/** Bottom sheet (phone pattern), floating at the bottom on tablets. Portaled to <body> so a clipped or masked parent (e.g. the Kenalan card) can't trap it. */
export function Sheet({ icon, tone, title, children, onClose }: { icon: IconName; tone: IconTone; title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <span className="sheet__grip" />
        <header className="sheet__head">
          <IconBadge icon={icon} tone={tone} size="S" />
          <h2 className="t-p-h3-bold stage-card__title">{title}</h2>
          <button type="button" className="icon-btn clay clay-light" aria-label="Tutup" onClick={onClose}>
            <Icon name="Close" size={20} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

/** Error / 404 for the stage apps, same card as the login. */
export function StageSystem({ kind, onRetry }: { kind: "error" | "404"; onRetry: () => void }) {
  return (
    <main className="stage-login" style={{ backgroundImage: `url(${ROOMS[0].image})` }}>
      <section className="stage-login__card">
        <div style={{ height: 220, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
          <Character say={kind === "404" ? "Kok nyasar?" : "Waduh…"} />
        </div>
        <div className="stage-login__head">
          <h1 className="stage-login__title">{kind === "404" ? "Halaman tidak ditemukan" : "Ups, ada yang tidak beres"}</h1>
          <p className="t-p-h4 stage-login__body">
            {kind === "404" ? "Link ini tidak ada. Buka lagi link dari WhatsApp panitia." : "Server tidak merespons. Timer dan naskah tetap aman, coba lagi sebentar."}
          </p>
        </div>
        <Button block icon="ArrowRight" onClick={onRetry}>
          {kind === "404" ? "Ke Panggung" : "Coba lagi"}
        </Button>
      </section>
    </main>
  );
}

/** Question card. Swipe right = primary action, left = skip (buttons do the same). */
export function QCard({
  q,
  picked,
  primary,
  secondary,
  tag,
}: {
  q: StageQuestion;
  picked?: boolean;
  primary?: { label: string; icon: IconName; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  tag?: ReactNode;
}) {
  const start = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <li
      className={`q-card${picked ? " is-picked" : ""}${dx > 60 ? " swipe-right" : dx < -60 ? " swipe-left" : ""}`}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      onPointerDown={(e) => {
        if (!primary && !secondary) return;
        if ((e.target as HTMLElement).closest("button")) return;
        start.current = e.clientX;
      }}
      onPointerMove={(e) => start.current !== null && setDx(Math.max(-120, Math.min(120, e.clientX - start.current)))}
      onPointerUp={() => {
        if (dx > 80) primary?.onClick();
        else if (dx < -80) secondary?.onClick();
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <span className="q-card__meta t-p-h5">
        <span className="t-p-h5-bold">{q.author ?? "Anonim"}</span>
        <span>{formatTime(q.at)}</span>
      </span>
      <p className="q-card__text">{q.text}</p>
      {tag}
      {(primary || secondary) && (
        <div className="q-card__actions">
          {secondary ? (
            <Button size="small" style="tertiary" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          ) : (
            <span />
          )}
          {primary && (
            <Button size="small" style="secondary" icon={primary.icon} onClick={primary.onClick}>
              {primary.label}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Full-screen read mode: one question at a time on a centered card, the queue peeking behind it. */
export function ReadMode({
  list,
  strip,
  groupLabel,
  note,
  doneLabel,
  onDone,
  onSkip,
  onClose,
}: {
  list: StageQuestion[];
  /** Timer strip, so the MC keeps track of time while reading. */
  strip?: ReactNode;
  groupLabel: (q: StageQuestion) => string | undefined;
  note: string;
  doneLabel: string;
  onDone: (id: string) => void;
  onSkip: (id: string) => void;
  onClose: () => void;
}) {
  const [total] = useState(list.length);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const q = list[0];
  const next = list[1];
  const index = total - list.length + 1;
  const group = q ? groupLabel(q) : undefined;
  const size = q ? (q.text.length > 110 ? "is-long" : q.text.length > 60 ? "is-mid" : "") : "";

  return (
    <div className="read-mode screen-enter" role="dialog" aria-modal="true" aria-label="Mode baca">
      {strip}
      <div className="read-mode__top">
        <span className="read-mode__progress">
          <span className="t-p-h4-bold">{q ? `Pertanyaan ${index} dari ${total}` : "Selesai"}</span>
          <span className="read-mode__bars" aria-hidden="true">
            {Array.from({ length: total }).map((_, k) => (
              <span key={k} className={k < index - (q ? 1 : 0) ? "is-done" : k === index - 1 && q ? "is-now" : ""} />
            ))}
          </span>
        </span>
        <button type="button" className="icon-btn clay clay-dark" aria-label="Tutup mode baca" onClick={onClose}>
          <Icon name="Close" />
        </button>
      </div>

      <div className="read-mode__body">
        {q ? (
          <>
            <div className={`read-stack${next ? " has-next" : ""}${list.length > 2 ? " has-more" : ""}`}>
              <article
                className={`read-card clay clay-light${dx > 60 ? " is-done" : dx < -60 ? " is-skip" : ""}`}
                style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 40}deg)` : undefined }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  start.current = e.clientX;
                }}
                onPointerMove={(e) => start.current !== null && setDx(Math.max(-140, Math.min(140, e.clientX - start.current)))}
                onPointerUp={() => {
                  if (dx > 90) onDone(q.id);
                  else if (dx < -90) onSkip(q.id);
                  start.current = null;
                  setDx(0);
                }}
                onPointerCancel={() => {
                  start.current = null;
                  setDx(0);
                }}
              >
                <span className="read-card__who">
                  <Avatar initial={(q.author ?? "?").charAt(0)} size="S" />
                  <span className="t-p-h5-bold">{q.author ?? "Anonim"}</span>
                  <span className="t-p-h5 stage-muted">· {formatTime(q.at)}</span>
                </span>
                {group && (
                  <span className="claude-tag clay clay-light t-p-h5-bold">
                    <Icon name="Sparkle" size={16} />
                    {group}
                  </span>
                )}
                <p className={`read-card__text ${size}`}>{q.text}</p>
                <span className="read-card__note t-p-h5">
                  <Icon name="Eye" size={16} />
                  {note}
                </span>
              </article>
            </div>
            <span className="t-p-h5 read-mode__next one-line">{next ? `Berikutnya: ${next.text}` : "Ini pertanyaan terakhir"}</span>
          </>
        ) : (
          <div className="read-done">
            <div className="read-done__char">
              <Character say="Mantap!" />
            </div>
            <p className="read-mode__done-title">Semua pertanyaan pilihan sudah selesai</p>
          </div>
        )}
      </div>

      <div className="read-mode__actions">
        {q ? (
          <>
            <Button style="tertiary" onClick={() => onSkip(q.id)}>
              Lewati
            </Button>
            <Button icon="Check" onClick={() => onDone(q.id)}>
              {doneLabel}
            </Button>
          </>
        ) : (
          <Button block icon="ArrowLeft" onClick={onClose}>
            Kembali ke Pertanyaan
          </Button>
        )}
      </div>
    </div>
  );
}

/** 0812…, +62 812… or 62812… all become the 62812… that wa.me wants. */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("62") ? d : `62${d.replace(/^0/, "")}`;
};

/**
 * "Hubungi panitia": a real button that opens the committee's contact (copy number / open WhatsApp).
 *
 * Until the committee fills in a number (Pengaturan) there is nothing to dial,
 * so it says that quietly instead of opening an empty WhatsApp chat.
 */
export function ContactButton({ block, label = "Hubungi panitia", onCopied }: { block?: boolean; label?: string; onCopied?: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const contact = panitiaContact();
  const name = contact.name || "Panitia";
  if (!contact.phone.trim()) return <span className="t-p-h5 stage-muted">Kontak panitia belum diatur</span>;
  const wa = `https://wa.me/${waNumber(contact.phone)}`;
  return (
    <>
      <Button size="small" style="tertiary" icon="Headset" block={block} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <Sheet icon="Headset" tone="ink" title="Kontak panitia" onClose={() => setOpen(false)}>
          <div className="contact-card">
            <Avatar initial={name.charAt(0)} size="M" />
            <span className="contact-card__text">
              <span className="t-p-h4-bold">{name}</span>
              <span className="t-p-h4 contact-card__phone">{contact.phone}</span>
            </span>
          </div>
          <div className="stack-actions">
            <Button
              block
              icon={copied ? "Check" : "Copy"}
              onClick={() => {
                navigator.clipboard?.writeText(contact.phone.replace(/\s/g, "")).catch(() => undefined);
                setCopied(true);
                onCopied?.();
              }}
            >
              {copied ? "Nomor disalin" : "Salin nomor"}
            </Button>
            <a className="btn btn--tertiary btn--large btn--block clay clay-light t-p-h4-bold" href={wa} target="_blank" rel="noreferrer">
              <span>Buka WhatsApp</span>
              <Icon name="Message" size={20} />
            </a>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Speaker status on one line: avatar · name · status tag (· action). */
export function SpeakerRow({ name, status, help, icon, onResolve }: { name: string | null; icon?: IconName; status: "belum" | "siap" | "live" | "bantuan" | "selesai" | "mc"; help?: SpeakerHelp; onResolve?: () => void }) {
  return (
    <div className={`speaker-row clay clay-accent${status === "bantuan" ? " is-alert" : ""}`}>
      {icon ? (
        <span className="speaker-row__mc clay clay-light">
          <Icon name={icon} size={16} />
        </span>
      ) : name ? (
        <Avatar initial={name.charAt(0)} size="S" />
      ) : (
        <span className="speaker-row__mc clay clay-light">
          <Icon name="Megaphone" size={16} />
        </span>
      )}
      <span className="t-p-h4-bold speaker-row__name">{status === "bantuan" && onResolve && name ? name.split(" ")[0] : (name ?? "Tanpa performance")}</span>
      {status === "live" && <PersonTag icon="Megaphone">Sedang bicara</PersonTag>}
      {status === "siap" && <PersonTag icon="Check" tone="ok">Siap</PersonTag>}
      {status === "belum" && <PersonTag dot>Belum siap</PersonTag>}
      {status === "selesai" && <Badge type="done">Selesai</Badge>}
      {status === "mc" && <PersonTag icon="Megaphone">Dipandu MC</PersonTag>}
      {status === "bantuan" && <Badge type="danger" icon="Bell">{`Bantuan: ${HELP_SHORT[help ?? "lainnya"]}`}</Badge>}
      {status === "bantuan" && onResolve && (
        <button type="button" className="speaker-row__ok clay clay-light" aria-label="Tandai beres" title="Tandai beres" onClick={onResolve}>
          <Icon name="Check" size={18} />
        </button>
      )}
    </div>
  );
}

/** Tag about a person (speaker / MC). Cream, so it never matches the session status tag at the top of the card. */
function PersonTag({ icon, tone, dot, children }: { icon?: IconName; tone?: "ok"; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`person-tag${tone ? ` person-tag--${tone}` : ""} clay clay-light t-p-h5-bold`}>
      {dot && <span className="person-tag__dot" />}
      {icon && <Icon name={icon} size={16} />}
      {children}
    </span>
  );
}

/** Room / PIC / time as soft tags on the orange card. */
export function MetaTags({ items }: { items: { icon: IconName; text: string }[] }) {
  return (
    <span className="meta-tags">
      {items.map((m) => (
        <span key={m.text} className="meta-tag clay clay-accent t-p-h5-bold">
          <Icon name={m.icon} size={16} />
          {m.text}
        </span>
      ))}
    </span>
  );
}

/** Option card in the help sheets: ink card, cream icon. */
export function InkOption({ icon, title, body, urgent, onClick }: { icon: IconName; title: string; body: string; urgent?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="tpl tpl--ink clay clay-dark" onClick={onClick}>
      <span className="tpl__icon">
        <Icon name={icon} size={18} />
        {urgent && <span className="tpl__dot" />}
      </span>
      <span className="tpl__text">
        <span className="t-p-h4-bold">{title}</span>
        <span className="t-p-h5 tpl__sub">{body}</span>
      </span>
      <Icon name="ChevronRight" size={20} />
    </button>
  );
}
