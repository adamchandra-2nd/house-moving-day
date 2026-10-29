import { Icon } from "./Icon";
import "./StarRating.css";

const LABELS = ["", "Kurang", "Lumayan", "Oke", "Seru", "Seru banget!"];

/** Figma: Rating — five stars, tight, with a label underneath. */
export function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="star-rating">
      <div className="star-rating__stars" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} bintang`}
            className={`star-rating__star${n <= value ? " is-on" : ""}`}
            onClick={() => onChange(n)}
          >
            <Icon name={n <= value ? "StarFill" : "Star"} size={36} />
          </button>
        ))}
      </div>
      <span className="t-p-h5-bold star-rating__label">{value ? LABELS[value] : "Tap bintangnya"}</span>
    </div>
  );
}
