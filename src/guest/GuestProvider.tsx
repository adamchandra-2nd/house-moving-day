import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { api, fromWire } from "../data/adapters";
import { AGENDA, setAgenda } from "../data/agenda";
import { useRundownMinute } from "../data/clock";
import { EventContext, type EventInfo } from "../data/eventContext";
import { useAgendaQuery, useQuestionsQuery } from "../data/queries";
import { queryClient } from "../data/queryClient";
import type { AskedQuestion } from "../data/questions";
import { EVENT } from "../config";
import { SCENARIOS } from "../routing/scenarios";
import { SCENARIO_PARAM } from "../routing/paths";
import { GuestContext, type GuestContextValue, type PageToast } from "./guestContext";
import { loadToken, saveToken } from "./session";
import { INITIAL, flushProgress, resumeState, saveProgress, type GuestState } from "./state";

const scenarioFor = (token: string | null) => (token ? SCENARIOS[token] : undefined);

/**
 * Server questions plus the ones this phone sent that the server has not
 * echoed back yet (queued offline, or still in flight). Those carry a
 * "local-" id until then; once the server's copy arrives, it replaces them.
 */
function mergeQuestions(server: AskedQuestion[], local: AskedQuestion[]): AskedQuestion[] {
  const pending = local.filter(
    (q) => q.id.startsWith("local-") && !server.some((s) => s.mine && s.eventId === q.eventId && s.text === q.text),
  );
  return [...server, ...pending];
}

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [params] = useSearchParams();
  const { pathname, hash } = useLocation();
  // An old `#token` review link is rewritten to ?demo= by ScenarioGate, but
  // only after this first render -- read it here too so the live session
  // never starts up underneath a review case.
  const token = params.get(SCENARIO_PARAM) ?? (hash.replace(/^#/, "") || null);

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
  const [demo, setDemo] = useState(isDemo.current);
  const lastToken = useRef(token);

  /** The invite this session belongs to; changes when another link is opened. */
  const [session, setSession] = useState<string | null>(() => loadToken());

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
    setDemo(true);
    setState({ ...INITIAL, ...s.state });
    setToast(null);
  }, [token]);

  // Review cases run on the sample rundown; everything live reads the server's.
  useEffect(() => {
    if (demo) setAgenda(AGENDA);
  }, [demo]);

  const live = !demo && Boolean(session);
  useAgendaQuery(live);

  /** The real clock, outside review cases (which pin their own `now`). */
  const minute = useRundownMinute();
  useEffect(() => {
    if (!isDemo.current) setState((s) => (s.now === minute ? s : { ...s, now: minute }));
  }, [minute]);

  /**
   * Questions from the server, so the MC reading or answering one shows up on
   * the guest's phone. Polled in data/queries.ts.
   */
  const serverQuestions = useQuestionsQuery(live);
  useEffect(() => {
    if (!live || !serverQuestions) return;
    setState((s) => ({ ...s, questions: mergeQuestions(serverQuestions, s.questions) }));
  }, [live, serverQuestions]);

  /**
   * Banks a token from an invite link. Opening a different guest's link on
   * this phone starts that guest's session from scratch: their own saved
   * progress (if any), and none of the previous guest's cached reads or
   * queued writes, which would otherwise be sent with the new token.
   */
  const startSession = useCallback((next: string) => {
    const previous = loadToken();
    const wasDemo = isDemo.current;
    saveToken(next);
    // An invite link is never a review case, even in a tab that was one.
    isDemo.current = false;
    setDemo(false);
    if (previous === next && !wasDemo) return;
    if (previous !== next) {
      flushProgress();
      queryClient.clear();
    }
    setAgenda([]);
    setState(resumeState());
    setSession(next);
  }, []);

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
          contact: e.contact ?? EVENT.contact,
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

  // Once per invite: re-runs when startSession() switches to another one, or
  // leaves a review case. Then re-read every 30 s and on focus, so what the
  // committee or another phone changed -- the prize handed over, a card
  // collected, the survey sent -- shows up without a reload.
  useEffect(() => {
    if (demo || !session) return;

    let alive = true;
    let first = true;
    const load = async () => {
      try {
        const [invite, cards] = await Promise.all([api.invite(), api.cards()]);
        if (!alive) return;
        const fromServer = Object.fromEntries(cards.map((c) => [c.guestId, c.note]));
        const initial = first;
        first = false;
        setState((s) => ({
          ...s,
          guestId: invite.guestId,
          name: invite.name,
          code: invite.code,
          // Only on the first read: a later one could land between "selesai"
          // and the server storing it, and put the old character back.
          outfit: initial ? fromWire(invite.outfit) : s.outfit,
          // A re-read keeps cards this phone collected that are still queued.
          collected: initial ? fromServer : { ...fromServer, ...s.collected },
          // The committee's switch, not the bundle's constant. Sent with the
          // invite as well as on /api/event so a guest who opens their link
          // gets both in one trip.
          countdownEnabled: invite.countdown,
          // Only when the server says so: an older API without these fields
          // leaves what this phone remembers.
          rewardClaimed: invite.rewardClaimed ?? s.rewardClaimed,
          // Either side saying "sent" wins: a survey sent offline is still
          // queued on this phone, and must not be asked for a second time.
          feedbackSent: Boolean(invite.finalFeedback) || s.feedbackSent,
          // Sessions rated on another phone count as rated here too. The
          // server does not say what they were rated, and only "rated or not"
          // is read anywhere, so 0 stands in; this phone's own ratings stay.
          eventFeedback: {
            ...Object.fromEntries((invite.ratedEvents ?? []).map((id) => [id, 0])),
            ...s.eventFeedback,
          },
        }));
        if (invite.event?.contact) {
          const contact = invite.event.contact;
          setEvent((e) => ({ ...e, contact }));
        }
      } catch {
        // See above.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const onFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [session, demo]);

  /**
   * The real connection, outside review cases (which set `offline` to show
   * the banner). Only the plain banner: the ask and rating forms queue their
   * writes offline, so blocking them on it would trap a guest behind a
   * required rating -- their offline variants stay review-only.
   */
  useEffect(() => {
    if (demo) return;
    const sync = () => setState((s) => (s.offline === !navigator.onLine ? s : { ...s, offline: !navigator.onLine }));
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [demo]);

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

  const value = useMemo<GuestContextValue>(
    () => ({ state, set, toast, showToast, demo, session, startSession }),
    [state, set, toast, showToast, demo, session, startSession],
  );

  return (
    <EventContext.Provider value={event}>
      <GuestContext.Provider value={value}>{children}</GuestContext.Provider>
    </EventContext.Provider>
  );
}
