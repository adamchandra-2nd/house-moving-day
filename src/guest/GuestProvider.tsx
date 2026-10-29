import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { api, fromWire } from "../data/adapters";
import { EventContext, type EventInfo } from "../data/eventContext";
import { EVENT } from "../config";
import { SCENARIOS } from "../routing/scenarios";
import { SCENARIO_PARAM } from "../routing/paths";
import { GuestContext, type GuestContextValue, type PageToast } from "./guestContext";
import { loadToken } from "./session";
import { INITIAL, flushProgress, resumeState, saveProgress, type GuestState } from "./state";

const scenarioFor = (token: string | null) => (token ? SCENARIOS[token] : undefined);

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const token = params.get(SCENARIO_PARAM);
  const { pathname } = useLocation();

  // A scenario seeds the state on the first paint, so a review case never
  // flashes the live state before swapping.
  const [state, setState] = useState<GuestState>(() => {
    const s = scenarioFor(token);
    return s ? { ...INITIAL, ...s.state } : resumeState();
  });
  /**
   * The event as configured, starting from the bundled values so the first
   * paint is not blank and a review link with no server still reads right.
   */
  const [event, setEvent] = useState<EventInfo>(EVENT);
  const [toast, setToast] = useState<PageToast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  /**
   * Once a review scenario has been opened, this session stops writing progress:
   * jumping into "5 cards collected" must not become the guest's real state.
   * A reload clears it.
   */
  const isDemo = useRef(Boolean(scenarioFor(token)));
  const lastToken = useRef(token);

  const set = useCallback((patch: Partial<GuestState>) => setState((s) => ({ ...s, ...patch })), []);

  const showToast = useCallback((t: PageToast) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /**
   * Re-seed only when the token changes to another scenario. Navigating forward
   * drops ?demo= from the URL, and that must keep the state the case set up.
   */
  useEffect(() => {
    if (token === lastToken.current) return;
    lastToken.current = token;
    const s = scenarioFor(token);
    if (!s) return;
    isDemo.current = true;
    setState({ ...INITIAL, ...s.state });
    setToast(null);
  }, [token]);

  /**
   * Hydrate from the server once, if this browser is holding an invite token.
   *
   * The server is the authority on who the guest is and what they built: the
   * name on the invitation, and the character, which used to live only in
   * localStorage and so vanished on a second phone. Everything else in
   * GuestState stays local -- which room they are looking at, which overlay is
   * open -- because none of it is worth a round trip.
   *
   * Failures are deliberately silent here. InviteRoute is what tells a guest
   * their link is dead; this runs on every screen, and an error banner on all
   * of them would be noise. Offline, the resumed local state is what shows.
   */
  /**
   * The event itself, which needs no credential.
   *
   * Separate from the guest hydration below because it has to happen even
   * when this browser has never opened an invite link: from a bookmark, or
   * with the app installed from a previous visit. Without it those sessions
   * fell back to the values compiled into the bundle, which is how a
   * countdown the committee had switched off kept showing.
   */
  useEffect(() => {
    if (isDemo.current) return;
    let alive = true;
    void api
      .event()
      .then((e) => {
        if (!alive) return;
        setEvent({
          name: e.name,
          host: e.host,
          dateLabel: e.dateLabel,
          place: e.place,
          startsAt: e.startsAt ? new Date(e.startsAt) : EVENT.startsAt,
        });
        setState((s) => ({ ...s, countdownEnabled: e.countdown }));
      })
      .catch(() => {
        // Offline, or no server in a design review. The bundled values show,
        // which is what this screen showed before any of this existed.
      });
    return () => {
      alive = false;
    };
  }, []);

  const hydrated = useRef(false);
  useEffect(() => {
    if (isDemo.current || hydrated.current || !loadToken()) return;
    hydrated.current = true;

    let live = true;
    void (async () => {
      try {
        const [invite, cards] = await Promise.all([api.invite(), api.cards()]);
        if (!live) return;
        setState((s) => ({
          ...s,
          name: invite.name,
          outfit: fromWire(invite.outfit),
          collected: Object.fromEntries(cards.map((c) => [c.guestId, c.note])),
          // The committee's switch, not the bundle's constant. Sent with the
          // invite as well as on /api/event so a guest who opens their link
          // gets both in one trip.
          countdownEnabled: invite.countdown,
        }));
      } catch {
        // See above.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (isDemo.current) return;
    saveProgress(state, pathname);
  }, [state, pathname]);

  // The write is debounced, so flush it before the tab goes away.
  useEffect(() => {
    const flush = () => flushProgress();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  const value = useMemo<GuestContextValue>(() => ({ state, set, toast, showToast }), [state, set, toast, showToast]);

  return (
    <EventContext.Provider value={event}>
      <GuestContext.Provider value={value}>{children}</GuestContext.Provider>
    </EventContext.Provider>
  );
}
