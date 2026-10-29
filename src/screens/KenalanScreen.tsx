import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { GuestCard } from "../components/GuestCard";
import { Icon } from "../components/Icon";
import type { RewardState } from "../components/RoomHeader";
import { KENALAN_TARGET } from "../config";
import { GUESTS, type Guest } from "../data/guests";
import "./KenalanScreen.css";

type Props = {
  guests: Guest[];
  collected: Record<string, string>;
  reward: RewardState;
  onOpenGuest: (guest: Guest) => void;
  onMyQr: () => void;
  onReward: () => void;
};

/** Kenalan: progress toward the reward + guests who are here now, as character cards. */
export function KenalanScreen({ guests, collected, reward, onOpenGuest, onMyQr, onReward }: Props) {
  const ids = Object.keys(collected);
  const count = ids.length;
  const slots = Array.from({ length: KENALAN_TARGET }, (_, i) => GUESTS.find((g) => g.id === ids[i]));

  return (
    <div className="page__scroll screen-enter">
      <header className="page__header kenalan__header">
        <div className="kenalan__title-row">
          <h1 className="t-display-h6 page__title">Kenalan</h1>
          <Button size="small" style="secondary" icon="Scan" onClick={onMyQr}>
            QR-ku
          </Button>
        </div>
        <p className="t-p-h5 page__sub">Ngobrol dengan tamu, tanyakan pertanyaan di kartunya, lalu scan QR mereka untuk menyimpan kartu.</p>
      </header>

      {/* Figma: Kenalan Progress */}
      <section className="kenalan-progress clay clay-accent">
        <div className="kenalan-progress__head">
          <span className="t-p-h4-bold">
            {reward === "claimed" ? "Hadiah sudah diambil" : reward === "ready" ? "Hadiahmu menunggu!" : `${count} dari ${KENALAN_TARGET} kartu`}
          </span>
          <Icon name={reward === "claimed" ? "Check" : "Gift"} />
        </div>
        <div className="kenalan-progress__slots">
          {slots.map((g, i) => (
            <span key={i} className={`kenalan-progress__slot${g ? " is-filled" : ""}`}>
              {g ? <Avatar initial={g.name.charAt(0)} size="S" /> : <span className="t-p-h5-bold">{i + 1}</span>}
            </span>
          ))}
        </div>
        {reward === "collecting" && (
          <span className="t-p-h5 kenalan-progress__hint">Kumpulkan {KENALAN_TARGET} kartu untuk dapat hadiah dari Potara.</span>
        )}
        {reward === "ready" && (
          <Button block size="small" style="secondary" icon="Gift" onClick={onReward}>
            Tukar hadiah
          </Button>
        )}
        {reward === "claimed" && (
          <span className="kenalan-progress__claimed">
            <Badge type="claimed">Lengkap</Badge>
            <span className="t-p-h5">Terima kasih sudah seru-seruan bareng!</span>
          </span>
        )}
      </section>

      <h2 className="t-p-h5-bold section-label">Hadir sekarang · {guests.length} tamu</h2>
      {guests.length === 0 ? (
        <section className="card kenalan-empty">
          <div className="kenalan-empty__art">
            <Character say="Belum ada yang datang…" />
          </div>
          <h3 className="t-p-h3-bold panel__title">Kamu yang pertama hadir!</h3>
          <p className="t-p-h5 panel__body">Kami kabari begitu tamu lain datang. Sambil menunggu, jelajahi ruangan dulu ya.</p>
        </section>
      ) : (
        <div className="guest-grid">
          {guests.map((g) => (
            <GuestCard key={g.id} guest={g} collected={g.id in collected} onOpen={() => onOpenGuest(g)} />
          ))}
        </div>
      )}
    </div>
  );
}
