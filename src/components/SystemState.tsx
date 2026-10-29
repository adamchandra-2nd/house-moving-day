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

/** Figma: System State — full-screen loading, error and offline. */
export function SystemState({ type, onRetry, title, sub }: SystemStateProps) {
  const c = { title: title ?? COPY[type].title, body: sub ?? COPY[type].body };
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
            <div className="panel__actions">
              <Button block icon="ArrowRight" onClick={onRetry}>
                Coba lagi
              </Button>
            </div>
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
