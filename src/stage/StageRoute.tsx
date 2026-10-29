import { useParams, useSearchParams } from "react-router-dom";
import { MC_TABS, PERF_TABS, SCENARIO_PARAM, STAGE_PREFIX, type StageSide } from "../routing/paths";
import { MC_LINKS, PERF_LINKS, type McTab, type PerfTab } from "./links";
import { McApp } from "./McApp";
import { PerformerApp } from "./PerformerApp";

/**
 * Default export so both stage sides are one lazy chunk: a guest on a phone
 * never downloads them, and neither does the admin on a desktop.
 *
 * The path picks the side and the tab to land on; only ?demo= picks a review
 * case (kode-salah, bantuan, lewat waktu…). /mc/pertanyaan used to open the
 * seeded "mc-pertanyaan" case, which put sample questions in front of a real
 * MC. The token stays the single input to McApp / PerformerApp, so
 * stage/links.ts remains the one place every case is described.
 */
export default function StageRoute({ side }: { side: StageSide }) {
  const [params] = useSearchParams();
  const { tab } = useParams<{ tab?: string }>();

  const links = side === "mc" ? MC_LINKS : PERF_LINKS;
  const prefix = STAGE_PREFIX[side];
  const demo = params.get(SCENARIO_PARAM);

  // Live ("mc" / "pembicara") is the default: a real sign-in, server data only.
  const token = demo && demo in links ? demo : prefix;

  // The tab in the path opens that tab of the live app; a review case's own
  // tab wins when it names one.
  const tabs: readonly string[] = side === "mc" ? MC_TABS : PERF_TABS;
  const urlTab = tab && tabs.includes(tab) ? tab : undefined;

  // Remount per case so each review link starts from a clean stage state.
  return side === "mc" ? (
    <McApp key={token} token={token} tab={urlTab as McTab | undefined} />
  ) : (
    <PerformerApp key={token} token={token} tab={urlTab as PerfTab | undefined} />
  );
}
