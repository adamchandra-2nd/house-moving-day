import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { ADMIN_EMAIL } from "./data";
import "./Login.css";
import potaraLogo from "../assets/potara-logo.png";
import workroom from "../assets/rooms/ruang-kerja-utama.webp";

const PIN_LENGTH = 6;
const RESEND_S = 30;
const MAX_TRIES = 3;

export type LoginScenario = "email" | "pin" | "pin-expired" | "pin-locked";

/**
 * onSignedIn verifies the PIN with the server and resolves on success. It is
 * async because the PIN is the server's to accept -- checking it here against
 * a bundled constant would let a committee member in whose PIN the server
 * would refuse, and every later request would then fail with no explanation.
 */
type Props = { scenario: LoginScenario; onSignedIn: (email: string, pin: string) => Promise<void> };

const mask = (email: string) =>
  email.replace(
    /^(.)(.*)(@.*)$/,
    (_, a, b, c) => a + "*".repeat(Math.max(1, b.length)) + c,
  );

/** Admin sign-in: email → 6-digit PIN sent to that email. */
export function Login({ scenario, onSignedIn }: Props) {
  const [step, setStep] = useState<"email" | "pin">(
    scenario === "email" ? "email" : "pin",
  );
  const [email, setEmail] = useState(scenario === "email" ? "" : ADMIN_EMAIL);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const sendPin = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setEmailError("Format email belum benar.");
    if (email.trim().toLowerCase() !== ADMIN_EMAIL)
      return setEmailError("Email ini tidak terdaftar sebagai admin.");
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setStep("pin");
    }, 900);
  };

  return (
    <main
      className="admin-login"
      style={{ "--login-bg": `url(${workroom})` } as React.CSSProperties}
    >
      <section className="admin-login__card clay clay-light">
        <div className="admin-login__art">
          <Character
            say={step === "email" ? "Halo, panitia!" : "Cek email ya!"}
          />
        </div>
        <div className="admin-login__form">
          <span className="admin-brand__mark">
            <img src={potaraLogo} alt="Potara" />
          </span>
          {step === "email" ? (
            <>
              <div className="admin-head__text">
                <h1 className="admin-title">Masuk ke HMD Admin</h1>
                <p className="t-p-h4 admin-sub">
                  Kami kirim PIN 6 angka ke email admin.
                </p>
              </div>
              <TextField
                label="Email admin"
                value={email}
                onChange={(v) => {
                  setEmailError(null);
                  setEmail(v);
                }}
                placeholder="nama@potara.id"
                error={emailError ?? undefined}
                autoFocus
              />
              <Button
                block
                icon="Mail"
                disabled={!email || sending}
                onClick={sendPin}
              >
                {sending ? "Mengirim PIN…" : "Kirim PIN"}
              </Button>
            </>
          ) : (
            <PinStep
              email={email}
              scenario={scenario}
              onBack={() => setStep("email")}
              onSignedIn={(pin) => onSignedIn(email, pin)}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function PinStep({
  email,
  scenario,
  onBack,
  onSignedIn,
}: {
  email: string;
  scenario: LoginScenario;
  onBack: () => void;
  onSignedIn: (pin: string) => Promise<void>;
}) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(
    scenario === "pin-expired"
      ? "PIN sudah kedaluwarsa. Kirim ulang PIN baru."
      : null,
  );
  const [tries, setTries] = useState(scenario === "pin-locked" ? MAX_TRIES : 0);
  const [resendIn, setResendIn] = useState(
    scenario === "pin-expired" ? 0 : RESEND_S,
  );
  const [expired, setExpired] = useState(scenario === "pin-expired");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = tries >= MAX_TRIES;

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    const next = [...digits];
    if (d.length > 1) {
      d.slice(0, PIN_LENGTH - i)
        .split("")
        .forEach((c, k) => (next[i + k] = c));
    } else next[i] = d;
    setDigits(next);
    setError(null);
    const focus = Math.min(PIN_LENGTH - 1, i + Math.max(1, d.length));
    if (d) refs.current[focus]?.focus();
  };

  const pin = digits.join("");
  const submit = async () => {
    if (expired)
      return setError("PIN sudah kedaluwarsa. Kirim ulang PIN baru.");
    try {
      await onSignedIn(pin);
      return;
    } catch {
      // Any refusal is "wrong PIN" as far as this screen is concerned. The
      // server rate-limits the attempts; the counter here is what the
      // committee sees.
    }
    const n = tries + 1;
    setTries(n);
    setDigits(Array(PIN_LENGTH).fill(""));
    refs.current[0]?.focus();
    setError(
      n >= MAX_TRIES ? null : `PIN salah. Sisa ${MAX_TRIES - n} percobaan.`,
    );
  };

  const resend = () => {
    setResendIn(RESEND_S);
    setExpired(false);
    setError(null);
    setDigits(Array(PIN_LENGTH).fill(""));
  };

  return (
    <>
      <div className="admin-head__text">
        <h1 className="admin-title">Masukkan PIN</h1>
        <p className="t-p-h4 admin-sub">
          PIN 6 angka dikirim ke {mask(email)}. Berlaku 10 menit.
        </p>
      </div>
      {locked ? (
        <div className="admin-login__locked card">
          <Icon name="Lock" />
          <span className="t-p-h4">
            Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau kirim ulang
            PIN.
          </span>
        </div>
      ) : (
        <div className="pin" role="group" aria-label="PIN 6 angka">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={`pin__box${error ? " is-error" : ""}`}
              value={d}
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              aria-label={`Angka ${i + 1}`}
              autoFocus={i === 0}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0)
                  refs.current[i - 1]?.focus();
                if (e.key === "Enter" && pin.length === PIN_LENGTH) void submit();
              }}
            />
          ))}
        </div>
      )}
      {error && (
        <span className="t-p-h5 field__hint field__hint--error" role="alert">
          {error}
        </span>
      )}
      <Button
        block
        disabled={locked || pin.length < PIN_LENGTH}
        onClick={() => void submit()}
      >
        Masuk
      </Button>
      <div className="admin-login__links">
        <Button size="small" style="tertiary" onClick={onBack}>
          Ganti email
        </Button>
        <Button
          size="small"
          style="tertiary"
          disabled={resendIn > 0 && !locked}
          onClick={resend}
        >
          {resendIn > 0 && !locked
            ? `Kirim ulang (${resendIn}s)`
            : "Kirim ulang PIN"}
        </Button>
      </div>
    </>
  );
}
