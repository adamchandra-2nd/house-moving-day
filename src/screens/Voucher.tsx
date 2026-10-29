import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { KENALAN_TARGET } from "../config";
import { api } from "../data/adapters";
import "./Voucher.css";

type Props = { name: string; claimed: boolean; onBack: () => void; onClaimed: () => void };

/** Reward voucher: shown to the committee, who confirm the handover with their PIN on the guest's phone. */
export function Voucher({ name, claimed, onBack, onClaimed }: Props) {
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [sending, setSending] = useState(false);
  const code = `HMD-${name.slice(0, 3).toUpperCase()}-0${KENALAN_TARGET}`;

  /**
   * The PIN is the server's to accept, and the claim is the server's to
   * record.
   *
   * This used to compare against a constant in the bundle and then just flip
   * local state. A PIN the committee rotated was refused while the old one
   * still worked, and nothing was written down: the committee's Hadiah page
   * still showed the voucher as unredeemed, and the same prize could be
   * claimed again on another phone.
   */
  const submit = async () => {
    setSending(true);
    setPinError("");
    try {
      await api.claimReward(pin);
      setPinOpen(false);
      onClaimed();
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Gagal menandai hadiah. Coba lagi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="question screen-enter">
      <div className="page__scroll">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <span className="t-p-h3-bold">Hadiahmu</span>
        </div>

        <section className={`voucher clay ${claimed ? "clay-light voucher--claimed" : "clay-accent"}`}>
          <span className="voucher__tags">
            {claimed ? <Badge type="claimed">Sudah diambil</Badge> : <Badge type="ready">Siap ditukar</Badge>}
          </span>
          <span className="voucher__gift clay clay-dark">
            <Icon name={claimed ? "Check" : "Gift"} size={32} />
          </span>
          <div className="voucher__who">
            <Avatar initial={name.charAt(0)} size="M" character />
            <span className="t-display-h6">{name}</span>
          </div>
          <span className="t-p-h4">{KENALAN_TARGET} kartu kenalan terkumpul</span>
          <span className="voucher__code t-p-h3-bold">{code}</span>
        </section>

        <p className="t-p-h5 page__sub voucher__note">
          {claimed
            ? "Hadiah sudah diserahkan. Voucher ini tidak bisa dipakai lagi."
            : "Tunjukkan layar ini ke panitia di meja hadiah. Panitia akan memasukkan PIN untuk menandai hadiahmu sudah diambil."}
        </p>
      </div>
      <div className="page__bottom question__bottom">
        {claimed ? (
          <Button block style="tertiary" onClick={onBack}>
            Kembali
          </Button>
        ) : (
          <Button block onClick={() => setPinOpen(true)}>
            Untuk panitia: tandai diambil
          </Button>
        )}
      </div>

      {pinOpen && (
        <Dialog
          title="PIN panitia"
          onClose={() => setPinOpen(false)}
          actions={
            <>
              <Button block disabled={pin.length < 4 || sending} onClick={() => void submit()}>
                {sending ? "Mengecek…" : "Tandai sudah diambil"}
              </Button>
              <Button block style="tertiary" onClick={() => setPinOpen(false)}>
                Kembali
              </Button>
            </>
          }
        >
          <TextField
            label="PIN 4 angka"
            value={pin}
            onChange={(v) => {
              setPinError("");
              setPin(v.replace(/\D/g, "").slice(0, 4));
            }}
            placeholder="••••"
            inputMode="numeric"
            maxLength={4}
            error={pinError || undefined}
            hint="Diisi oleh panitia, bukan tamu."
            autoFocus
          />
        </Dialog>
      )}
    </div>
  );
}
