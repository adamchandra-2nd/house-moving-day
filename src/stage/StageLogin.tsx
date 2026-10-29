import { useEffect, useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import potaraLogo from "../assets/potara-logo.png";
import { ROOMS } from "../data/rooms";
import { PANITIA_CONTACT, type Person } from "./data";
import { setStageToken, stageLogin } from "./remote";
import { ContactButton } from "./ui";
import "./stage.css";

/** Prototype code "sent" to WhatsApp. */
export const STAGE_CODE = "246810";
const LEN = 6;
const MAX_TRIES = 3;
const RESEND_S = 30;

export type LoginStep = "link" | "kode" | "kode-salah" | "terkunci" | "dicabut";

const maskPhone = (p: string) => `${p.slice(0, 4)} •••• ${p.slice(-3)}`;

/**
 * MC and speakers may come from outside Potara, so there is no account: the admin sends a personal link on
 * WhatsApp, and the first open is confirmed with a 6-digit code sent to the same number.
 */
export function StageLogin({ person, eventLabel, initial, onDone }: Readonly<{ person: Person; eventLabel: string; initial: LoginStep; onDone: () => void }>) {
  const [step, setStep] = useState<LoginStep>(initial);
  const [digits, setDigits] = useState<string[]>(() => (initial === "kode-salah" ? "135790".split("") : Array(LEN).fill("")));
  const [tries, setTries] = useState(initial === "kode-salah" ? 1 : 0);
  const [error, setError] = useState(initial === "kode-salah");
  const [wait, setWait] = useState(RESEND_S);
  const [sending, setSending] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const isMc = person.role === "mc";
  const bg = ROOMS[isMc ? 0 : 4].image;

  useEffect(() => {
    if (step !== "kode" && step !== "kode-salah") return;
    const t = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(t);
  }, [step]);

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
        setStageToken(res.token);
        onDone();
      })
      .catch(() => {
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
            <ContactButton block label={`Hubungi ${PANITIA_CONTACT.name}`} />
          </>
        ) : step === "link" ? (
          <>
            <span className="stage-login__role">
              <Badge type="ready" icon={isMc ? "Megaphone" : "Sparkle"}>
                {isMc ? "MC" : "Performance"}
              </Badge>
            </span>
            <div className="stage-login__head">
              <h1 className="stage-login__title">Halo, {person.name.split(" ")[0]}!</h1>
              <p className="t-p-h4 stage-login__body">
                Kamu {isMc ? "jadi MC" : `jadi performance (${person.title.toLowerCase()})`} di {eventLabel}. Untuk keamanan, kami kirim kode 6 angka ke WhatsApp {maskPhone(person.phone)}.
              </p>
            </div>
            <Button
              block
              icon="Message"
              disabled={sending}
              onClick={() => {
                setSending(true);
                window.setTimeout(() => {
                  setSending(false);
                  setStep("kode");
                }, 800);
              }}
            >
              {sending ? "Mengirim kode…" : "Kirim kode ke WhatsApp"}
            </Button>
            <div className="login-help">
              <span className="t-p-h5 stage-muted">Bukan nomormu, atau tidak dapat kode?</span>
              <ContactButton block />
            </div>
          </>
        ) : (
          <>
            <div className="stage-login__head">
              <h1 className="stage-login__title">Masukkan kode</h1>
              <p className="t-p-h4 stage-login__body">Kode 6 angka sudah dikirim ke WhatsApp {maskPhone(person.phone)}. Berlaku 10 menit.</p>
            </div>
            {step === "terkunci" ? (
              <div className="stage-login__note">
                <Icon name="Lock" size={20} />
                <span className="t-p-h5-bold">Terlalu banyak percobaan. Coba lagi 15 menit lagi, atau minta kode baru.</span>
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
              <Button
                size="small"
                style="tertiary"
                disabled={wait > 0 && step !== "terkunci"}
                onClick={() => {
                  setWait(RESEND_S);
                  setTries(0);
                  setError(false);
                  setDigits(Array(LEN).fill(""));
                  setStep("kode");
                }}
              >
                {wait > 0 && step !== "terkunci" ? `Kirim ulang (${wait}d)` : "Kirim ulang kode"}
              </Button>
            </div>
            <span className="t-p-h5 stage-muted">Kode demo: {STAGE_CODE}</span>
          </>
        )}
      </section>
    </main>
  );
}
