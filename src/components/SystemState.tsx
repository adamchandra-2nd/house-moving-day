import { useEvent } from "../data/eventContext";
import { Button } from "./Button";
import { Character } from "./Character";
import { Icon } from "./Icon";
import "./SystemState.css";

type SystemStateProps = {
  type: "loading" | "error" | "offline";
  onRetry?: () => void;
  /**
   * Overrides for cases where the generic copy would mislead. A revoked invite
   * link is not "coba lagi sebentar" -- retrying never helps, and the guest
   * needs to be told to ask the committee instead.
   */
  title?: string;
  sub?: string;
};

const COPY = {
  loading: { title: "Sebentar ya…", body: "Lagi menyiapkan rumah baru Potara." },
  error: { title: "Ups, ada yang tidak beres", body: "Coba lagi sebentar. Kalau masih gagal, minta bantuan panitia." },
  offline: { title: "Koneksi terputus", body: "Progresmu aman tersimpan. Sambungkan internet lalu coba lagi." },
};

/** 0812…, +62 812… or 62812… all become the 62812… that wa.me wants. */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("62") ? d : `62${d.replace(/^0/, "")}`;
};

/** Figma: System State — full-screen loading, error and offline. */
export function SystemState({ type, onRetry, title, sub }: SystemStateProps) {
  const c = { title: title ?? COPY[type].title, body: sub ?? COPY[type].body };
  /**
   * Every error here ends in "minta bantuan panitia", so it gets a way to do
   * that: the committee member on call, from Pengaturan. Hidden until a
   * number is set -- an empty WhatsApp chat helps nobody.
   */
  const { contact } = useEvent();
  const phone = type === "error" ? contact.phone.trim() : "";
  return (
    <main className="flow system-state screen-enter">
      <div className="flow__top" />
      <div className="flow__stage">
        {type === "loading" ? (
          <Character />
        ) : (
          <span className={`system-state__icon clay ${type === "error" ? "clay-accent system-state__icon--error" : "clay-dark"}`}>
            <Icon name={type === "error" ? "Close" : "WifiOff"} size={40} />
          </span>
        )}
      </div>
      <div className="flow__bottom">
        <section className="panel glass system-state__panel">
          <h1 className="t-display-h6 panel__title">{c.title}</h1>
          <p className="t-p-h4 panel__body">{c.body}</p>
          {type === "loading" ? (
            <span className="system-state__dots" aria-label="Memuat">
              <span />
              <span />
              <span />
            </span>
          ) : (
            // No retry handler means retrying cannot help (a dead invite link,
            // no link at all): a button that does nothing is worse than none.
            (onRetry || phone) && (
              <div className="panel__actions">
                {onRetry && (
                  <Button block icon="ArrowRight" onClick={onRetry}>
                    Coba lagi
                  </Button>
                )}
                {phone && (
                  <a
                    className="btn btn--tertiary btn--large btn--block clay clay-light t-p-h3-bold"
                    href={`https://wa.me/${waNumber(phone)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>Hubungi {contact.name.trim() || "panitia"}</span>
                    <Icon name="Headset" size={24} />
                  </a>
                )}
              </div>
            )
          )}
        </section>
      </div>
    </main>
  );
}

/** Thin offline banner for screens that keep working with cached data. */
export function OfflineBanner() {
  return (
    <div className="offline-banner clay clay-dark t-p-h5-bold" role="status">
      <Icon name="WifiOff" size={16} />
      Kamu offline. Data terakhir tetap bisa dilihat.
    </div>
  );
}
