import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { IconBadge, type IconTone } from "../components/IconBadge";
import type { IconName } from "../components/iconPaths";
import { TextField } from "../components/TextField";
import { Toast, ToastIcon } from "../components/Toast";
import { formatTime } from "../data/agenda";
import { ApiError } from "../data/http";
import { ROOMS, roomIndexById } from "../data/rooms";
import { KENALAN_TARGET, SHOW_CHECKIN_TIME } from "../config";
import { useStageEvent, useStageQuestions, useStageRoom, useStagePeople, useStageSessions, type StageEvent } from "./live";
import { RoomPicker } from "../admin/pickers";
import {
  ANNOUNCE_TEMPLATES,
  HELP_LABEL,
  MC_SIGNALS,
  allPeople,
  allSessions,
  QUESTION_GROUPS,
  SIGNAL_TONE,
  SCRIPTS,
  personById,
  sessionById,
  type McSignal,
  type Person,
  type ScriptPart,
  type StageQuestion,
  type StageQuestionState,
} from "./data";
import { draftScript } from "./draftScript";
import { MC_LINKS, type McTab } from "./links";
import { BigTimer, StageCard, StageShell, TimerStrip } from "./StageShell";
import { StageLogin } from "./StageLogin";
import { StageNotice, useStageGate } from "./gate";
import { sendAnnouncement } from "./remote";
import { clockMinute, EMPTY_STAGE, nextSession, remainingS, sortedSessions, useNow, useStage, useWakeLock, type StageState } from "./store";
import { InkOption, MetaTags, QCard, ReadMode, Sheet, SpeakerRow, StageSystem } from "./ui";
import { Welcome } from "./Welcome";

/**
 * The first MC in the cast: who the review cases show.
 *
 * A live screen uses whoever signed in instead (see McApp), because the
 * first MC is only the right one while there is exactly one.
 */
const firstMc = () => allPeople().find((p) => p.role === "mc");
const NO_MC: Person = { id: "", name: "MC", role: "mc", title: "MC", phone: "" };

/**
 * The bundled "Claude" scripts are a review fixture keyed by the bundled
 * session ids. A live rundown gets a draft from its own sessions instead,
 * until the committee writes the real one.
 */
const suggested = (demo: boolean, id: string): ScriptPart[][] => {
  if (demo) return SCRIPTS[id] ?? [];
  const s = sessionById(id);
  return s ? [draftScript(s, allSessions(), personById(s.speakerId))] : [];
};
const roomName = (id: string) => ROOMS[roomIndexById(id)].name;
const firstName = (n: string) => n.split(" ")[0];

/** MC side (phone + tablet): runs the rundown, reads guests' questions, signals the speaker. */
export function McApp({ token, tab }: { token: string; /** Tab from the URL, for tabs that are not a case of their own. */ tab?: McTab }) {
  const sc = MC_LINKS[token] ?? MC_LINKS["mc-404"];
  const known = token in MC_LINKS;
  const [system, setSystem] = useState(known ? sc.system : "404");
  const [login, setLogin] = useState(sc.login);
  const [welcome, setWelcome] = useState(!!sc.welcome);
  // "mc" is the real thing: a signed-in MC and server data only. Every other
  // token is a review case with its own fixture.
  const demo = token !== "mc";
  const gate = useStageGate("mc", !demo);
  const me = !demo && gate.state.kind === "in" ? gate.state.me : undefined;
  // Loads the rundown and the cast into the registry the rest of this file
  // reads through sessionById / personById. Held back until signed in.
  const enabled = demo || Boolean(me);
  useStageSessions({ demo, enabled });
  useStagePeople({ demo, enabled });
  const event = useStageEvent(demo);
  // The cast entry when there is one (the committee may have renamed them),
  // what the login returned otherwise.
  const MC = (me ? (personById(me.id) ?? me) : demo ? firstMc() : undefined) ?? NO_MC;
  if (system) return <StageSystem kind={system} onRetry={() => setSystem(undefined)} />;
  if (!demo) {
    const g = gate.state;
    if (g.kind === "error") return <StageSystem kind="error" onRetry={gate.retry} />;
    if (g.kind === "login") return <StageLogin person={g.person} eventLabel={event.name} initial="link" onSignedIn={gate.signedIn} onDone={() => setWelcome(true)} />;
    if (g.kind !== "in") return <StageNotice state={g} role="mc" />;
  }
  if (login) return <StageLogin person={MC} eventLabel={event.name} initial={login} demo onDone={() => (setLogin(undefined), setWelcome(true))} />;
  if (welcome) return <Welcome person={MC} sessions={sortedSessions()} event={event} onDone={() => setWelcome(false)} />;
  return <McMain token={token} demo={demo} mc={MC} event={event} initialTab={tab} />;
}

