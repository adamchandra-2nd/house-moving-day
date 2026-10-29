import "./Dots.css";

/** Figma: Slide Indicator/Dot — clay pagination dots; the active one stretches. */
export function Dots({ index, total, label }: { index: number; total: number; label: string }) {
  return (
    <span className="dots" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`dots__dot${i === index ? " is-active" : ""}`} />
      ))}
    </span>
  );
}
