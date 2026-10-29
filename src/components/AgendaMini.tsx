import { Badge } from "./Badge";
import { Button } from "./Button";
import { Icon } from "./Icon";
import "./AgendaMini.css";

type AgendaMiniProps =
  | {
      type: "now";
      title: string;
      next?: string;
      room: string;
      here: boolean;
      onClick: () => void;
      onGoToRoom: () => void;
      /** Ask the speaker through the app; absent when the session has no Q&A. */
      onAsk?: () => void;
    }
  | {
      type: "between";
      title: string;
      /** Absent before the event day: "616 menit lagi" would count from midnight, not to the day. */
      minutesLeft?: number;
      /** When it starts, "10.15", shown instead of the minutes before the event day. */
      startLabel: string;
      room: string;
      here: boolean;
      onClick: () => void;
      onGoToRoom: () => void;
    }
  /** `feedbackSent`: the survey is in, so the button opens the memory card instead. */
  | { type: "ended"; feedbackSent?: boolean; onFeedback: () => void };

/** Figma: Agenda Mini — floating live-agenda summary. Now · Now Elsewhere · Between · Ended. */
export function AgendaMini(props: AgendaMiniProps) {
  if (props.type === "ended") {
    return (
      <div className="agenda-mini glass">
        <span className="agenda-mini__tags">
          <Badge type="done">Acara selesai</Badge>
        </span>
        <div className="agenda-mini__body">
          <span className="agenda-mini__icon clay clay-accent">
            <Icon name="Smile" size={20} />
          </span>
          <span className="agenda-mini__text">
            <span className="t-p-h3-bold">Terima kasih sudah datang!</span>
            <span className="t-p-h5 agenda-mini__next">
              {props.feedbackSent ? "Feedbackmu sudah terkirim." : "Ceritakan pengalamanmu hari ini."}
            </span>
          </span>
        </div>
        <Button block size="small" style="secondary" icon="ArrowRight" onClick={props.onFeedback}>
          {props.feedbackSent ? "Lihat memory card" : "Isi feedback"}
        </Button>
      </div>
    );
  }

  const between = props.type === "between";
  return (
    <div className="agenda-mini glass">
      <span className="agenda-mini__tags">
        {props.type === "between" ? (
          <Badge type="next">{props.minutesLeft === undefined ? `Mulai ${props.startLabel}` : `${props.minutesLeft} menit lagi`}</Badge>
        ) : (
          <Badge type="now">Sekarang</Badge>
        )}
        {props.here ? (
          <Badge type="room">Kamu di sini</Badge>
        ) : (
          <button type="button" className="agenda-mini__room" onClick={props.onGoToRoom} aria-label={`Pindah ke ${props.room}`}>
            <Badge type="room" arrow>
              {props.room}
            </Badge>
          </button>
        )}
      </span>
      <button type="button" className="agenda-mini__body" onClick={props.onClick}>
        <span className="agenda-mini__icon clay clay-accent">
          <Icon name={between ? "Clock" : "Sparkle"} size={20} />
        </span>
        <span className="agenda-mini__text">
          <span className="t-p-h3-bold">{props.title}</span>
          <span className="t-p-h5 agenda-mini__next">
            {props.type === "between" ? (
              props.minutesLeft === undefined ? "Sampai jumpa di hari H!" : "Sedang jeda, santai dulu ya"
            ) : props.next ? (
              <>
                Berikutnya: <span className="t-p-h5-bold">{props.next}</span>
              </>
            ) : (
              "Acara terakhir hari ini"
            )}
          </span>
        </span>
        <Icon name="ChevronRight" />
      </button>
      {props.type === "now" && props.onAsk && (
        <Button block size="small" style="tertiary" icon="Message" onClick={props.onAsk}>
          Tanya pembicara
        </Button>
      )}
    </div>
  );
}
