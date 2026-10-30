import { useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import potaraLogo from "../assets/potara-logo.png";
import { ApiError } from "../data/http";
import { ROOMS } from "../data/rooms";
import { contactLabel, type Person } from "./data";
import { setStageToken, stageLogin } from "./remote";
import { ContactButton } from "./ui";
import "./stage.css";

/** The server's default STAGE_CODE, shown only on the review cases. */
export const STAGE_CODE = "246810";
const LEN = 6;
const MAX_TRIES = 3;

export type LoginStep = "link" | "kode" | "kode-salah" | "terkunci" | "dicabut";

/** The server already masks the number it sends (0812•••••123); the bundled cast still has full ones. */
const maskPhone = (p: string) => (!p ? "yang didaftarkan panitia" : p.includes("•") ? p : `${p.slice(0, 4)} •••• ${p.slice(-3)}`);

/**
 * MC and speakers may come from outside Potara, so there is no account: the admin sends a personal link on
 * WhatsApp, and the first open is confirmed with the 6-digit stage code. Nothing sends that code by itself:
 * the committee passes it on in a WhatsApp message of its own (Pengisi → Kirim kode). This screen used to
 * say "kami kirim kode" behind a button that sent nothing, so speakers waited for a code that never came.
 */
export function StageLogin({
  person,
  eventLabel,
  initial,
  demo,
  onSignedIn,
  onDone,
}: Readonly<{
  person: Person;
  eventLabel: string;
  initial: LoginStep;
  /** Review case: shows the demo code under the boxes. */
  demo?: boolean;
  /** Live sign-in: keeps the session and who it belongs to (see stage/gate.tsx). */
  onSignedIn?: (token: string, person: Person) => void;
  onDone: () => void;
}>) {
  const [step, setStep] = useState<LoginStep>(initial);
  const [digits, setDigits] = useState<string[]>(() => (initial === "kode-salah" ? "135790".split("") : Array(LEN).fill("")));
  const [tries, setTries] = useState(initial === "kode-salah" ? 1 : 0);
  const [error, setError] = useState(initial === "kode-salah");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const isMc = person.role === "mc";
  const bg = ROOMS[isMc ? 0 : 4].image;


  /**
   * The code is the server's to accept.
   *
   * It exchanges it for a signed session that says which side this is -- and
   * the role comes from the person record on the server, not from this
   * request, so holding the MC's code cannot open the speaker's screen. The
   * local comparison this replaced let anyone past with a code the server
   * would have refused, and every later request then failed with 401.
   */
  const check = (code: string) => {
    void stageLogin(code, person.id)
      .then((res) => {
        if (onSignedIn) onSignedIn(res.token, { ...person, ...res.person });
        else setStageToken(res.token);
        onDone();
      })
      .catch((e: unknown) => {
        // Revoked between opening the link and typing the code: no number of
        // tries gets past that, so do not count it as a wrong code.
        if (e instanceof ApiError && e.status === 410) return setStep("dicabut");
        const n = tries + 1;
        setTries(n);
        setError(true);
        if (n >= MAX_TRIES) setStep("terkunci");
      });
  };
  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const all = clean.slice(0, LEN).split("");
      const next = Array(LEN).fill("").map((_, k) => all[k] ?? "");
      setDigits(next);
      setError(false);
      if (all.length === LEN) check(all.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError(false);
    if (clean && i < LEN - 1) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) check(next.join(""));
  };

  return (
    <main className="stage-login screen-enter" style={{ backgroundImage: `url(${bg})` }}>
      <section className="stage-login__card">
        <img className="stage-login__logo" src={potaraLogo} alt="Potara" />

        {step === "dicabut" ? (
          <>
            <div className="stage-login__head">
              <h1 className="stage-login__title">Link ini sudah tidak berlaku</h1>
              <p className="t-p-h4 stage-login__body">Aksesmu sudah dicabut panitia, atau acaranya sudah selesai. Kalau ini keliru, hubungi panitia.</p>
            </div>
            <ContactButton block label={contactLabel()} />
          </>
        ) : step === "link" ? (
          <>
            <span className="stage-login__role">
              <Badge type="ready" icon={isMc ? "Megaphone" : "Sparkle"}>
                {isMc ? "MC" : "Performance"}
              </Badge>
            </span>
            <div className="stage-login__head">
              <h1 className="stage-login__title">Halo, {person.name.split(" ")[0] || "Pengisi acara"}!</h1>
              <p className="t-p-h4 stage-login__body">
                Kamu {isMc ? "jadi MC" : person.title ? `jadi performance (${person.title.toLowerCase()})` : "jadi performance"} di {eventLabel}. Untuk keamanan, masuk dengan kode 6 angka yang dikirim panitia lewat WhatsApp ke {maskPhone(person.phone)}.
              </p>
            </div>
            <Button
              block
              icon="Lock"
              onClick={() => {
                setTries(0);
                setError(false);
                setDigits(Array(LEN).fill(""));
                setStep("kode");
              }}
            >
              Masukkan kode
            </Button>
            <div className="login-help">
              <span className="t-p-h5 stage-muted">Bukan nomormu, atau belum dapat kode?</span>
              <ContactButton block />
            </div>
          </>
        ) : (
          <>
            <div className="stage-login__head">
              <h1 className="stage-login__title">Masukkan kode</h1>
              <p className="t-p-h4 stage-login__body">Kode 6 angka dari panitia, ada di chat WhatsApp {maskPhone(person.phone)}.</p>
            </div>
            {step === "terkunci" ? (
              <div className="stage-login__note">
                <Icon name="Lock" size={20} />
                <span className="t-p-h5-bold">Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.</span>
              </div>
            ) : (
              <div className="st-pin" role="group" aria-label="Kode 6 angka">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    className={`st-pin__box${error ? " is-error" : ""}`}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={LEN}
                    aria-label={`Angka ${i + 1}`}
                    autoFocus={i === 0}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()}
                  />
                ))}
              </div>
            )}
            {error && step !== "terkunci" && (
              <span className="t-p-h5 field__hint field__hint--error">
                Kode salah. Sisa {MAX_TRIES - tries} percobaan lagi.
              </span>
            )}
            <div className="stage-login__links">
              <Button size="small" style="tertiary" icon="ArrowLeft" onClick={() => setStep("link")}>
                Kembali
              </Button>
            </div>
            <div className="login-help">
              <span className="t-p-h5 stage-muted">Belum dapat kodenya?</span>
              <ContactButton block />
            </div>
            {demo && <span className="t-p-h5 stage-muted">Kode demo: {STAGE_CODE}</span>}
          </>
        )}
      </section>
    </main>
  );
}
