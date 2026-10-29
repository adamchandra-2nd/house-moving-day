import { useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { StarRating } from "../components/StarRating";
import { TextField } from "../components/TextField";
import { formatTime, type AgendaItem } from "../data/agenda";
import "./EventFeedback.css";

type Props = {
  event: AgendaItem;
  roomName: string;
  /** Sending fails (no connection). */
  offline: boolean;
  onSubmit: (rating: number, text: string) => void;
};

/**
 * Per-event feedback, required right after an event ends: one rating + one question, always anonymous.
 * No close button on purpose; it comes before the "move to the next room" notice.
 */
export function EventFeedback({ event, roomName, offline, onSubmit }: Props) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const ready = rating > 0 && text.trim().length > 0;

  const submit = () => {
    if (offline) return setError(true);
    onSubmit(rating, text.trim());
  };

  return (
    <main className="page screen-enter">
      <div className="page__scroll">
        <section className="card">
          <span className="agenda-card__tags">
            <Badge type="done">Baru selesai</Badge>
            <Badge type="room">{roomName}</Badge>
          </span>
          <h1 className="t-display-h6 panel__title">{event.title}</h1>
          <span className="t-p-h5 event-feedback__meta">
            {formatTime(event.start)}–{formatTime(event.end)}
          </span>
        </section>

        <section className="card event-feedback__form">
          <h2 className="t-display-h6 panel__title event-feedback__question">Gimana menurutmu {event.title}?</h2>
          <StarRating value={rating} onChange={setRating} label={`Rating ${event.title}`} />
          <TextField
            label="Ceritakan singkat"
            value={text}
            onChange={(v) => {
              setError(false);
              setText(v);
            }}
            placeholder="Apa yang kamu suka, atau yang bisa lebih baik?"
            multiline
            maxLength={280}
            error={error ? "Gagal terkirim. Cek koneksimu, lalu kirim lagi." : undefined}
          />
        </section>

        <p className="event-feedback__anon t-p-h5">
          <Icon name="Lock" size={16} />
          Feedback ini anonim. Namamu tidak ikut tercatat.
        </p>
      </div>

      <div className="page__bottom question__bottom">
        <Button block icon="ArrowRight" disabled={!ready} onClick={submit}>
          {error ? "Kirim lagi" : "Kirim feedback"}
        </Button>
      </div>
    </main>
  );
}
