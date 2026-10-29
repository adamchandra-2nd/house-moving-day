import { useState } from "react";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { EVENT } from "../config";
import { formatTime } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import { roomStyle } from "../admin/hooks";
import { PANITIA_CONTACT, type Person, type Session } from "./data";
import { ContactButton } from "./ui";

/** Short intro for MC / speakers who don't know Potara yet. Skippable. */
export function Welcome({ person, sessions, onDone }: { person: Person; sessions: Session[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const isMc = person.role === "mc";
  const slides = [
    {
      title: `Selamat datang, ${person.name.split(" ")[0]}!`,
      body: (
        <>
          <p className="t-p-h4 stage-login__body">
            {EVENT.name} · {EVENT.dateLabel} · {EVENT.place}.{" "}
            {isMc ? "Kamu memandu acara dari awal sampai akhir." : "Terima kasih sudah mau berbagi di rumah baru Potara."}
          </p>
          <ol className="welcome__list">
            {sessions.map((s) => (
              <li key={s.id} className="welcome__item">
                <span className="t-p-h5-bold stage-muted">{formatTime(s.start)}</span>
                <span className="welcome__item-body">
                  <span className="t-p-h4-bold">{s.title}</span>
                  <span className="t-p-h5 welcome__room-line" style={roomStyle(s.roomId)}>
                    <span className="st-room-dot" />
                    {ROOMS[roomIndexById(s.roomId)].name}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      ),
    },
    {
      title: "5 ruangan di rumah baru",
      body: (
        <>
          <p className="t-p-h4 stage-login__body">Tamu menjelajah ruangan ini lewat HP. Kalau sesi pindah ruangan, tamu dapat notifikasi otomatis.</p>
          <div className="welcome__rooms">
            {ROOMS.map((r) => (
              <span key={r.id} className="welcome__room">
                <img src={r.image} alt="" />
                <span className="t-p-h5-bold welcome__room-line one-line" style={roomStyle(r.id)}>
                  <span className="st-room-dot" />
                  {r.name}
                </span>
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      title: isMc ? "Kamu nggak sendirian" : "Kami bantu dari belakang",
      body: (
        <>
          <p className="t-p-h4 stage-login__body">
            {isMc
              ? "Timer, naskah, dan pertanyaan tamu ada di app ini. Kamu juga bisa kirim kode ke performance (misalnya 5 menit lagi) tanpa harus memberi isyarat dari jauh."
              : "MC akan mengirim kode ke layarmu, misalnya 5 menit lagi atau waktunya tanya jawab. Pertanyaan tamu yang dipilih MC juga muncul di sini."}
          </p>
          <dl className="info-rows">
            <div className="info-row">
              <Icon name="Users" size={16} />
              <dt className="t-p-h5">Panitia</dt>
              <dd className="t-p-h4-bold">{PANITIA_CONTACT.name}</dd>
            </div>
            <div className="info-row">
              <Icon name="Message" size={16} />
              <dt className="t-p-h5">WhatsApp</dt>
              <dd className="t-p-h4-bold">{PANITIA_CONTACT.phone}</dd>
            </div>
          </dl>
          <ContactButton block />
        </>
      ),
    },
  ];
  const last = i === slides.length - 1;

  return (
    <main className="welcome screen-enter" style={{ backgroundImage: `url(${ROOMS[isMc ? 0 : 4].image})` }}>
      <div className="welcome__top">
        <Button size="small" style="tertiary" onClick={onDone}>
          Lewati
        </Button>
      </div>
      <section className="welcome__card">
        <div className="welcome__body scroll-fade">
        <span className="welcome__dots" aria-label={`Langkah ${i + 1} dari ${slides.length}`}>
          {slides.map((_, k) => (
            <span key={k} className={k === i ? "is-on" : ""} />
          ))}
        </span>
        <h1 className="stage-login__title">{slides[i].title}</h1>
        {slides[i].body}
        </div>
        <div className="welcome__actions">
          <Button style="tertiary" icon="ArrowLeft" disabled={i === 0} onClick={() => setI(i - 1)}>
            Kembali
          </Button>
          <Button icon={last ? "Check" : "ArrowRight"} onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? "Mulai" : "Lanjut"}
          </Button>
        </div>
      </section>
    </main>
  );
}
