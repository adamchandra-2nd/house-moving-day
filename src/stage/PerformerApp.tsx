import { useEffect, useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { IconBadge } from "../components/IconBadge";
import type { IconName } from "../components/iconPaths";
import { Toast, ToastIcon } from "../components/Toast";
import { formatTime } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import { allPeople, allSessions, HELP_LABEL, MC_SIGNALS, personById, SIGNAL_TONE, panitiaContact, QUESTION_GROUPS, TALKSHOW_FEEDBACK, type Person, type SpeakerHelp, type StageQuestionState } from "./data";
import { PERF_LINKS, type PerfTab } from "./links";
import { BigTimer, StageCard, StageShell, TimerStrip } from "./StageShell";
import { StageLogin } from "./StageLogin";
import { StageNotice, useStageGate } from "./gate";
import { useStageEvent, useStagePeople, useStageRoom, useStageSessions } from "./live";
import { remainingS, useNow, useStage, useWakeLock, type StageState } from "./store";
import { ContactButton, InkOption, MetaTags, QCard, ReadMode, Sheet, SpeakerRow, StageSystem } from "./ui";
import { Welcome } from "./Welcome";

/**
 * Who the MC is, and which session is this speaker's -- read at render
 * rather than at import.
 *
 * These were module constants over the bundled PEOPLE and SESSIONS, so a
 * speaker opening this screen saw the rundown as it was when the app was
 * built. The committee can move their session, rename it, or swap the
 * speaker; all three used to be invisible here. Who "this speaker" is comes
 * from the sign-in (see PerformerApp); the review cases use the first one.
 */
const firstSpeaker = () => allPeople().find((p) => p.role === "pembicara");
const mcPerson = () => allPeople().find((p) => p.role === "mc");
const mySession = (me: Person) => (me.id ? allSessions().find((s) => s.speakerId === me.id) : undefined);
const NO_ONE: Person = { id: "", name: "Pengisi acara", role: "pembicara", title: "", phone: "" };
const roomName = (id: string) => ROOMS[roomIndexById(id)].name;
/** Same order as the admin rating donut (1★ red … 5★ green). */
const STAR_COLORS = ["", "#c62828", "#d6589f", "#8a63d2", "#2f6fdb", "#4e8a3e"];

/** Performance side: the outside speaker sees only their own session, the MC's cues and the questions picked for them. */
export function PerformerApp({ token, tab }: { token: string; /** Tab from the URL, for tabs that are not a case of their own. */ tab?: PerfTab }) {
  const sc = PERF_LINKS[token];
  const [system, setSystem] = useState(sc ? sc.system : "404");
  const [login, setLogin] = useState(sc?.login);
  const [welcome, setWelcome] = useState(!!sc?.welcome);
  // "pembicara" is the real thing: a signed-in speaker and server data only.
  const demo = token !== "pembicara";
  const gate = useStageGate("pembicara", !demo);
  const me = !demo && gate.state.kind === "in" ? gate.state.me : undefined;
  const enabled = demo || Boolean(me);
  useStageSessions({ demo, enabled });
  useStagePeople({ demo, enabled });
  const event = useStageEvent(demo);
  const ME = (me ? (personById(me.id) ?? me) : demo ? firstSpeaker() : undefined) ?? NO_ONE;
  const MY = mySession(ME);
  if (system) return <StageSystem kind={system} onRetry={() => setSystem(undefined)} />;
  if (!demo) {
    const g = gate.state;
    if (g.kind === "error") return <StageSystem kind="error" onRetry={gate.retry} />;
    if (g.kind === "login") return <StageLogin person={g.person} eventLabel={event.name} initial="link" onSignedIn={gate.signedIn} onDone={() => setWelcome(true)} />;
    if (g.kind !== "in") return <StageNotice state={g} role="pembicara" />;
  }
  if (login) return <StageLogin person={ME} eventLabel={event.name} initial={login} demo onDone={() => (setLogin(undefined), setWelcome(true))} />;
  if (welcome) return <Welcome person={ME} sessions={MY ? [MY] : []} event={event} onDone={() => setWelcome(false)} />;
  return <PerfMain token={token} demo={demo} me={ME} initialTab={tab} />;
}

/** Ratings for the speaker's own session, in one shape for the fixture and the server. */
type Rating = { count: number; avg: number; counts: number[]; comments: string[] };

function PerfMain({ token, demo, me: ME, initialTab }: { token: string; demo: boolean; me: Person; initialTab?: PerfTab }) {
  const MC = mcPerson() ?? { name: "MC" };
  const MY = mySession(ME);
  const sc = PERF_LINKS[token] ?? {};
  // Per session, from the guests' feedback; counts[0] is 1 star (the server's order).
  const room = useStageRoom();
  const [state, update] = useStage(sc.seed?.());
  const now = useNow();
  useWakeLock();
  const [tab, setTab] = useState<PerfTab>(sc.tab ?? initialTab ?? "sesi");
  const [sheet, setSheet] = useState(sc.sheet);
  const [reading, setReading] = useState(!!sc.readMode);
  const [confirmBack, setConfirmBack] = useState(false);
  const [toast, setToast] = useState<{ title: string; sub: string; icon?: IconName; onOpen?: () => void } | null>(null);
  const seen = useRef<number>(sc.toast ? 0 : (state.mcSignal?.at ?? 0));
  const [signal, setSignal] = useState<StageState["mcSignal"]>(null);

  // MC cues take over the whole screen so they're impossible to miss on stage
  useEffect(() => {
    const s = state.mcSignal;
    if (!s || s.at <= seen.current) return;
    seen.current = s.at;
    setSignal(s);
    navigator.vibrate?.(200);
  }, [state.mcSignal]);

  const toastTimer = useRef<number>(undefined);
  const notify = (t: NonNullable<typeof toast>) => {
    window.clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), t.onOpen ? 7000 : 4000);
  };

  // The rundown may not have a session for this speaker: the committee has
  // not assigned one yet, or has just removed theirs. Everything below reads
  // through it, so the empty case is answered here rather than crashing in
  // the middle of a live screen. The hooks above have all run.
  const myId = MY?.id ?? "";
  const onStage = state.liveId === myId && myId !== "";
  const done = state.doneIds.includes(myId);
  const secs = remainingS(state, now);
  const mine = myId ? state.questions.filter((q) => q.sessionId === myId) : [];
  const picked = mine.filter((q) => q.state === "dipilih");
  const setQ = (id: string, st: StageQuestionState) => update((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? { ...q, state: st } : q)) }));

  // A quiet toast (not a full-screen cue) when the MC picks a question, so it doesn't interrupt the talk
  const knownPicks = useRef(new Set(picked.slice(0, sc.newPick ? -1 : undefined).map((q) => q.id)));
  useEffect(() => {
    const fresh = picked.filter((q) => !knownPicks.current.has(q.id));
    picked.forEach((q) => knownPicks.current.add(q.id));
    if (!fresh.length || reading) return;
    const q = fresh[fresh.length - 1];
    const group = QUESTION_GROUPS.find((g) => g.id === q.groupId)?.label;
    navigator.vibrate?.(80);
    notify({
      icon: "Message",
      title: fresh.length > 1 ? `MC memilih ${fresh.length} pertanyaan` : "MC memilih pertanyaan",
      sub: [q.author ?? "Anonim", group].filter(Boolean).join(" · "),
      onOpen: () => (setTab("pertanyaan"), setReading(true)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.map((q) => q.id).join()]);
  const ask = (help: SpeakerHelp) => {
    setSheet(undefined);
    update((s) => ({ ...s, speaker: "bantuan", speakerHelp: help, speakerSignal: { kind: "bantuan", help, at: Date.now() } }));
    notify({ title: "MC dan panitia sudah dikabari", sub: `${HELP_LABEL[help]}. Bantuan segera datang.` });
  };

  /**
   * No session assigned to this speaker.
   *
   * A real state, not an error: the committee may not have put them on the
   * rundown yet, or may have just taken their session off it. Everything
   * below this line reads through the session, and every hook is above it.
   */
  if (!MY) {
    return (
      <StageShell
        nav={[
          { id: "sesi" as PerfTab, label: "Sesiku", icon: "Calendar" },
          { id: "pertanyaan" as PerfTab, label: "Pertanyaan", icon: "Message" },
          { id: "hasil" as PerfTab, label: "Hasil", icon: "Star" },
        ]}
        active={tab}
        onNav={setTab}
        strip={<TimerStrip title="Belum ada sesi" display="—" />}
      >
        <StageCard icon="Calendar" tone="amber" title="Sesimu belum ada di rundown">
          Panitia belum menjadwalkan sesi untukmu, atau baru saja mengubahnya. Layar ini akan terisi sendiri begitu rundown-nya diperbarui.
        </StageCard>
      </StageShell>
    );
  }

  const strip = onStage ? (
    <TimerStrip title={MY.title} secs={secs} />
  ) : done ? (
    <TimerStrip title="Sesimu selesai" display="Selesai" />
  ) : (
    <TimerStrip title={`${MY.title} · ${roomName(MY.roomId)}`} label="mulai" display={formatTime(MY.start)} />
  );

  const sesi = (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Sesiku</h1>
          <p className="t-p-h5 stage-head__sub">Halo, {ME.name.split(" ")[0]}! MC kamu hari ini: {MC.name}.</p>
        </div>
      </header>

      <section className="now-card now-card--perf clay clay-accent">
        <div className="now-card__main">
          <span className="agenda-card__tags">
            {onStage ? (
              <Badge type="now">Live</Badge>
            ) : done ? (
              <Badge type="claimed" icon="Check">Selesai</Badge>
            ) : (
              <Badge type="next" icon="Clock">{state.speaker === "siap" ? "Siap" : "Belum mulai"}</Badge>
            )}
          </span>
          <h2 className="now-card__title">{MY.title}</h2>
          <MetaTags
            items={[
              { icon: "Clock", text: `${formatTime(MY.start)}–${formatTime(MY.end)}` },
              { icon: "MapPin", text: roomName(MY.roomId) },
            ]}
          />
          {onStage ? (
            <>
              <BigTimer secs={secs} total={(MY.end - MY.start) * 60} />
              {state.speaker === "bantuan" && <SpeakerRow icon="Headset" name="Tim datang" status="bantuan" help={state.speakerHelp} />}
              <div className="stack-actions">
                <Button style="tertiary" icon="Headset" onClick={() => setSheet("bantuan")}>
                  Butuh bantuan
                </Button>
                <Button style="secondary" icon="ArrowRight" onClick={() => setConfirmBack(true)}>
                  Kembali ke MC
                </Button>
              </div>
            </>
          ) : done ? (
            <>
              <span className="t-p-h4">Terima kasih sudah berbagi! {demo ? "Rating dan komentar" : "Rating"} tamu sudah bisa kamu lihat.</span>
              <Button block style="secondary" icon="Star" onClick={() => setTab("hasil")}>
                Lihat hasil feedback
              </Button>
            </>
          ) : state.speaker === "siap" ? (
            <span className="t-p-h4">Kamu sudah konfirmasi siap. {MC.name.split(" ")[0]} akan memanggilmu ke panggung.</span>
          ) : (
            <>
              <span className="t-p-h4">Sudah di ruangan? Kabari MC supaya sesi bisa dimulai tepat waktu.</span>
              <Button
                block
                style="secondary"
                icon="Check"
                onClick={() => {
                  update((s) => ({ ...s, speaker: "siap", speakerSignal: { kind: "siap", at: Date.now() } }));
                  notify({ title: "MC sudah dikabari", sub: "Kamu tinggal menunggu dipanggil." });
                }}
              >
                Saya siap
              </Button>
            </>
          )}
        </div>
      </section>

      <StageCard icon="Send" tone="sky" title="Kode dari MC">
        {state.mcSignal ? (
          <div className="hl-item" style={{ padding: 0 }}>
            <IconBadge icon={MC_SIGNALS[state.mcSignal.kind].icon} tone={SIGNAL_TONE[state.mcSignal.kind]} size="S" />
            <span className="hl-item__text">
              <span className="t-p-h4-bold">{MC_SIGNALS[state.mcSignal.kind].title}</span>
              <span className="t-p-h5 stage-muted">{MC_SIGNALS[state.mcSignal.kind].body}</span>
            </span>
            <Badge type="neutral">Terakhir</Badge>
          </div>
        ) : (
          <span className="t-p-h5 stage-muted">Kalau MC mengirim kode (misalnya 5 menit lagi), layarmu berubah besar dan HP bergetar.</span>
        )}
      </StageCard>

      <StageCard icon="Users" tone="ink" title="Kontak">
        <dl className="info-rows">
          <div className="info-row">
            <Icon name="Megaphone" size={16} />
            <dt className="t-p-h5">MC</dt>
            <dd className="t-p-h4-bold">{MC.name}</dd>
          </div>
          <div className="info-row">
            <Icon name="Users" size={16} />
            <dt className="t-p-h5">Panitia</dt>
            {panitiaContact().phone ? (
              <dd className="t-p-h4-bold one-line">
                {[panitiaContact().name, panitiaContact().phone].filter(Boolean).join(" · ")}
              </dd>
            ) : (
              <dd className="t-p-h5 stage-muted">Kontak panitia belum diatur</dd>
            )}
          </div>
          <div className="info-row">
            <Icon name="MapPin" size={16} />
            <dt className="t-p-h5">Ruangan</dt>
            <dd className="t-p-h4-bold">{roomName(MY.roomId)}</dd>
          </div>
        </dl>
        <div className="card-actions card-actions--block">
          <ContactButton block />
        </div>
      </StageCard>
    </>
  );

  const pertanyaan = (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Pertanyaan</h1>
          <p className="t-p-h5 stage-head__sub">Dipilih MC dari pertanyaan tamu, urut sesuai pilihan.</p>
        </div>
      </header>
      {picked.length > 0 && (
        <Button block icon="Eye" onClick={() => setReading(true)}>
          Mode baca · {picked.length} pertanyaan
        </Button>
      )}
      {picked.length === 0 ? (
        <section className="stage-card">
          <div className="stage-card__body" style={{ alignItems: "center", textAlign: "center", padding: "var(--padding-extra-large) var(--padding-large)" }}>
            <span className="icon-badge icon-badge--pink icon-badge--L clay clay-accent">
              <Icon name="Message" size={28} />
            </span>
            <span className="t-p-h4-bold">Belum ada pertanyaan pilihan</span>
            <span className="t-p-h5 stage-muted">MC memilih pertanyaan dari tamu. Begitu dipilih, langsung muncul di sini.</span>
          </div>
        </section>
      ) : (
        <ul className="q-list">
          {picked.map((q) => (
            <QCard key={q.id} q={q} picked primary={{ label: "Sudah dijawab", icon: "Check", onClick: () => setQ(q.id, "dijawab") }} />
          ))}
        </ul>
      )}
      {mine.some((q) => q.state === "dijawab" || q.state === "dibacakan") && (
        <>
          <h2 className="t-p-h5-bold section-label">Sudah dijawab</h2>
          <ul className="q-list">
            {mine
              .filter((q) => q.state === "dijawab" || q.state === "dibacakan")
              .map((q) => (
                <QCard key={q.id} q={q} tag={<Badge type="answered">Terjawab</Badge>} />
              ))}
          </ul>
        </>
      )}
    </>
  );

  // The fixture is the review cases' talkshow; live, the server's tally for
  // this session. The API has no comments, so a live screen shows none.
  const fixture = TALKSHOW_FEEDBACK.ratings;
  const fromRoom = room.feedback[myId];
  const rating: Rating = demo
    ? {
        count: fixture.length,
        avg: fixture.reduce((a, b) => a + b, 0) / fixture.length,
        counts: [1, 2, 3, 4, 5].map((s) => fixture.filter((r) => r === s).length),
        comments: TALKSHOW_FEEDBACK.comments,
      }
    : { count: fromRoom?.count ?? 0, avg: fromRoom?.avg ?? 0, counts: fromRoom?.counts ?? [0, 0, 0, 0, 0], comments: [] };
  const hasil = (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Hasil sesi</h1>
          <p className="t-p-h5 stage-head__sub">Feedback anonim dari tamu untuk {MY.title}.</p>
        </div>
      </header>
      {!done ? (
        <section className="stage-card">
          <div className="stage-card__body" style={{ alignItems: "center", textAlign: "center", padding: "var(--padding-extra-large) var(--padding-large)" }}>
            <span className="icon-badge icon-badge--pink icon-badge--L clay clay-accent">
              <Icon name="Lock" size={28} />
            </span>
            <span className="t-p-h4-bold">Muncul setelah sesimu selesai</span>
            <span className="t-p-h5 stage-muted">Tamu mengisi feedback begitu MC menutup sesi.</span>
          </div>
        </section>
      ) : rating.count === 0 ? (
        <section className="stage-card">
          <div className="stage-card__body" style={{ alignItems: "center", textAlign: "center", padding: "var(--padding-extra-large) var(--padding-large)" }}>
            <span className="icon-badge icon-badge--pink icon-badge--L clay clay-accent">
              <Icon name="Star" size={28} />
            </span>
            <span className="t-p-h4-bold">Belum ada feedback</span>
            <span className="t-p-h5 stage-muted">Rating dari tamu muncul di sini begitu mereka mengisinya. Layar ini diperbarui sendiri.</span>
          </div>
        </section>
      ) : (
        <>
          <StageCard
            icon="Star"
            tone="pink"
            title="Rata-rata"
            aside={(rating.counts[3] ?? 0) + (rating.counts[4] ?? 0) > rating.count / 2 ? <Badge type="claimed" icon="Check">Mayoritas puas</Badge> : undefined}
          >
            <span className="mini-stat__value" style={{ fontSize: 48 }}>
              {rating.avg.toFixed(1).replace(".", ",")}
            </span>
            <span className="t-p-h5 stage-muted">dari {rating.count} tamu</span>
            <ul className="hl-list">
              {[5, 4, 3, 2, 1].map((s) => {
                const n = rating.counts[s - 1] ?? 0;
                return (
                  <li key={s} className="hl-item" style={{ gridTemplateColumns: "28px minmax(0,1fr) 72px", padding: "6px 0", border: 0 }}>
                    <span className="t-p-h5-bold">{s}★</span>
                    <span className="big-timer__bar" style={{ background: "var(--background-texture)", margin: 0 }}>
                      <span style={{ width: `${(n / rating.count) * 100}%`, background: STAR_COLORS[s] }} />
                    </span>
                    <span className="t-p-h5 stage-muted" style={{ textAlign: "right" }}>
                      {n} tamu
                    </span>
                  </li>
                );
              })}
            </ul>
          </StageCard>
          {rating.comments.length > 0 && (
            <StageCard icon="Message" tone="pink" title={`Komentar · ${rating.comments.length}`}>
              <ul className="q-list">
                {rating.comments.map((c) => (
                  <li key={c} className="say-box">
                    <span className="t-p-h5 stage-muted">Anonim</span>
                    <span className="t-p-h4">{c}</span>
                  </li>
                ))}
              </ul>
            </StageCard>
          )}
        </>
      )}
    </>
  );

  const content = tab === "sesi" ? sesi : tab === "pertanyaan" ? pertanyaan : hasil;

  return (
    <>
      <StageShell
        nav={[
          { id: "sesi", label: "Sesiku", icon: "Calendar" },
          { id: "pertanyaan", label: "Pertanyaan", icon: "Message", count: picked.length },
          { id: "hasil", label: "Hasil", icon: "Star" },
        ]}
        active={tab}
        onNav={setTab}
        strip={strip}
        banner={
          sc.offline ? (
            <div className="offline-bar">
              <Icon name="WifiOff" size={20} />
              <span className="t-p-h5-bold">Offline. Timer tetap jalan; kode dari MC muncul begitu tersambung.</span>
            </div>
          ) : undefined
        }
        toast={
          toast && (
            <Toast
              lead={<ToastIcon icon={toast.icon ?? "Check"} tone="accent" />}
              title={toast.title}
              sub={toast.sub}
              action={
                toast.onOpen ? (
                  <Button
                    size="small"
                    block
                    icon="ArrowRight"
                    onClick={() => {
                      toast.onOpen!();
                      setToast(null);
                    }}
                  >
                    Lihat
                  </Button>
                ) : undefined
              }
            />
          )
        }
      >
        {content}
      </StageShell>

      {signal && (
        <div className={`signal-full signal-full--${signal.kind}`} role="alertdialog" aria-label={MC_SIGNALS[signal.kind].title}>
          <span className="signal-full__icon">
            <Icon name={MC_SIGNALS[signal.kind].icon} size={48} />
          </span>
          <span className="t-p-h4-bold">Dari MC · {MC.name.split(" ")[0]}</span>
          <h1 className="signal-full__title">{MC_SIGNALS[signal.kind].title}</h1>
          <p className="t-p-h4 signal-full__body">{MC_SIGNALS[signal.kind].body}</p>
          <Button style="tertiary" icon="Check" onClick={() => setSignal(null)}>
            Oke
          </Button>
        </div>
      )}
      {reading && (
        <ReadMode
          list={picked}
          strip={strip}
          groupLabel={(q) => QUESTION_GROUPS.find((g) => g.id === q.groupId)?.label}
          note="Dipilih MC · tamu melihatnya jadi Terjawab"
          doneLabel="Sudah dijawab"
          onDone={(id) => setQ(id, "dijawab")}
          onSkip={(id) => setQ(id, "dilewati")}
          onClose={() => setReading(false)}
        />
      )}
      {sheet === "bantuan" && (
        <Sheet icon="Headset" tone="ink" title="Butuh bantuan?" onClose={() => setSheet(undefined)}>
          <span className="t-p-h4 stage-muted">MC dan panitia langsung dapat notifikasi. Kamu bisa tetap lanjut bicara.</span>
          <div className="tpl-list">
            {(["mic", "slide", "lainnya"] as SpeakerHelp[]).map((h) => (
              <InkOption
                key={h}
                urgent
                icon={h === "mic" ? "Megaphone" : h === "slide" ? "Computer" : "Message"}
                title={HELP_LABEL[h]}
                body={h === "mic" ? "Suara putus atau tidak terdengar" : h === "slide" ? "Layar atau clicker tidak jalan" : "Panitia akan menghampirimu"}
                onClick={() => ask(h)}
              />
            ))}
          </div>
        </Sheet>
      )}
      {confirmBack && (
        <Dialog
          icon="ArrowRight"
          iconTone="sky"
          title="Kembalikan panggung ke MC?"
          description={`${MC.name.split(" ")[0]} dapat notifikasi untuk menutup sesimu. Pertanyaan yang belum dijawab tetap tersimpan.`}
          onClose={() => setConfirmBack(false)}
          actions={
            <>
              <Button
                icon="ArrowRight"
                onClick={() => {
                  setConfirmBack(false);
                  update((s) => ({ ...s, speaker: "selesai", speakerSignal: { kind: "selesai", at: Date.now() } }));
                  notify({ title: "Panggung kembali ke MC", sub: "Terima kasih! Tunggu MC menutup sesi." });
                }}
              >
                Kembali ke MC
              </Button>
              <Button style="tertiary" onClick={() => setConfirmBack(false)}>
                Batal
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
