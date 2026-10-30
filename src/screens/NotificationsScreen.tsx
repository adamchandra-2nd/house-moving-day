import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Icon } from "../components/Icon";
import { formatTime } from "../data/agenda";
import { NOTICE_KIND, type GuestNotice } from "../data/notifications";
import "./NotificationsScreen.css";

type Props = {
  notices: GuestNotice[];
  onBack: () => void;
  onReadAll: () => void;
  /** Marks it read and goes where it points (Agenda, Galeri, a room…). */
  onOpen: (n: GuestNotice) => void;
};

/** Notifikasi: every toast worth reading again (committee announcements included), newest first. */
export function NotificationsScreen({ notices, onBack, onReadAll, onOpen }: Props) {
  const sorted = [...notices].sort((a, b) => b.at - a.at);
  const unread = notices.filter((n) => !n.read).length;

  return (
    <div className="overlay-screen screen-enter">
      <div className="page__scroll notif">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <span className="t-p-h3-bold">Notifikasi</span>
          {unread > 0 && (
            <span className="notif__read-all">
              <Button size="small" style="tertiary" icon="CheckDouble" onClick={onReadAll}>
                Tandai dibaca
              </Button>
            </span>
          )}
        </div>
        <p className="t-p-h5 page__sub">
          {unread > 0 ? `${unread} belum dibaca. ` : ""}Pengumuman panitia, jadwal, galeri, hadiah dan pertanyaanmu.
        </p>

        {sorted.length === 0 ? (
          <section className="card notif__empty">
            <div className="notif__empty-art">
              <Character say="Masih sepi…" />
            </div>
            <h3 className="t-p-h3-bold panel__title">Belum ada notifikasi</h3>
            <p className="t-p-h5 panel__body">Pengumuman dari panitia dan kabar soal acara akan muncul di sini.</p>
          </section>
        ) : (
          <ul className="notif__list">
            {sorted.map((n) => {
              const kind = NOTICE_KIND[n.kind];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif__item${n.read ? "" : " is-unread"}`}
                    onClick={() => onOpen(n)}
                    aria-label={`${n.read ? "" : "Belum dibaca. "}${kind.label}: ${n.title}`}
                  >
                    <span className={`notif__icon clay ${n.kind === "pengumuman" ? "clay-accent is-accent" : "clay-dark"}`}>
                      <Icon name={kind.icon} size={20} />
                    </span>
                    <span className="notif__text">
                      <span className="notif__meta t-p-h5">
                        <span className="notif__kind">{kind.label}</span>
                        <span>{formatTime(n.at)}</span>
                      </span>
                      <span className="t-p-h4-bold">{n.title}</span>
                      <span className="t-p-h5 notif__body">{n.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
