import type { ReactNode } from "react";
import { useEvent } from "../data/eventContext";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import "./EventCard.css";

type EventCardProps = {
  status?: ReactNode;
  /** Extra content under the event meta (question, countdown…), kept in the same top card. */
  children?: ReactNode;
};

/** Figma: Event Info — floating invite summary at the top of pre-event screens. */
export function EventCard({ status, children }: EventCardProps) {
  const EVENT = useEvent();
  return (
    <section className="event-card panel glass">
      <span className="event-card__tags">
        <Badge type="next">Undangan</Badge>
        {status}
      </span>
      <div className="event-card__body">
        <h1 className="t-display-h6 panel__title">{EVENT.name}</h1>
        <span className="event-card__meta t-p-h5">
          <span className="event-card__row">
            <Icon name="Calendar" size={16} />
            {EVENT.dateLabel}
          </span>
          <span className="event-card__row">
            <Icon name="MapPin" size={16} />
            {EVENT.place}
          </span>
        </span>
      </div>
      {children && <div className="event-card__extra">{children}</div>}
    </section>
  );
}
