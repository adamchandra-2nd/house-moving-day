import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { Scanner, type ScanState } from "../components/Scanner";
import { DOOR_VIDEO } from "./DoorOpen";
import { TextField } from "../components/TextField";
import { ROOMS } from "../data/rooms";
import "./CheckIn.css";

const CODE_LENGTH = 4;

/** What the review-case camera finds. "invalid" = not a Potara door QR. */
export type CheckInScenario = "ok" | "invalid" | "denied" | "offline";

/**
 * onCheckedIn records the arrival and resolves when the server has accepted
 * it. It rejects when the code is wrong, which is why this screen awaits it
 * rather than navigating on its own: the door code is checked by the server,
 * not here. A guest who got past a client-side check with a stale code would
 * walk into the next screen and fail there instead, with a message about
 * something else entirely.
 */
export type CheckInBy = "qr" | "kode" | "panitia";
type Props = {
  name: string;
  scenario: CheckInScenario;
  onBack: () => void;
  onCheckedIn: (by: CheckInBy, code?: string) => Promise<void>;
  /** Live: the real camera. Review cases keep the timed fake read. */
  camera?: boolean;
  /**
   * The door code from ?door=, when the guest scanned the door QR with their
   * phone's own camera app rather than this screen. Checked in straight away.
   */
  doorFromLink?: string;
};

/**
 * Reads a door QR.
 *
 * The QR holds the app URL /check-in?door=<code> -- so the phone's own camera
 * app also lands here -- and a bare code is accepted too. Anything else (a
 * poster, somebody's kenalan QR) is not the door. The server decides whether
 * the code is right; this only decides whether it is a door QR at all.
 */
