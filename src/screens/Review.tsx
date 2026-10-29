import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { REVIEW_GROUPS } from "../data/reviewLinks";
import { linkFor } from "../routing/scenarios";
import "./Review.css";

/** Review hub (not part of the guest flow): every screen and case as a direct link. */
export function Review() {
  const total = REVIEW_GROUPS.reduce((n, g) => n + g.links.length, 0);
  return (
    <main className="page">
      <div className="page__scroll review">
        <header className="page__header">
          <h1 className="t-display-h6 page__title">Semua screen</h1>
          <p className="t-p-h5 page__sub">{total} screen & case HMD Event Companion. Tap untuk membuka, kembali ke sini lewat /review.</p>
        </header>
        {REVIEW_GROUPS.map((g) => (
          <section key={g.title} className="review__group">
            <h2 className="t-p-h5-bold section-label">{g.title}</h2>
            <div className="list">
              {g.links.map((l) => (
                <Link key={l.token} className="card review__link" to={linkFor(l.token)}>
                  <span className="review__text">
                    <span className="t-p-h4-bold">{l.label}</span>
                    <span className="t-p-h5 review__note">{l.note}</span>
                  </span>
                  <Icon name="ChevronRight" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
