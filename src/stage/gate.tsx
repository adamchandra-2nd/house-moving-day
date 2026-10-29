import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../data/http";
import potaraLogo from "../assets/potara-logo.png";
import { ROOMS } from "../data/rooms";
import { contactLabel, type Person } from "./data";
import { clearCache, fetchStagePerson, loadStageLink, loadStageMe, loadStageToken, saveStageLink, saveStageMe, setStageToken, STAGE_EXPIRED, STAGE_REVOKED } from "./remote";
import { ContactButton } from "./ui";
import "./stage.css";

type Role = Person["role"];

/**
 * Where a live stage screen stands before it may show anything.
 *
 * - in: a session for the right role; `me` is the person who signed in.
 * - login: a personal link was opened; ask that person for the code.
 * - revoked: the committee took this person off the stage (410); no code helps.
 * - no-link / unknown / mismatch / error: a screen of its own, nothing to sign in to.
 */
export type GateState =
  | { kind: "loading" }
  | { kind: "in"; me: Person }
  | { kind: "login"; person: Person }
  | { kind: "revoked" }
  | { kind: "no-link" }
  | { kind: "unknown" }
  | { kind: "mismatch"; person: Person }
  | { kind: "error" };

/**
 * The real sign-in for /mc and /pembicara.
 *
 * The committee sends each MC and speaker a personal link (/mc?p=<id>). The
 * id is kept, so a reload or an opened bookmark without it still knows who
 * this is; the code itself is checked by the server, which also reads the
 * role from the person record. A session that the server later refuses
 * (expired, revoked) comes back here through STAGE_EXPIRED.
 *
 * `enabled` is false for the review cases, which never touch any of this.
 */
export function useStageGate(role: Role, enabled: boolean) {
  const [state, setState] = useState<GateState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const side = role;
    const fromUrl = new URLSearchParams(window.location.search).get("p");
    if (fromUrl) saveStageLink(side, fromUrl);
    const p = fromUrl ?? loadStageLink(side);

    const me = loadStageMe();
    const session = loadStageToken() && me ? me : null;
    if (session && session.role === role && (!fromUrl || fromUrl === session.id)) {
      setState({ kind: "in", me: session });
      return;
    }
    if (!p) {
      // Signed in, but for the other side (an MC opening /pembicara).
      setState(session ? { kind: "mismatch", person: session } : { kind: "no-link" });
      return;
    }

    setState({ kind: "loading" });
    fetchStagePerson(p)
      .then((person) => {
        if (!alive) return;
        setState(person.role === role ? { kind: "login", person } : { kind: "mismatch", person });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // 410 is the committee's answer, not a hiccup: "Coba lagi" would
        // only ask again and get the same.
        setState(e instanceof ApiError && e.status === 404 ? { kind: "unknown" } : e instanceof ApiError && e.status === 410 ? { kind: "revoked" } : { kind: "error" });
      });
    return () => void (alive = false);
  }, [role, enabled, attempt]);

  // The server refused the session mid-event: back to the code screen. A
  // revoked one goes straight to its own screen rather than through the
  // lookup above, which would also work but costs a round trip and needs the
  // link to still be stored.
  useEffect(() => {
    if (!enabled) return;
    const onExpired = () => setAttempt((n) => n + 1);
    const onRevoked = () => setState({ kind: "revoked" });
    window.addEventListener(STAGE_EXPIRED, onExpired);
    window.addEventListener(STAGE_REVOKED, onRevoked);
    return () => {
      window.removeEventListener(STAGE_EXPIRED, onExpired);
      window.removeEventListener(STAGE_REVOKED, onRevoked);
    };
  }, [enabled]);

  /** After the code was accepted: keep who signed in, and drop any earlier demo's cached state. */
  const signedIn = useCallback((token: string, person: Person) => {
    setStageToken(token);
    saveStageMe(person);
    clearCache();
    setState({ kind: "in", me: person });
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, signedIn, retry };
}

/** The screens the gate shows instead of the login: same card as the login. */
export function StageNotice({ state, role }: { state: Exclude<GateState, { kind: "in" } | { kind: "login" } | { kind: "error" }>; role: Role }) {
  const isMc = role === "mc";
  const copy =
    state.kind === "loading"
      ? { title: "Sebentar…", body: "Membuka link pribadimu." }
      : state.kind === "no-link"
        ? { title: "Buka link pribadi dari panitia", body: `Halaman ${isMc ? "MC" : "pembicara"} hanya bisa dibuka lewat link yang dikirim panitia ke WhatsApp-mu.` }
        : state.kind === "revoked"
          ? { title: "Link ini sudah tidak berlaku", body: "Aksesmu sudah dicabut panitia, atau acaranya sudah selesai. Kalau ini keliru, hubungi panitia." }
          : state.kind === "unknown"
            ? { title: "Link ini sudah tidak berlaku", body: "Namamu tidak ada di daftar pengisi acara. Mungkin panitia baru mengubahnya, hubungi panitia untuk link baru." }
            : {
                title: "Link ini untuk sisi lain",
                body: `${state.person.name} terdaftar sebagai ${state.person.role === "mc" ? "MC" : "pembicara"}, bukan ${isMc ? "MC" : "pembicara"}. Buka link yang dikirim panitia untukmu.`,
              };
  return (
    <main className="stage-login screen-enter" style={{ backgroundImage: `url(${ROOMS[isMc ? 0 : 4].image})` }}>
      <section className="stage-login__card">
        <img className="stage-login__logo" src={potaraLogo} alt="Potara" />
        <div className="stage-login__head">
          <h1 className="stage-login__title">{copy.title}</h1>
          <p className="t-p-h4 stage-login__body">{copy.body}</p>
        </div>
        {state.kind !== "loading" && <ContactButton block label={contactLabel()} />}
      </section>
    </main>
  );
}
