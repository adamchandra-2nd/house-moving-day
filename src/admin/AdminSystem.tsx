import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Icon } from "../components/Icon";
import workroom from "../assets/rooms/ruang-kerja-utama.webp";

type Kind = "error" | "404" | "offline";
const COPY: Record<Kind, { title: string; body: string; cta: string }> = {
  error: {
    title: "Ups, ada yang tidak beres",
    body: "Server tidak merespons. Data tamu tetap aman.",
    cta: "Coba lagi",
  },
  "404": {
    title: "Halaman tidak ditemukan",
    body: "Link ini tidak ada di HMD Admin.",
    cta: "Ke Dashboard",
  },
  offline: {
    title: "Koneksi terputus",
    body: "Perubahan disimpan otomatis begitu kamu online lagi.",
    cta: "Coba lagi",
  },
};

/** Full-page admin states. */
export function AdminSystem({
  kind,
  onAction,
}: {
  kind: Kind;
  onAction: () => void;
}) {
  const c = COPY[kind];
  return (
    <main
      className="admin-login"
      style={{ "--login-bg": `url(${workroom})` } as React.CSSProperties}
    >
      <section className="admin-login__card clay clay-light">
        <div
          className={`admin-login__art${kind === "404" ? "" : " admin-login__art--icon"}`}
        >
          {kind === "404" ? (
            <Character say="Kok nyasar?" />
          ) : (
            <span
              className={`system-state__icon clay ${kind === "error" ? "clay-accent system-state__icon--error" : "clay-dark"}`}
            >
              <Icon name={kind === "error" ? "Close" : "WifiOff"} size={40} />
            </span>
          )}
        </div>
        <div className="admin-login__form">
          <h1 className="admin-title">{c.title}</h1>
          <p className="t-p-h4 admin-sub">{c.body}</p>
          <Button block icon="ArrowRight" onClick={onAction}>
            {c.cta}
          </Button>
        </div>
      </section>
    </main>
  );
}

/** Thin banner when the admin goes offline mid-session. */
export function AdminOfflineBanner() {
  return (
    <div className="rundown-banner is-error t-p-h5-bold" role="status">
      <Icon name="WifiOff" size={16} />
      Kamu offline. Data yang tampil mungkin belum terbaru, dan perubahan akan
      dikirim saat online lagi.
    </div>
  );
}
