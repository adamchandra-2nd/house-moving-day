import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SystemState } from "./components/SystemState";
import {
  AppRoute,
  CheckInRoute,
  CountdownRoute,
  CustomizeRoute,
  DoorRoute,
  GuestShell,
  NarasiRoute,
  RsvpRoute,
  StartRoute,
  ThanksRoute,
} from "./guest/routes";
import { InviteRoute } from "./guest/InviteRoute";
import { FLOW, INVITE_PATH, STAGE, tabPath } from "./routing/paths";
import { ScenarioGate } from "./routing/ScenarioGate";

/**
 * Admin, the stage sides and the review hub are lazy: none of them is the
 * guest app, and a guest on event wifi should not pay for them. Everything the
 * guest flow needs stays in the first chunk, so the flow itself never waits on
 * a second request.
 */
const AdminRoute = lazy(() => import("./admin/AdminRoute"));
const StageRoute = lazy(() => import("./stage/StageRoute"));
const ReviewRoute = lazy(() =>
  import("./screens/Review").then((m) => ({ default: m.Review })),
);

export default function App() {
  return (
    <>
      <ScenarioGate />
      {/* One crash in one panel used to unmount the whole app and leave a
          blank page. Now it says what broke and offers a reload. */}
      <ErrorBoundary label="app">
        <Suspense fallback={<SystemState type="loading" />}>
          <Routes>
            <Route element={<GuestShell />}>
              {/* The personal link. It banks the token and forwards, so it has
                to sit inside GuestShell: what it forwards to is guest flow. */}
              <Route path={INVITE_PATH} element={<InviteRoute />} />
              <Route path={FLOW.rsvp} element={<RsvpRoute />} />
              <Route path={FLOW.thanks} element={<ThanksRoute />} />
              <Route path={FLOW.countdown} element={<CountdownRoute />} />
              <Route path={FLOW.start} element={<StartRoute />} />
              <Route path={FLOW.checkin} element={<CheckInRoute />} />
              <Route path={FLOW.door} element={<DoorRoute />} />
              <Route path={FLOW.narasi} element={<NarasiRoute />} />
              <Route path={FLOW.customize} element={<CustomizeRoute />} />
              <Route
                path="/app"
                element={<Navigate to={tabPath("ruangan")} replace />}
              />
              <Route path="/app/:tab" element={<AppRoute />} />
            </Route>
            <Route path="/review" element={<ReviewRoute />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/admin/:page" element={<AdminRoute />} />
            <Route path={STAGE.mc} element={<StageRoute side="mc" />} />
            <Route
              path={`${STAGE.mc}/:tab`}
              element={<StageRoute side="mc" />}
            />
            <Route
              path={STAGE.performance}
              element={<StageRoute side="performance" />}
            />
            <Route
              path={`${STAGE.performance}/:tab`}
              element={<StageRoute side="performance" />}
            />
            <Route path="*" element={<Navigate to={FLOW.rsvp} replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