function doorCodeFrom(text: string): string | null {
  const t = text.trim();
  if (/^\d{4,8}$/.test(t)) return t;
  try {
    const u = new URL(t);
    const code = u.searchParams.get("door");
    return u.pathname.endsWith("/check-in") && code && /^\d{4,8}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

const PANEL: Record<ScanState, { title: string; body: string }> = {
  scanning: { title: "Scan QR di pintu Potara", body: "Arahkan kamera ke QR yang tertempel di pintu masuk." },
  found: { title: "QR terbaca!", body: "Pintu sedang dibuka untukmu…" },
  invalid: { title: "Ini bukan QR pintu Potara", body: "Pastikan kamu scan QR yang ada di pintu masuk, bukan poster lain." },
  denied: { title: "Izin kamera ditolak", body: "Izinkan kamera di pengaturan browser, atau pakai kode pintu." },
  offline: { title: "Tidak ada koneksi", body: "Check-in butuh internet. Sambungkan lalu coba lagi, atau minta bantuan panitia." },
};

/** Check-in at the physical door: scan the QR (primary), door code or committee lookup (fallbacks). */
export function CheckIn({ name, scenario, onBack, onCheckedIn, camera = false, doorFromLink }: Props) {
  const initial: ScanState = scenario === "denied" ? "denied" : scenario === "offline" ? "offline" : "scanning";
  const [state, setState] = useState<ScanState>(initial);
  const [sheet, setSheet] = useState<"code" | "panitia" | null>(null);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [codeError, setCodeError] = useState("");
  const [sending, setSending] = useState(false);
  /** Why the QR check-in failed, in the server's own words. */
  const [failure, setFailure] = useState("");

  /**
   * Scanning the QR.
   *
   * The 900ms is the door opening. The request carries the code read from the
   * QR, and the server checks it like a typed door code -- being at the door
   * is the thing a check-in proves, and the invite link alone does not.
   *
   * The failure path matters more than it looks. "found" hides every button
   * on this screen, on the assumption that the next screen is about to
   * replace it. If the write fails and nothing is said, the guest is left
   * staring at "Pintu sedang dibuka untukmu…" with no way out and no reason
   * given -- which is exactly what a weak signal at a real door produces.
   * So a failure drops back to the error state, which still offers the door
   * code and the committee.
   */
  const accept = useCallback(
    (doorCode?: string) => {
      setState("found");
      window.setTimeout(() => {
        void onCheckedIn("qr", doorCode).catch((e: unknown) => {
          setState("invalid");
          setFailure(e instanceof Error ? e.message : "Check-in gagal. Coba lagi.");
        });
      }, 900);
    },
    [onCheckedIn],
  );

  const onRead = useCallback(() => {
    if (scenario === "invalid") return setState("invalid");
    accept();
  }, [scenario, accept]);

  const onDecode = useCallback(
    (text: string) => {
      const doorCode = doorCodeFrom(text);
      if (!doorCode) return setState("invalid");
      accept(doorCode);
    },
    [accept],
  );

  // The door video (3 MB) plays the moment check-in succeeds: fetch it while
  // the guest is still lining up the QR, so it is in the cache by then.
  useEffect(() => {
    void fetch(DOOR_VIDEO).catch(() => undefined);
  }, []);

  // Arrived from the door QR via the phone camera: no scanning left to do.
  const linked = useRef(false);
  useEffect(() => {
    if (!doorFromLink || linked.current) return;
    linked.current = true;
    accept(doorFromLink);
  }, [doorFromLink, accept]);

  const submit = async (by: CheckInBy, value: string) => {
    setSending(true);
    setCodeError("");
    try {
      await onCheckedIn(by, value);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Gagal check-in. Coba lagi.");
    } finally {
      setSending(false);
    }
  };

  // A failed check-in reuses the "invalid" look -- red corners, a cross --
  // because that is what it is. The copy says which kind of failure.
  const p = failure && state === "invalid" ? { title: "Check-in belum berhasil", body: failure } : PANEL[state];
  return (
    <main className="flow checkin screen-enter">
      <div className="flow__bg" style={{ backgroundImage: `url(${ROOMS[0].image})` }} />
      <div className="flow__top">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <span className="topbar__title glass t-p-h4-bold">Check-in</span>
        </div>
      </div>

      <div className="flow__stage checkin__stage">
        {camera ? (
          <Scanner state={state} onDecode={sheet ? undefined : onDecode} onCameraError={() => setState("denied")} />
        ) : (
          <Scanner state={state} onRead={sheet ? undefined : onRead} />
        )}
      </div>

      <div className="flow__bottom">
        <section className="panel glass">
          <h2 className="t-p-h3-bold panel__title">{p.title}</h2>
          <p className="t-p-h5 panel__body">{p.body}</p>
          {state !== "found" && (
            <div className="panel__actions">
              {state === "invalid" && (
                <Button
                  block
                  onClick={() => {
                    setFailure("");
                    setState("scanning");
                  }}
                >
                  Scan lagi
                </Button>
              )}
              {state === "offline" && (
                <Button block onClick={() => setState(scenario === "offline" ? "offline" : "scanning")}>
                  Coba lagi
                </Button>
              )}
              {state !== "offline" && (
                <Button block style={state === "denied" ? "primary" : "secondary"} icon="KeyCard" onClick={() => setSheet("code")}>
                  Pakai kode pintu
                </Button>
              )}
              <Button block style="tertiary" onClick={() => setSheet("panitia")}>
                Minta bantuan panitia
              </Button>
            </div>
          )}
        </section>
      </div>

      {sheet === "code" && (
        <Dialog
          title="Masukkan kode pintu"
          onClose={() => setSheet(null)}
          actions={
            <>
              <Button block disabled={code.length < CODE_LENGTH || sending} onClick={() => void submit("kode", code)}>
                {sending ? "Mengecek…" : "Masuk"}
              </Button>
              <Button block style="tertiary" onClick={() => setSheet(null)}>
                Kembali
              </Button>
            </>
          }
        >
          <TextField
            label="Kode pintu"
            value={code}
            onChange={(v) => {
              setCodeError("");
              setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH));
            }}
            placeholder="0000"
            inputMode="numeric"
            maxLength={CODE_LENGTH}
            error={codeError || undefined}
            hint="Kode 4 angka ada di bawah QR pada pintu."
            autoFocus
          />
        </Dialog>
      )}
      {sheet === "panitia" && (
        <Dialog
          title="Sebutkan namamu ke panitia"
          onClose={() => setSheet(null)}
          lead={<span className="checkin__name t-display-h6">{name}</span>}
          actions={
            <>
              <Button block disabled={pin.length < CODE_LENGTH || sending} onClick={() => void submit("panitia", pin)}>
                {sending ? "Mengecek…" : "Sudah dibantu panitia"}
              </Button>
              <Button block style="tertiary" onClick={() => setSheet(null)}>
                Kembali
              </Button>
            </>
          }
        >
          Panitia di pintu akan mencari namamu di daftar tamu, lalu mengetik PIN mereka di sini.
          <TextField
            label="PIN panitia"
            value={pin}
            onChange={(v) => {
              setCodeError("");
              setPin(v.replace(/\D/g, "").slice(0, CODE_LENGTH));
            }}
            placeholder="0000"
            inputMode="numeric"
            maxLength={CODE_LENGTH}
            error={codeError || undefined}
            hint="Diisi oleh panitia, bukan tamu."
          />
        </Dialog>
      )}
    </main>
  );
}
