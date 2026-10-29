import { useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { TextField } from "../components/TextField";
import { Toast, ToastIcon } from "../components/Toast";
import { Toggle } from "../components/Toggle";
import { formatTime, type AgendaItem } from "../data/agenda";
import { QUESTION_MAX, type AskedQuestion, type QuestionStatus } from "../data/questions";
import "./AskScreen.css";

const STATUS: Record<QuestionStatus, { type: "sent" | "read" | "answered"; label: string }> = {
  terkirim: { type: "sent", label: "Terkirim" },
  dibaca: { type: "read", label: "Dibaca" },
  terjawab: { type: "answered", label: "Terjawab" },
};

type Props = {
  event: AgendaItem;
  roomName: string;
  questions: AskedQuestion[];
  /** MC closed questions for this session. */
  closed: boolean;
  /** Sending fails (no connection). */
  offline: boolean;
  onBack: () => void;
  onSend: (text: string, anonymous: boolean) => void;
  /** Returns false when the MC read it first (no longer editable). */
  onEdit: (id: string, text: string) => boolean;
  onDelete: (id: string) => void;
};

/**
 * Ask the speaker through the app, so shy guests don't have to stand up. Questions show on the
 * Performance/MC screen; guests see everyone's questions (no votes, by design) and the status of their own.
 */
export function AskScreen({ event, roomName, questions, closed, offline, onBack, onSend, onEdit, onDelete }: Props) {
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const [deleting, setDeleting] = useState<AskedQuestion | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const mine = questions.filter((q) => q.mine).sort((a, b) => b.at - a.at);
  const others = questions.filter((q) => !q.mine).sort((a, b) => b.at - a.at);

  const send = () => {
    if (offline) return setError(true);
    onSend(text.trim(), anonymous);
    setText("");
    setSent(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="overlay-screen screen-enter">
      <div className="page__scroll">
        <div className="topbar">
          <button type="button" className="icon-btn clay clay-light" onClick={onBack} aria-label="Kembali">
            <Icon name="ArrowLeft" />
          </button>
          <span className="t-p-h3-bold">Tanya pembicara</span>
        </div>

        <section className="card">
          <span className="agenda-card__tags">
            <Badge type="now">Sekarang</Badge>
            <Badge type="room">{roomName}</Badge>
          </span>
          <h1 className="t-display-h6 panel__title">{event.title}</h1>
          <span className="t-p-h5 ask__meta">
            {formatTime(event.start)}–{formatTime(event.end)} · pertanyaan tampil di layar MC
          </span>
        </section>

        {closed ? (
          <section className="card ask__closed">
            <span className="ask__closed-icon clay clay-dark">
              <Icon name="Lock" size={20} />
            </span>
            <span className="ask__closed-text">
              <span className="t-p-h4-bold">Sesi tanya sudah ditutup MC</span>
              <span className="t-p-h5 panel__body">Pertanyaan yang sudah masuk tetap dibacakan kalau waktunya cukup.</span>
            </span>
          </section>
        ) : (
          <section className="card">
            <TextField
              label="Pertanyaanmu"
              value={text}
              onChange={(v) => {
                setError(false);
                setText(v.slice(0, QUESTION_MAX));
              }}
              placeholder="Tulis pertanyaan buat pembicara…"
              multiline
              maxLength={QUESTION_MAX}
              error={error ? "Gagal terkirim. Cek koneksimu, lalu kirim lagi." : undefined}
              hint={`${text.length}/${QUESTION_MAX} karakter`}
            />
            <Toggle dark label="Kirim sebagai anonim" hint="Namamu tidak akan ditampilkan." checked={anonymous} onChange={setAnonymous} />
          </section>
        )}

        <h2 className="t-p-h5-bold section-label">Pertanyaanku · {mine.length}</h2>
        {mine.length === 0 ? (
          <p className="t-p-h5 page__sub">Belum ada. Pertanyaanmu akan muncul di sini beserta statusnya.</p>
        ) : (
          <ul className="list ask__list">
            {mine.map((q) => (
              <QuestionRow key={q.id} q={q} onEdit={onEdit} onDelete={() => setDeleting(q)} />
            ))}
          </ul>
        )}

        <h2 className="t-p-h5-bold section-label">Pertanyaan tamu lain · {others.length}</h2>
        {others.length === 0 ? (
          <p className="t-p-h5 page__sub">Belum ada pertanyaan. Jadi yang pertama!</p>
        ) : (
          <ul className="list ask__list">
            {others.map((q) => (
              <QuestionRow key={q.id} q={q} />
            ))}
          </ul>
        )}
      </div>

      <div className="page__bottom question__bottom">
        {closed ? (
          <Button block style="tertiary" onClick={onBack}>
            Kembali
          </Button>
        ) : (
          <Button block icon="ArrowRight" disabled={!text.trim()} onClick={send}>
            {error ? "Kirim lagi" : "Kirim pertanyaan"}
          </Button>
        )}
      </div>

      {deleting && (
        <Dialog
          title="Batalkan pertanyaan?"
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button
                block
                style="danger"
                onClick={() => {
                  onDelete(deleting.id);
                  setDeleting(null);
                }}
              >
                Ya, hapus
              </Button>
              <Button block style="tertiary" onClick={() => setDeleting(null)}>
                Kembali
              </Button>
            </>
          }
        >
          Pertanyaanmu akan dihapus dari layar MC.
        </Dialog>
      )}

      {sent && (
        <div className="page__toast">
          <Toast lead={<ToastIcon icon="Check" tone="accent" />} title="Terkirim ke MC" sub="Pantau statusnya di Pertanyaanku." />
        </div>
      )}
    </div>
  );
}

type RowProps = { q: AskedQuestion; onEdit?: (id: string, text: string) => boolean; onDelete?: () => void };

/** One question. Your own can be edited or withdrawn only while it's still "Terkirim" (the MC hasn't read it). */
function QuestionRow({ q, onEdit, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(q.text);
  const [tooLate, setTooLate] = useState(false);
  const s = STATUS[q.status];
  const editable = q.mine && q.status === "terkirim";

  const save = () => {
    const ok = onEdit?.(q.id, draft.trim());
    setEditing(false);
    if (!ok) {
      setDraft(q.text);
      setTooLate(true);
    }
  };

  return (
    <li className="card ask__item">
      <span className="ask__item-head">
        <span className="t-p-h5-bold ask__author">{q.mine ? (q.author ? "Kamu" : "Kamu (anonim)") : (q.author ?? "Anonim")}</span>
        <span className="t-p-h5 ask__time">
          {q.edited && "Diedit · "}
          {formatTime(q.at)}
        </span>
      </span>
      {editing ? (
        <TextField
          label="Ubah pertanyaan"
          value={draft}
          onChange={(v) => setDraft(v.slice(0, QUESTION_MAX))}
          multiline
          maxLength={QUESTION_MAX}
          autoFocus
        />
      ) : (
        <p className="t-p-h4 ask__text">{q.text}</p>
      )}
      <span className="agenda-card__tags">
        <Badge type={s.type}>{s.label}</Badge>
      </span>
      {tooLate && (
        <span className="t-p-h5 ask__note ask__note--error" role="alert">
          Keburu dibaca MC, jadi tidak bisa diubah.
        </span>
      )}
      {q.mine && !editable && !tooLate && <span className="t-p-h5 ask__note">Sudah dibaca MC, tidak bisa diubah.</span>}
      {editable &&
        (editing ? (
          <span className="ask__actions">
            <Button
              size="small"
              style="tertiary"
              onClick={() => {
                setEditing(false);
                setDraft(q.text);
              }}
            >
              Batal
            </Button>
            <Button size="small" disabled={!draft.trim() || draft.trim() === q.text} onClick={save}>
              Simpan
            </Button>
          </span>
        ) : (
          <span className="ask__actions">
            <Button size="small" style="tertiary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="small" style="danger" onClick={onDelete}>
              Batal kirim
            </Button>
          </span>
        ))}
    </li>
  );
}
