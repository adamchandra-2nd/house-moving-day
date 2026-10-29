import { useParams, useSearchParams } from "react-router-dom";
import { SCENARIO_PARAM } from "../routing/paths";
import { AdminApp } from "./AdminApp";
import { ADMIN_LINKS } from "./links";

/**
 * Default export so the whole admin side can be a lazy chunk: a guest on a
 * phone never downloads it.
 *
 * AdminApp still takes a scenario token, so the path picks the page and
 * ?demo= can pin an exact case (sesi-habis, rundown-bentrok, 404…).
 */
export default function AdminRoute() {
  const [params] = useSearchParams();
  const { page } = useParams<{ page?: string }>();

  const demo = params.get(SCENARIO_PARAM);
  const fromPage = page ? `admin-${page}` : null;

  let token = "admin";
  if (demo && demo in ADMIN_LINKS) token = demo;
  else if (fromPage && fromPage in ADMIN_LINKS) token = fromPage;

  // Only an explicit ?demo= is a review case. A plain /admin/<page> is the
  // real thing: the path picks which page opens, not which sample data to
  // show, so deep-linking to /admin/undangan must still read from the API.
  const live = !(demo && demo in ADMIN_LINKS);

  // Remount per case so each review link starts from a clean admin state.
  return <AdminApp key={token} token={token} live={live} />;
}