function McMain({ token, demo, mc, event, initialTab }: { token: string; demo: boolean; mc: Person; event: StageEvent; initialTab?: McTab }) {
  const sc = MC_LINKS[token] ?? {};
  const [state, update] = useStage(sc.seed?.());

  /**
   * Guests' questions, folded into the shared stage document.
   *
   * Two sources meet here on purpose. The questions table is where a guest's
   * phone writes, and it is what this screen starts from after a reload. The
   * stage document is where the MC's own working state lives -- which
   * question is picked, read, answered -- and the server does not know about
   * any of that. So each question arrives once, keeping whatever the MC has
   * since done with it; nothing already in the list is rewritten.
   */
  const asked = useStageQuestions();
  useEffect(() => {
    if (sc.seed || asked.length === 0) return;
    update((s) => {
      const known = new Set(s.questions.map((q) => q.id));
      const fresh = asked
        .filter((q) => !known.has(q.id))
        .map((q) => ({
          id: q.id,
          sessionId: q.eventId,
          text: q.text,
          author: q.author,
          at: q.at,
          // The API has no notion of topic groups; the MC assigns one.
          groupId: "",
          // A question the MC has already answered comes back as done, so a
          // reload mid-session does not re-queue work that is finished.
          state: (q.status === "terjawab" ? "dijawab" : q.status === "dibaca" ? "dibacakan" : "masuk") as StageQuestionState,
        }));
      return fresh.length ? { ...s, questions: [...s.questions, ...fresh] } : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked.map((q) => q.id).join()]);

  const now = useNow();
  useWakeLock();
  const [tab, setTab] = useState<McTab>(sc.tab ?? initialTab ?? "panggung");
  const [sheet, setSheet] = useState(sc.sheet);
  const [reading, setReading] = useState(!!sc.readMode);
  const [toast, setToast] = useState<{ icon: IconName; title: string; sub: string; urgent?: boolean; action?: { label: string; onClick: () => void } } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const seenSignal = useRef<number>(sc.toast ? 0 : (state.speakerSignal?.at ?? 0));

  const notify = (t: NonNullable<typeof toast>) => {
    window.clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), t.urgent ? 9000 : 4000);
  };

  // Speaker → MC signals arrive as toasts (urgent ones stay longer)
  useEffect(() => {
    const s = state.speakerSignal;
    if (!s || s.at <= seenSignal.current) return;
    seenSignal.current = s.at;
    // Whichever session is on stage, not a hard-coded "talkshow": the
    // committee names its own rundown, and the id may not exist at all.
    const speaker = personById(sessionById(state.liveId ?? "")?.speakerId);
    if (s.kind === "siap") notify({ icon: "Check", title: `${firstName(speaker?.name ?? "Performance")} sudah siap`, sub: "Sesi berikutnya bisa dimulai kapan saja." });
    if (s.kind === "bantuan")
      notify({ icon: "Bell", urgent: true, title: `${firstName(speaker?.name ?? "Performance")} butuh bantuan`, sub: `${HELP_LABEL[s.help ?? "lainnya"]}. Panitia sudah dikabari otomatis.` });
    if (s.kind === "selesai") notify({ icon: "ArrowRight", title: "Panggung kembali ke MC", sub: "Performance sudah selesai. Tutup sesi lalu lanjut." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.speakerSignal]);

  const live = state.liveId ? sessionById(state.liveId) : undefined;
  const next = nextSession(state);
  const secs = remainingS(state, now);
  const setQ = (id: string, st: StageQuestionState) => update((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? { ...q, state: st } : q)) }));
  // Same rule as the Pertanyaan tab: only the session on stage has an inbox.
  const newCount = state.questions.filter((q) => q.state === "masuk" && q.sessionId === (state.liveId ?? "")).length;

  const startSession = (id: string) => {
    // One lookup, and a guard: the rundown is the committee's to edit while
    // the MC is holding this screen, so a session can genuinely vanish
    // between it being listed and being tapped.
    const s0 = sessionById(id);
    if (!s0) return notify({ icon: "Close", title: "Sesi tidak ditemukan", sub: "Rundown mungkin baru diubah panitia. Tarik untuk memuat ulang." });
    update((s) => ({ ...s, phase: "live", liveId: id, startedAt: Date.now(), speaker: s0.speakerId ? "live" : s.speaker, mcSignal: null }));
    notify({ icon: "ArrowRight", title: `${s0.title} dimulai`, sub: `Tamu dapat notifikasi pindah ke ${roomName(s0.roomId)}.` });
  };
  const endSession = () => {
    if (!live) return;
    const last = !next;
    update((s) => ({
      ...s,
      liveId: null,
      doneIds: [...s.doneIds, live.id],
      phase: last ? "ended" : s.phase,
      speaker: live.speakerId ? "selesai" : s.speaker,
      mcSignal: live.speakerId ? { kind: "terima-kasih", at: Date.now() } : s.mcSignal,
    }));
    notify({ icon: "Check", title: `${live.title} selesai`, sub: "Form feedback sesi ini sudah muncul di HP tamu." });
  };
  /**
   * Back to before the first session, for a rehearsal or an event ended by
   * mistake. Once the last session ended, the stage stayed "Acara selesai"
   * for good: nothing was left to start, so the MC could not run it again.
   * The committee's scripts are kept; ticks, signals and progress are not.
   */
  const restartEvent = () => {
    update((s) => ({ ...EMPTY_STAGE(), scripts: s.scripts }));
    notify({ icon: "ArrowRight", title: "Acara dimulai ulang", sub: "Semua sesi kembali belum mulai." });
  };
  const signal = (kind: McSignal) => {
    update((s) => ({ ...s, mcSignal: { kind, at: Date.now() } }));
    notify({ icon: "Send", title: `Terkirim ke ${firstName(personById(live?.speakerId)?.name ?? "performance")}`, sub: `“${MC_SIGNALS[kind].title}” muncul besar di layarnya.` });
  };

  const strip = live ? (
    <TimerStrip title={live.title} secs={secs} />
  ) : state.phase === "ended" ? (
    <TimerStrip title="Acara selesai" display="Selesai" />
  ) : sc.daysLeft ? (
    <TimerStrip title={event.name} label="hari H" display={`H-${sc.daysLeft}`} />
  ) : (
    next && <TimerStrip title={`Berikutnya: ${next.title}`} label="mulai" display={formatTime(next.start)} />
  );

  const banner = (
    <>
      {sc.offline && (
        <div className="offline-bar">
          <Icon name="WifiOff" size={20} />
          <span className="t-p-h5-bold">Offline. Timer tetap jalan; aksi terkirim begitu tersambung lagi.</span>
        </div>
      )}
      {state.rundownChanged && (
        <div className="notice-card">
          <span className="notice-card__row">
            <Icon name="Calendar" size={20} />
            <span className="t-p-h5-bold notice-card__text">{demo ? "Rundown diubah panitia: Makan siang mundur 15 menit." : "Rundown diubah panitia. Cek jadwal terbarunya."}</span>
          </span>
          <Button
            block
            size="small"
            style="tertiary"
            icon="ArrowRight"
            onClick={() => {
              update((s) => ({ ...s, rundownChanged: false }));
              setSheet("rundown");
            }}
          >
            Lihat rundown
          </Button>
        </div>
      )}
    </>
  );

  const panggung = (
    <Panggung
      state={state}
      now={now}
      demo={demo}
      mc={mc}
      event={event}
      daysLeft={sc.daysLeft}
      onStart={startSession}
      onEnd={endSession}
      onRestart={restartEvent}
      onSignal={signal}
      onToggleLine={(sid, i) =>
        update((s) => {
          const cur = s.checked[sid] ?? [];
          return { ...s, checked: { ...s.checked, [sid]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] } };
        })
      }
      onVariant={(sid) => update((s) => ({ ...s, scriptVariant: { ...s.scriptVariant, [sid]: ((s.scriptVariant[sid] ?? 0) + 1) % Math.max(1, suggested(demo, sid).length) }, checked: { ...s.checked, [sid]: [] } }))}
      onSheet={setSheet}
      onResolveHelp={() => {
        update((s) => ({ ...s, speaker: "live", speakerHelp: undefined }));
        notify({ icon: "Check", title: "Ditandai beres", sub: "Performance melihat bantuan sudah ditangani." });
      }}
    />
  );
  const pertanyaan = <Pertanyaan state={state} onSet={setQ} onRead={() => setReading(true)} />;
  const content =
    tab === "panggung" ? panggung : tab === "pertanyaan" ? pertanyaan : tab === "sorotan" ? <Sorotan state={state} demo={demo} onCopied={() => notify({ icon: "Copy", title: "Sapaan disalin", sub: "Tinggal dibacakan." })} /> : (
      <Umumkan
        state={state}
        compose={!!sc.compose}
        onSend={async (a) => {
          // Live: the guests' phones read the server's announcements, so it
          // only counts as sent -- and only joins "Sudah dikirim" -- once the
          // server has it. A review case stays in this tab.
          if (!demo) {
            try {
              await sendAnnouncement(a);
            } catch (e) {
              notify({ icon: "Close", title: "Pengumuman belum terkirim", sub: e instanceof ApiError && e.status !== 0 ? e.message : "Sinyal putus. Coba kirim lagi." });
              return false;
            }
          }
          update((s) => ({ ...s, announcements: [...s.announcements, { ...a, at: clockMinute(s, Date.now()) }] }));
          notify({ icon: "Megaphone", title: "Pengumuman terkirim", sub: "Muncul di HP semua tamu yang hadir." });
          return true;
        }}
      />
    );
  const picked = state.questions.filter((q) => q.state === "dipilih");

  return (
    <>
      <StageShell
        nav={[
          { id: "panggung", label: "Panggung", icon: "Megaphone" },
          { id: "pertanyaan", label: "Pertanyaan", icon: "Message", count: state.phase === "ended" ? 0 : newCount },
          { id: "sorotan", label: "Sorotan", icon: "Sparkle" },
          { id: "umumkan", label: "Umumkan", icon: "Bell" },
        ]}
        active={tab}
        onNav={setTab}
        strip={strip}
        banner={banner}
        toast={
          toast && (
            <Toast
              lead={<ToastIcon icon={toast.icon} tone="accent" />}
              title={toast.title}
              sub={toast.sub}
              action={
                toast.action ? (
                  <Button
                    size="small"
                    block
                    icon="ArrowRight"
                    onClick={() => {
                      toast.action!.onClick();
                      setToast(null);
                    }}
                  >
                    {toast.action.label}
                  </Button>
                ) : undefined
              }
            />
          )
        }
      >
        {content}
      </StageShell>

      {reading && (
        <ReadMode
          list={picked}
          strip={strip}
          groupLabel={(q) => QUESTION_GROUPS.find((g) => g.id === q.groupId)?.label}
          note={live?.speakerId ? `Juga tampil di layar ${firstName(personById(live.speakerId)?.name ?? "")}` : "Tamu melihat statusnya jadi Terjawab"}
          doneLabel="Sudah dibacakan"
          onDone={(id) => setQ(id, "dibacakan")}
          onSkip={(id) => setQ(id, "dilewati")}
          onClose={() => setReading(false)}
        />
      )}
      {sheet === "rundown" && (
        <Sheet icon="Calendar" tone="teal" title="Rundown hari ini" onClose={() => setSheet(undefined)}>
          <RundownList state={state} />
          <span className="t-p-h5 stage-muted">Jadwal diatur panitia. Kalau ada perubahan, kamu dapat notifikasi.</span>
        </Sheet>
      )}
      {sheet === "panitia" && (
        <Sheet icon="Headset" tone="ink" title="Hubungi panitia" onClose={() => setSheet(undefined)}>
          <span className="t-p-h4 stage-muted">Panitia langsung dapat notifikasi di dashboard. Pilih yang paling sesuai:</span>
          <div className="tpl-list">
            {[
              { icon: "Megaphone" as const, title: "Sound / mic bermasalah", body: "Butuh tim teknis ke panggung" },
              { icon: "Users" as const, title: "Tamu butuh bantuan", body: "Ada tamu yang perlu didampingi" },
              { icon: "Clock" as const, title: "Jadwal perlu digeser", body: "Sesi molor atau perlu dipercepat" },
              { icon: "Message" as const, title: "Lainnya", body: "Panitia akan menghubungimu" },
            ].map((o) => (
              <InkOption
                key={o.title}
                icon={o.icon}
                title={o.title}
                body={o.body}
                onClick={() => {
                  setSheet(undefined);
                  update((s) => ({ ...s, panitiaCalled: true, panitiaCall: { reason: o.title, at: Date.now() } }));
                  notify({ icon: "Headset", title: "Panitia sudah dikabari", sub: `${o.title}. Tunggu sebentar ya.` });
                }}
              />
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

/* ---------------- Panggung ---------------- */

function Panggung({
  state,
  now,
  demo,
  mc: MC,
  event,
  daysLeft,
  onStart,
  onEnd,
  onRestart,
  onSignal,
  onToggleLine,
  onVariant,
  onSheet,
  onResolveHelp,
}: {
  state: StageState;
  now: number;
  demo: boolean;
  mc: Person;
  event: StageEvent;
  daysLeft?: number;
  onStart: (id: string) => void;
  onEnd: () => void;
  onRestart: () => void;
  onSignal: (k: McSignal) => void;
  onToggleLine: (sessionId: string, i: number) => void;
  onVariant: (sessionId: string) => void;
  onSheet: (s: "rundown" | "panitia") => void;
  onResolveHelp: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const live = state.liveId ? sessionById(state.liveId) : undefined;
  const next = nextSession(state);
  const focus = live ?? next;
  const speaker = personById(focus?.speakerId);
  const secs = remainingS(state, now);
  const options = focus ? suggested(demo, focus.id) : [];
  const variant = (focus ? (state.scriptVariant[focus.id] ?? 0) : 0) % Math.max(1, options.length);
  const edited = focus ? state.scripts?.[focus.id] : undefined;
  const script = focus ? (edited ?? options[variant] ?? []) : [];
  const checked = focus ? (state.checked[focus.id] ?? []) : [];
  const ended = state.phase === "ended";
  const sent = state.mcSignal;

  return (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Panggung</h1>
          <p className="t-p-h5 stage-head__sub">
            {daysLeft ? `${event.dateLabel} · ${daysLeft} hari lagi` : `${demo ? "Minggu, 8 Nov" : event.dateLabel} · ${formatTime(clockMinute(state, now))}`}
          </p>
        </div>
      </header>
      <div className="stage-head__actions">
        <Button size="small" style="tertiary" icon="Calendar" onClick={() => onSheet("rundown")}>
          Rundown
        </Button>
        <Button size="small" style="tertiary" icon="Headset" onClick={() => onSheet("panitia")}>
          Hubungi panitia
        </Button>
      </div>

      {/* One orange card: what's on stage now, "Berikutnya" in a light container inside */}
      <section className="now-card clay clay-accent">
        <div className="now-card__main">
          {live ? (
            <>
              <span className="agenda-card__tags">
                <Badge type="now">Sekarang</Badge>
              </span>
              <h2 className="now-card__title">{live.title}</h2>
              <MetaTags
                items={[
                  { icon: "MapPin", text: roomName(live.roomId) },
                  ...(live.pic ? [{ icon: "Users" as const, text: `PIC ${live.pic}` }] : []),
                ]}
              />
              <BigTimer secs={secs} total={(live.end - live.start) * 60} />
              {speaker ? (
                <SpeakerRow name={speaker.name} status={state.speaker === "belum" ? "live" : state.speaker} help={state.speakerHelp} onResolve={onResolveHelp} />
              ) : (
                <SpeakerRow name={MC.name} status="mc" />
              )}
              <Button block style="secondary" icon="Check" onClick={() => setConfirmEnd(true)}>
                Selesaikan sesi
              </Button>
            </>
          ) : ended ? (
            <>
              <span className="agenda-card__tags">
                <Badge type="claimed" icon="Check">Selesai</Badge>
              </span>
              {/* The MC reading this, and the rundown they actually ran. */}
              <h2 className="now-card__title">Acara selesai. Terima kasih, {firstName(MC.name)}!</h2>
              <span className="t-p-h4">Semua {allSessions().length} sesi sudah berjalan. Tamu sedang mengisi feedback akhir.</span>
              <Button block style="tertiary" icon="ArrowLeft" onClick={() => setConfirmRestart(true)}>
                Mulai ulang acara
              </Button>
            </>
          ) : daysLeft ? (
            <>
              <span className="agenda-card__tags">
                <Badge type="next" icon="Clock">Belum mulai</Badge>
              </span>
              <h2 className="now-card__title">{daysLeft} hari lagi</h2>
              <span className="t-p-h4">Pelajari rundown dan naskah dulu. Timer dan tombol aktif di hari H.</span>
            </>
          ) : (
            next ? (
              <>
                <span className="agenda-card__tags">
                  <Badge type="next" icon="Clock">{state.phase === "pre" ? "Belum mulai" : "Jeda"}</Badge>
                </span>
                <h2 className="now-card__title">{next.title}</h2>
                <MetaTags
                  items={[
                    { icon: "Clock", text: `${formatTime(next.start)}–${formatTime(next.end)}` },
                    { icon: "MapPin", text: roomName(next.roomId) },
                    ...(next.pic ? [{ icon: "Users" as const, text: `PIC ${next.pic}` }] : []),
                  ]}
                />
                {speaker ? <SpeakerRow name={speaker.name} status={state.speaker === "siap" ? "siap" : "belum"} /> : <SpeakerRow name={MC.name} status="mc" />}
                <Button block style="secondary" icon="ArrowRight" onClick={() => onStart(next.id)}>
                  Mulai {next.title}
                </Button>
              </>
            ) : (
              // Nothing left to start: the committee has not filled the
              // rundown yet (a fresh event), or every session is done.
              <>
                <span className="agenda-card__tags">
                  <Badge type="next" icon="Clock">Belum mulai</Badge>
                </span>
                <h2 className="now-card__title">Rundown masih kosong</h2>
                <span className="t-p-h4">Panitia belum mengisi rundown. Layar ini terisi sendiri begitu sesinya ditambahkan.</span>
              </>
            )
          )}
        </div>
        {live && next && (
          <div className="now-card__next">
            <span className="t-p-h5-bold now-card__label">Berikutnya</span>
            <span className="t-p-h3-bold one-line">{next.title}</span>
            <span className="t-p-h5 one-line">
              {roomName(next.roomId)} · {formatTime(next.start)}–{formatTime(next.end)}{next.pic ? ` · PIC ${next.pic}` : ""}
            </span>
          </div>
        )}
      </section>

      {ended && (
        <StageCard icon="Check" tone="green" title="Ringkasan acara">
          <dl className="info-rows">
            <div className="info-row">
              <Icon name="Calendar" size={16} />
              <dt className="t-p-h5">Sesi</dt>
              <dd className="t-p-h4-bold">{state.doneIds.length} selesai</dd>
            </div>
            <div className="info-row">
              <Icon name="Message" size={16} />
              <dt className="t-p-h5">Pertanyaan</dt>
              <dd className="t-p-h4-bold">
                {state.questions.filter((q) => q.state === "dibacakan" || q.state === "dijawab").length} dijawab dari {state.questions.length}
              </dd>
            </div>
            <div className="info-row">
              <Icon name="Megaphone" size={16} />
              <dt className="t-p-h5">Pengumuman</dt>
              <dd className="t-p-h4-bold">{state.announcements.length} terkirim</dd>
            </div>
          </dl>
          <span className="t-p-h5 stage-muted">Link MC berhenti berlaku besok. Terima kasih sudah memandu House Moving Day!</span>
        </StageCard>
      )}

      {live && speaker && (
        <StageCard icon="Send" tone="sky" title={`Kode ke ${firstName(speaker.name)}`}>
          <span className="t-p-h5 stage-muted">Muncul besar di layar performance, jadi kamu tidak perlu memberi isyarat dari jauh.</span>
          <div className="signal-grid">
            {(["5-menit", "tanya-jawab", "akhiri", "terima-kasih"] as McSignal[]).map((k) => (
              <button key={k} type="button" className={`signal-btn clay clay-light${sent?.kind === k ? " is-sent" : ""}`} onClick={() => onSignal(k)}>
                <span className="signal-btn__top">
                  <IconBadge icon={MC_SIGNALS[k].icon} tone={SIGNAL_TONE[k]} size="S" />
                  {sent?.kind === k && <Badge type="neutral" icon="Check">Terkirim</Badge>}
                </span>
                <span className="t-p-h4-bold">{MC_SIGNALS[k].title}</span>
              </button>
            ))}
          </div>
        </StageCard>
      )}

      {focus && script.length > 0 && !ended && (
        <StageCard
          icon="Pencil"
          tone="ink"
          title={`Naskah · ${focus.title}`}
          aside={
            edited ? (
              <Badge type="neutral" icon="Pencil">Diedit panitia</Badge>
            ) : (
              <span className="claude-tag clay clay-light t-p-h5-bold">
                <Icon name="Sparkle" size={16} />
                {demo ? "Claude" : "Draf"}
              </span>
            )
          }
        >
          <ol className="script">
            {script.map((line, i) => {
              const done = checked.includes(i);
              return (
                <li key={i} className={`script__item${done ? " is-done" : ""}`}>
                  <button type="button" role="checkbox" aria-checked={done} aria-label={`Tandai ${line.label}`} className={`st-check${done ? " is-on clay clay-accent" : ""}`} onClick={() => onToggleLine(focus.id, i)}>
                    {done && <Icon name="Check" size={16} />}
                  </button>
                  <span className="script__text">
                    <span className="t-p-h5-bold script__label">{line.label}</span>
                    <p className="t-p-h4 script__line">{line.text}</p>
                  </span>
                </li>
              );
            })}
          </ol>
          {!edited && options.length > 1 && (
            <div className="card-actions">
              <Button size="small" style="tertiary" icon="Sparkle" onClick={() => onVariant(focus.id)}>
                Saran lain
              </Button>
            </div>
          )}
          <span className="t-p-h5 stage-muted">{edited ? "Diperbarui panitia dari dashboard." : demo ? "Disusun Claude dari rundown. Panitia bisa mengubahnya di dashboard." : "Draf otomatis dari rundown. Panitia bisa mengubahnya di dashboard."}</span>
        </StageCard>
      )}

      {confirmEnd && live && (
        <Dialog
          icon="Check"
          iconTone="green"
          title={`Selesaikan ${live.title}?`}
          description={`Tamu langsung dapat form feedback sesi ini.${next ? ` Setelah itu kamu bisa mulai ${next.title}.` : " Ini sesi terakhir, acara akan ditandai selesai."}`}
          onClose={() => setConfirmEnd(false)}
          actions={
            <>
              <Button
                icon="Check"
                onClick={() => {
                  setConfirmEnd(false);
                  onEnd();
                }}
              >
                Selesaikan
              </Button>
              <Button style="tertiary" onClick={() => setConfirmEnd(false)}>
                Kembali
              </Button>
            </>
          }
        />
      )}
      {confirmRestart && (
        <Dialog
          icon="ArrowLeft"
          iconTone="red"
          title="Mulai ulang acara?"
          description="Semua sesi kembali belum mulai, dan centang naskah serta kode ke performance direset. Naskah dari panitia tetap ada. Pakai untuk gladi, bukan saat acara berjalan."
          onClose={() => setConfirmRestart(false)}
          actions={
            <>
              <Button
                icon="ArrowLeft"
                onClick={() => {
                  setConfirmRestart(false);
                  onRestart();
                }}
              >
                Mulai ulang
              </Button>
              <Button style="tertiary" onClick={() => setConfirmRestart(false)}>
                Kembali
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

function RundownList({ state }: { state: StageState }) {
  const next = nextSession(state);
  return (
    <ol className="rd-list">
      {sortedSessions().map((s) => {
        const st = state.doneIds.includes(s.id) ? "done" : s.id === state.liveId ? "now" : s.id === next?.id ? "next" : "later";
        const sp = personById(s.speakerId);
        return (
          <li key={s.id} className={`rd-item is-${st}`}>
            <span className="t-p-h5-bold rd-item__time">{formatTime(s.start)}</span>
            <span className="rd-item__body">
              <span className="t-p-h4-bold one-line">{s.title}</span>
              <span className="t-p-h5 stage-muted one-line">
                {roomName(s.roomId)}{s.pic ? ` · PIC ${s.pic}` : ""}
                {sp ? ` · ${sp.name}` : ""}
              </span>
              {st === "now" && <Badge type="now">Sekarang</Badge>}
              {st === "next" && <Badge type="next" icon="Clock">Berikutnya</Badge>}
              {st === "done" && <Badge type="done">Selesai</Badge>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Pertanyaan ---------------- */

const DONE: StageQuestionState[] = ["dibacakan", "dijawab", "dilewati"];

function Pertanyaan({ state, onSet, onRead }: { state: StageState; onSet: (id: string, s: StageQuestionState) => void; onRead: () => void }) {
  const [view, setView] = useState<"masuk" | "dipilih" | "selesai">("masuk");
  // No invented default: if no session is on stage, there is no session.
  const sessionId = state.liveId ?? "";
  const session = sessionById(sessionId);
  const all = state.questions.filter((q) => q.sessionId === sessionId);
  const inbox = all.filter((q) => q.state === "masuk");
  const picked = all.filter((q) => q.state === "dipilih");
  const done = all.filter((q) => DONE.includes(q.state));
  const counts = { masuk: inbox.length, dipilih: picked.length, selesai: done.length };
  const doneTag = (q: StageQuestion) =>
    q.state === "dilewati" ? <Badge type="done">Dilewati</Badge> : <Badge type="answered">{q.state === "dijawab" ? "Dijawab performance" : "Dibacakan"}</Badge>;

  return (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Pertanyaan</h1>
          <p className="t-p-h5 stage-head__sub">
            {session?.title ?? "Belum ada sesi berjalan"} · {all.length} masuk dari tamu
          </p>
        </div>
      </header>

      <div className="st-tabs" role="tablist">
        {(["masuk", "dipilih", "selesai"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={`st-tab t-p-h5-bold${view === v ? " is-active clay clay-dark" : " clay clay-light"}`} onClick={() => setView(v)}>
            {v === "masuk" ? "Masuk" : v === "dipilih" ? "Dipilih" : "Selesai"}
            <span className="st-tab__count">{counts[v]}</span>
          </button>
        ))}
      </div>

      {view === "masuk" &&
        (inbox.length === 0 ? (
          <EmptyCard icon="Message" title="Belum ada pertanyaan baru" body={session?.qna ? "Pertanyaan dari HP tamu muncul di sini, langsung dikelompokkan per topik." : "Sesi ini tidak membuka tanya jawab."} />
        ) : (
          <>
            <span className="q-hint">
              <span className="claude-tag clay clay-light t-p-h5-bold">
                <Icon name="Sparkle" size={16} />
                Dikelompokkan Claude
              </span>
              <span className="t-p-h5 stage-muted">Geser kanan untuk pilih, kiri untuk lewati.</span>
            </span>
            {QUESTION_GROUPS.map((g) => {
              const list = inbox.filter((q) => q.groupId === g.id).sort((a, b) => a.at - b.at);
              if (!list.length) return null;
              return (
                <section key={g.id} className="q-group">
                  <div className="q-group__head">
                    <span className="t-p-h4-bold q-group__title">{g.label}</span>
                    <Badge type="neutral">{list.length} pertanyaan</Badge>
                  </div>
                  <ul className="q-list">
                    {list.map((q) => (
                      <QCard key={q.id} q={q} primary={{ label: "Pilih", icon: "Check", onClick: () => onSet(q.id, "dipilih") }} secondary={{ label: "Lewati", onClick: () => onSet(q.id, "dilewati") }} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        ))}

      {view === "dipilih" && picked.length > 0 && (
        <Button block icon="Eye" onClick={onRead}>
          Mode baca · {picked.length} pertanyaan
        </Button>
      )}
      {view === "dipilih" &&
        (picked.length === 0 ? (
          <EmptyCard icon="Check" title="Belum ada yang dipilih" body="Pilih pertanyaan dari tab Masuk. Yang dipilih juga tampil di layar performance." />
        ) : (
          <ul className="q-list">
            {picked.map((q) => (
              <QCard
                key={q.id}
                q={q}
                picked
                tag={<Badge type="read">Tamu melihat: Dibaca</Badge>}
                primary={{ label: "Dibacakan", icon: "Check", onClick: () => onSet(q.id, "dibacakan") }}
                secondary={{ label: "Batal pilih", onClick: () => onSet(q.id, "masuk") }}
              />
            ))}
          </ul>
        ))}

      {view === "selesai" &&
        (done.length === 0 ? (
          <EmptyCard icon="Message" title="Belum ada yang selesai" body="Pertanyaan yang sudah dibacakan atau dilewati pindah ke sini." />
        ) : (
          <ul className="q-list">
            {done.map((q) => (
              <QCard key={q.id} q={q} tag={doneTag(q)} />
            ))}
          </ul>
        ))}
    </>
  );
}

function EmptyCard({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <section className="stage-card">
      <div className="stage-card__body" style={{ alignItems: "center", textAlign: "center", padding: "var(--padding-extra-large) var(--padding-large)" }}>
        <span className="icon-badge icon-badge--pink icon-badge--L clay clay-accent">
          <Icon name={icon} size={28} />
        </span>
        <span className="t-p-h4-bold">{title}</span>
        <span className="t-p-h5 stage-muted">{body}</span>
      </div>
    </section>
  );
}

/* ---------------- Sorotan ---------------- */

const SAY = [
  "Selamat datang Laras dan Dimas yang baru sampai! Langsung cek HP kalian ya, karakternya sudah menunggu.",
  "Tepuk tangan buat Bayu yang sudah kumpulkan 5 kartu kenalan! Siapa berikutnya?",
  "Yang belum dapat kenalan, sekarang momen yang pas. Tinggal scan QR teman di sebelah kalian.",
];

/**
 * Greetings written from the room as it is, for a live screen.
 *
 * SAY names guests from the review fixture; reading those out at a real
 * event would welcome people who are not there.
 */
function liveSay(recent: { name: string }[], rewards: { name: string }[]) {
  const names = recent.slice(0, 2).map((g) => firstName(g.name));
  return [
    names.length ? `Selamat datang ${names.join(" dan ")} yang baru sampai! Langsung cek HP kalian ya, karakternya sudah menunggu.` : "",
    rewards[0] ? `Tepuk tangan buat ${firstName(rewards[0].name)} yang sudah kumpulkan ${KENALAN_TARGET} kartu kenalan! Siapa berikutnya?` : "",
    SAY[2],
  ].filter(Boolean);
}

function Sorotan({ state, demo, onCopied }: { state: StageState; demo: boolean; onCopied: () => void }) {
  const [n, setI] = useState(0);
  // From the server, projected down to what a stage screen may see: names
  // and arrival times, never phone numbers or invite tokens.
  const room = useStageRoom();
  const recent = room.recent.slice(0, 4);
  const rewards = room.rewards.slice(0, 3);
  const say = demo ? SAY : liveSay(room.recent, room.rewards);
  const i = n % say.length;
  // The session on stage, not a bundled "pembukaan".
  const rating = room.feedback[state.liveId ?? ""] ?? { count: 0, avg: 0, counts: [0, 0, 0, 0, 0] };
  const copy = () => {
    navigator.clipboard?.writeText(say[i]).catch(() => undefined);
    onCopied();
  };

  return (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Sorotan</h1>
          <p className="t-p-h5 stage-head__sub">Bahan sapaan dari yang terjadi di acara.</p>
        </div>
      </header>

      <div className="mini-stats">
        <MiniStat icon="Users" tone="green" label="Hadir" value={String(room.here)} note={`dari ${room.rsvpYes} RSVP`} />
        {/* The real count, not a count plus two. */}
        <MiniStat icon="Gift" tone="amber" label="Hadiah" value={String(room.rewards.length)} note="kartu lengkap" />
        <RatingStat counts={rating.counts} total={rating.count} avg={rating.avg} label={sessionById(state.liveId ?? "")?.title ?? "Sesi"} />
      </div>

      <StageCard
        icon="Sparkle"
        tone="green"
        title="Sapaan siap baca"
        aside={
          <span className="claude-tag clay clay-light t-p-h5-bold">
            <Icon name="Sparkle" size={16} />
            Claude
          </span>
        }
      >
        <div className="say-box">
          <p className="say-box__line">“{say[i]}”</p>
        </div>
        <div className="q-card__actions card-actions">
          <Button size="small" style="tertiary" icon="Sparkle" onClick={() => setI(i + 1)}>
            Saran lain
          </Button>
          <Button size="small" style="secondary" icon="Copy" onClick={copy}>
            Salin
          </Button>
        </div>
      </StageCard>

      <StageCard icon="Users" tone="green" title="Baru datang">
        <ul className="hl-list">
          {recent.length === 0 && <li className="t-p-h5 stage-muted">Belum ada tamu yang masuk.</li>}
          {recent.map((g) => (
            <li key={g.name} className="hl-item">
              <Avatar initial={g.name.charAt(0)} size="S" />
              <span className="hl-item__text">
                <span className="t-p-h4-bold">{g.name}</span>
                <span className="t-p-h5 stage-muted">{SHOW_CHECKIN_TIME ? `Hadir ${formatTime(g.at)}` : "Hadir"}</span>
              </span>
              <Badge type="claimed">Hadir</Badge>
            </li>
          ))}
        </ul>
      </StageCard>

      <StageCard icon="Gift" tone="amber" title="Kartu kenalan lengkap">
        <ul className="hl-list">
          {rewards.length === 0 && <li className="t-p-h5 stage-muted">Belum ada yang mengumpulkan kartu lengkap.</li>}
          {rewards.map((g) => (
            <li key={g.name} className="hl-item">
              <Avatar initial={g.name.charAt(0)} size="S" />
              <span className="hl-item__text">
                <span className="t-p-h4-bold">{g.name}</span>
                <span className="t-p-h5 stage-muted">{KENALAN_TARGET}/{KENALAN_TARGET} kartu kenalan</span>
              </span>
              <Badge type={g.status === "diambil" ? "claimed" : "ready"}>{g.status === "diambil" ? "Diambil" : "Siap"}</Badge>
            </li>
          ))}
        </ul>
      </StageCard>
      {state.phase === "ended" && <span className="t-p-h5 stage-muted">Feedback akhir sedang masuk. Hasil lengkapnya ada di dashboard panitia.</span>}
    </>
  );
}

/* ---------------- Umumkan ---------------- */

/** onSend resolves false when the server refused or never answered: the dialog then stays open to try again. */
function Umumkan({ state, compose: startCompose, onSend }: { state: StageState; compose: boolean; onSend: (a: { title: string; body: string; roomId: string | null }) => Promise<boolean> }) {
  const [confirm, setConfirm] = useState<{ title: string; body: string; roomId: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [compose, setCompose] = useState(startCompose);
  const [title, setTitle] = useState(startCompose ? "Foto bersama 5 menit lagi" : "");
  const [body, setBody] = useState(startCompose ? "Kumpul di Halaman Depan ya!" : "");
  const [roomId, setRoomId] = useState<string | null>(startCompose ? "halaman-depan" : null);
  const here = useStageRoom().here;

  return (
    <>
      <header className="stage-head">
        <div className="stage-head__text">
          <h1 className="t-display-h6 stage-head__title">Umumkan</h1>
          <p className="t-p-h5 stage-head__sub">Muncul sebagai notifikasi di HP {here} tamu yang hadir.</p>
        </div>
      </header>

      <StageCard icon="Megaphone" tone="coral" title="Sekali ketuk">
        <div className="tpl-list">
          {ANNOUNCE_TEMPLATES.map((t) => (
            <button key={t.title} type="button" className="tpl clay clay-light" onClick={() => setConfirm(t)}>
              <span className="icon-badge icon-badge--coral icon-badge--S clay clay-accent">
                <Icon name={t.icon} size={16} />
              </span>
              <span className="tpl__text">
                <span className="t-p-h4-bold one-line">{t.title}</span>
                <span className="t-p-h5 stage-muted one-line">{t.body}</span>
              </span>
              <Icon name="ChevronRight" size={20} />
            </button>
          ))}
        </div>
      </StageCard>

      <StageCard icon="Pencil" tone="coral" title="Tulis sendiri">
        {compose ? (
          <>
            <TextField label="Judul" value={title} onChange={setTitle} placeholder="Foto bersama 5 menit lagi" maxLength={40} hint={`${title.length}/40`} />
            <TextField label="Isi" value={body} onChange={setBody} placeholder="Kumpul di Halaman Depan ya!" multiline maxLength={120} hint={`${body.length}/120`} />
            <RoomPicker label="Ruangan tujuan (opsional)" value={roomId} onChange={setRoomId} optional hint="Kalau dipilih, notifikasinya punya tombol “Ke sana”." />
            <div className="card-actions card-actions--block">
            <Button block icon="Megaphone" disabled={!title.trim() || !body.trim()} onClick={() => setConfirm({ title: title.trim(), body: body.trim(), roomId })}>
              Kirim ke {here} tamu
            </Button>
            </div>
          </>
        ) : (
          <Button block style="tertiary" icon="Plus" onClick={() => setCompose(true)}>
            Tulis pengumuman
          </Button>
        )}
      </StageCard>

      {state.announcements.length > 0 && (
        <StageCard icon="Clock" tone="slate" title="Sudah dikirim">
          <ul className="hl-list">
            {[...state.announcements].reverse().map((a, i) => (
              <li key={i} className="hl-item">
                <Icon name="Megaphone" size={20} />
                <span className="hl-item__text">
                  <span className="t-p-h4-bold one-line">{a.title}</span>
                  <span className="t-p-h5 stage-muted one-line">
                    {formatTime(a.at)} · {a.roomId ? roomName(a.roomId) : "Tanpa tombol Ke sana"}
                  </span>
                </span>
                <Badge type="read">Terkirim</Badge>
              </li>
            ))}
          </ul>
        </StageCard>
      )}

      {confirm && (
        <Dialog
          icon="Megaphone"
          iconTone="coral"
          title="Kirim pengumuman?"
          description={`Muncul di HP ${here} tamu. Tidak bisa ditarik setelah terkirim.`}
          onClose={() => !sending && setConfirm(null)}
          actions={
            <>
              <Button
                icon="Megaphone"
                disabled={sending}
                onClick={() => {
                  setSending(true);
                  void onSend(confirm).then((ok) => {
                    setSending(false);
                    if (!ok) return;
                    setConfirm(null);
                    setCompose(false);
                    setTitle("");
                    setBody("");
                    setRoomId(null);
                  });
                }}
              >
                {sending ? "Mengirim…" : "Kirim sekarang"}
              </Button>
              <Button style="tertiary" disabled={sending} onClick={() => setConfirm(null)}>
                Kembali
              </Button>
            </>
          }
        >
          <span className="say-box" style={{ textAlign: "left" }}>
            <span className="t-p-h4-bold">{confirm.title}</span>
            <span className="t-p-h5 stage-muted">
              {confirm.body}
              {confirm.roomId ? ` · tombol Ke sana: ${roomName(confirm.roomId)}` : ""}
            </span>
          </span>
        </Dialog>
      )}
    </>
  );
}

/** Stat tile, same as the admin stat strip: clay icon + label, big value, one-line note. */
export function MiniStat({ icon, tone, label, value, note }: { icon: IconName; tone: IconTone; label: string; value: string; note: string }) {
  return (
    <div className="mini-stat">
      <span className="mini-stat__top">
        <IconBadge icon={icon} tone={tone} size="S" />
        <span className="t-p-h5-bold stage-muted">{label}</span>
      </span>
      <span className="mini-stat__value">{value}</span>
      <span className="t-p-h5 stage-muted one-line">{note}</span>
    </div>
  );
}

/** Same order and colours as the admin rating donut (1★ red … 5★ green). */
const STAR_COLORS = ["", "#c62828", "#d6589f", "#8a63d2", "#2f6fdb", "#4e8a3e"];

/** Wide rating tile: average on the left, stars + per-star bars on the right. */
/**
 * counts is how many gave 1..5 stars, straight from the server, rather than a
 * list of every rating to be tallied here. label names the session being
 * rated -- it used to read "Pembukaan" whatever was actually on stage.
 */
function RatingStat({ counts, total, avg, label }: { counts: number[]; total: number; avg: number; label: string }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="mini-stat mini-stat--wide">
      <span className="mini-stat__left">
        <span className="mini-stat__top">
          <IconBadge icon="Star" tone="pink" size="S" />
          <span className="t-p-h5-bold stage-muted">Rating</span>
        </span>
        <span className="mini-stat__value">{avg.toFixed(1).replace(".", ",")}</span>
        <span className="t-p-h5 stage-muted one-line">{label} · {total} tamu</span>
      </span>
      <span className="mini-dist mini-dist--box" aria-label={`Rata-rata ${avg.toFixed(1)} dari 5`}>
        <span className="mini-dist__stars mini-dist__head">
          {[1, 2, 3, 4, 5].map((i) => (
            <Icon key={i} name={i <= Math.round(avg) ? "StarFill" : "Star"} size={16} />
          ))}
        </span>
        {[5, 4, 3, 2, 1].map((s) => {
          const n = counts[s - 1] ?? 0;
          return (
            <span key={s} className="mini-dist__row">
              <span className="t-p-h5-bold">{s}★</span>
              <span className="mini-dist__bar">
                <span style={{ width: `${(n / max) * 100}%`, background: STAR_COLORS[s] }} />
              </span>
              <span className="t-p-h5 mini-dist__n">{n}</span>
            </span>
          );
        })}
      </span>
    </div>
  );
}
