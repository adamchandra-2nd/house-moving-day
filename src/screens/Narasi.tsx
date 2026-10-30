import { useEffect, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { STORY } from "../data/story";
import { ROOMS } from "../data/rooms";
import "./Narasi.css";

/** Each chapter plays for this long before moving on, like Instagram Stories. */
const CHAPTER_MS = 6500;

/**
 * Potara's story told as short chapters: Stories-style progress, tap right/left to move,
 * the character narrating, and a closing chapter that leads into customisation.
 */
export function Narasi({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STORY.length - 1;
  const c = STORY[i];

  useEffect(() => {
    if (last) return;
    const t = window.setTimeout(() => setI((n) => n + 1), CHAPTER_MS);
    return () => clearTimeout(t);
  }, [i, last]);

  const onTap = (e: React.MouseEvent<HTMLElement>) => {
    const left = e.clientX - e.currentTarget.getBoundingClientRect().left < e.currentTarget.clientWidth / 3;
    if (left) setI(Math.max(0, i - 1));
    else if (!last) setI(i + 1);
  };

  return (
    <main className="flow narasi" onClick={onTap}>
      {STORY.map((s, idx) => (
        <div
          key={idx}
          className={`flow__bg narasi__bg${idx === i ? " is-active" : ""}`}
          style={{ backgroundImage: `url(${ROOMS[s.room].image})` }}
        />
      ))}

      <div className="flow__top narasi__top">
        <div className="narasi__progress" aria-label={`Bab ${i + 1} dari ${STORY.length}`}>
          {STORY.map((_, idx) => (
            <span key={idx} className="narasi__seg">
              <span
                key={idx === i ? `on-${i}` : idx}
                className={`narasi__fill${idx < i ? " is-done" : idx === i ? " is-playing" : ""}${idx === i && last ? " is-done" : ""}`}
                style={{ animationDuration: `${CHAPTER_MS}ms` }}
              />
            </span>
          ))}
        </div>
        {!last && (
          <button
            type="button"
            className="narasi__skip glass t-p-h5-bold"
            onClick={(e) => {
              e.stopPropagation();
              onDone();
            }}
          >
            Lewati
          </button>
        )}
      </div>

      <div className="flow__stage">
        <Character key={i} say={c.say} />
      </div>

      <div className="flow__bottom">
        <section key={i} className="panel glass narasi__panel">
          <span className="agenda-card__tags">
            <Badge type="next">{c.chapter}</Badge>
          </span>
          <h1 className="t-display-h6 panel__title">{c.title}</h1>
          <p className="t-p-h4 panel__body">{c.body}</p>
          {last ? (
            <div className="panel__actions">
              <Button block icon="ArrowRight" onClick={onDone}>
                Buat karaktermu
              </Button>
            </div>
          ) : (
            <span className="t-p-h5 narasi__hint">Tap untuk lanjut</span>
          )}
        </section>
      </div>
    </main>
  );
}
