import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resumePath } from "../guest/state";
import { SCENARIO_PARAM } from "./paths";
import { SCENARIOS, adminPathFor, isAdminToken, isStageToken, stagePathFor } from "./scenarios";

/**
 * Keeps the URL honest, in three jobs:
 *
 * 1. Old review links (`#ruangan-hadiah`, `#admin-rundown`, `#mc-panggung`)
 *    become the new form, so every link that was ever shared still opens the
 *    same case.
 * 2. A `?demo=` token that landed on the wrong path is moved to its own path.
 * 3. A returning guest opening "/" is sent back to where they left off.
 */
export function ScenarioGate() {
  const { hash, pathname, search } = useLocation();
  const navigate = useNavigate();
  const resumed = useRef(false);

  useEffect(() => {
    const token = hash.replace(/^#/, "");
    if (!token) return;
    if (isAdminToken(token)) {
      navigate(`${adminPathFor(token)}?${SCENARIO_PARAM}=${token}`, { replace: true });
      return;
    }
    if (isStageToken(token)) {
      navigate(`${stagePathFor(token)}?${SCENARIO_PARAM}=${token}`, { replace: true });
      return;
    }
    const scenario = SCENARIOS[token];
    // An unknown hash just gets dropped rather than sending the guest elsewhere.
    navigate(scenario ? `${scenario.path}?${SCENARIO_PARAM}=${token}` : pathname, { replace: true });
  }, [hash, pathname, navigate]);

  useEffect(() => {
    if (hash) return;
    const token = new URLSearchParams(search).get(SCENARIO_PARAM);
    if (!token) return;
    const scenario = SCENARIOS[token];
    if (scenario && scenario.path !== pathname) {
      navigate(`${scenario.path}?${SCENARIO_PARAM}=${token}`, { replace: true });
    }
  }, [hash, search, pathname, navigate]);

  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    if (hash || pathname !== "/" || search) return;
    const saved = resumePath();
    if (saved && saved !== "/") navigate(saved, { replace: true });
  }, [hash, pathname, search, navigate]);

  return null;
}
