import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import type { IconName } from "../components/iconPaths";
import { formatTime, statusAt } from "../data/agenda";
import { rundownMinute } from "../data/clock";
import type { StageState } from "../stage/store";
import { SHOW_CHECKIN_TIME } from "../config";
import { ROOMS, roomIndexById } from "../data/rooms";
import type { AdminPage } from "./AdminShell";
import type { AdminEvent, AdminGuest, Announcement } from "./data";
import { roomStyle } from "./hooks";
import { Empty, LiveTimer, Panel, Stat } from "./ui";

export type Phase = "pre" | "live" | "ended";

export type Activity = { at: number; guest: string; kind: "qr" | "kode" | "panitia" | "reward-ready" | "reward-claimed" | "feedback"; detail?: string };

const ACTIVITY: Record<Activity["kind"], { text: string; tag: string; type: "neutral" | "warn" | "ready" | "claimed" | "next"; icon: IconName }> = {
  qr: { text: "check-in", tag: "Scan QR", type: "neutral", icon: "Scan" },
  kode: { text: "check-in", tag: "Kode pintu", type: "neutral", icon: "KeyCard" },
  panitia: { text: "check-in", tag: "Lewat panitia", type: "warn", icon: "Users" },
  "reward-ready": { text: "kartunya lengkap", tag: "Hadiah siap", type: "ready", icon: "Gift" },
  "reward-claimed": { text: "mengambil hadiah", tag: "Hadiah diambil", type: "claimed", icon: "Check" },
  feedback: { text: "mengirim feedback", tag: "Feedback", type: "next", icon: "Star" },
};

type Props = {
  phase: Phase;
  daysLeft: number;
  now: number;
  guests: AdminGuest[];
  events: AdminEvent[];
  announcements: Announcement[];
  activity: Activity[];
  onNavigate: (p: AdminPage) => void;
  onEndEvent: (id: string) => void;
  onStartEvent: (id: string) => void;
  /**
   * Live: the shared stage document. When it is there it decides what is on
   * stage -- the MC's "mulai" and "selesai", or the committee's own from here
   * -- instead of a guess from the clock, which is wrong the moment the
   * rundown runs late. Review cases leave it out and keep the clock.
   */
  stage?: StageState | null;
};

const ago = (min: number) => (min < 1 ? "baru saja" : min < 60 ? `${min} menit lalu` : `${Math.floor(min / 60)} jam lalu`);
const roomName = (id: string) => ROOMS[roomIndexById(id)].name;

/** Overview: stat strip, then three equal-height columns that fill the screen. */
export function Dashboard({ phase, daysLeft, now, guests, events, announcements, activity, onNavigate, onEndEvent, onStartEvent, stage }: Props) {
  const yes = guests.filter((g) => g.rsvp === "ya").length;
  const no = guests.filter((g) => g.rsvp === "tidak").length;
  const pending = guests.filter((g) => g.rsvp === "belum").length;
  const here = guests.filter((g) => g.checkIn !== null && g.hadir).length;
  const cards = guests.reduce((n, g) => n + g.cards, 0);
  const ready = guests.filter((g) => g.reward !== "mengumpulkan").length;
  const claimed = guests.filter((g) => g.reward === "diambil").length;
  const status = statusAt(now);
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const clockLive = phase === "live" ? sorted.find((e) => status[e.id] === "now") : undefined;
  const clockNext = phase === "pre" ? sorted[0] : phase === "live" ? sorted.find((e) => status[e.id] === "next") : undefined;
  // From the stage: the session the MC started, and the first one not yet run.
  const stageLive = stage ? sorted.find((e) => e.id === stage.liveId) : undefined;
  const stageNext = stage ? sorted.find((e) => e.id !== stage.liveId && !stage.doneIds.includes(e.id)) : undefined;
  const live = stage ? stageLive : clockLive;
  const next = stage ? (phase === "ended" ? undefined : stageNext) : clockNext;
  /** Rundown row state, from the stage when there is one. */
  const rowStatus = (id: string) =>
    stage
      ? stage.doneIds.includes(id)
        ? "done"
        : id === stage.liveId
          ? "now"
          : phase !== "pre" && id === stageNext?.id
            ? "next"
            : "later"
      : phase === "pre"
        ? "later"
        : phase === "ended"
          ? "done"
          : status[id];
  // The timer counts from when it really started, not from the planned slot.
  const startedMin = live && stage?.startedAt ? rundownMinute(new Date(stage.startedAt)) : undefined;
  const lastAnn = announcements[announcements.length - 1];

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div className="admin-head__text">
          <h1 className="admin-title">Dashboard</h1>
          <p className="t-p-h4 admin-sub">
            {phase === "pre" ? `Hari H dalam ${daysLeft} hari. Pantau RSVP dulu.` : phase === "live" ? "Acara sedang berjalan." : "Acara sudah selesai. Terima kasih, panitia!"}
          </p>
        </div>
      </div>

      <section className="stat-strip" aria-label="Ringkasan">
        <Stat icon="Mail" tone="blue" label="Akan datang" value={yes} note={`${no} tidak bisa · ${pending} belum jawab`} />
        <Stat icon="Users" tone="green" label="Hadir" value={here} of={yes} note="sudah check-in & buat karakter" />
        <Stat icon="UserPlus" tone="purple" label="Kartu kenalan" value={cards} note={phase === "pre" ? "belum mulai" : "terkumpul total"} />
        <Stat icon="Gift" tone="amber" label="Hadiah" value={claimed} of={ready} note="diambil dari yang siap" />
      </section>

      <div className="admin-fill dash-fill">
        <Panel
          icon="Calendar"
          tone="teal"
          title="Rundown hari ini"
          footer={
            <Button block size="small" style="tertiary" icon="ArrowRight" onClick={() => onNavigate("rundown")}>
              Atur rundown
            </Button>
          }
        >
          <ol className="dash-rundown">
            {sorted.map((e) => {
              const s = rowStatus(e.id);
              return (
                <li key={e.id} className={`dash-rundown__item is-${s}`} style={roomStyle(e.roomId)}>
                  <span className="t-p-h5-bold dash-rundown__time">{formatTime(e.start)}</span>
                  <span className="dash-rundown__body">
                    <span className="t-p-h4-bold one-line" title={e.title}>{e.title}</span>
                    <span className="t-p-h5 dash-room">
                      <span className="room-dot" />
                      <span className="one-line" title={roomName(e.roomId)}>
                        {roomName(e.roomId)}
                        {e.pic ? ` · PIC ${e.pic}` : ""}
                      </span>
                    </span>
                    {s === "now" && <Badge type="now">Sekarang</Badge>}
                    {s === "next" && <Badge type="next" icon="Clock">Berikutnya</Badge>}
                    {s === "done" && <Badge type="done">Selesai</Badge>}
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel
          icon="Clock"
          tone="slate"
          title="Aktivitas terbaru"
          footer={
            <Button block size="small" style="tertiary" icon="ArrowRight" onClick={() => onNavigate("tamu")}>
              Lihat daftar tamu
            </Button>
          }
        >
          {activity.length === 0 ? (
            <Empty icon="Clock" tone="slate" title="Belum ada aktivitas" body="Check-in dibuka di hari H." />
          ) : (
            <ul className="dash-activity">
              {activity.map((a, i) => {
                const k = ACTIVITY[a.kind];
                return (
                  <li key={i} className={`dash-activity__item${i === 0 ? " is-new" : ""}`}>
                    <Avatar initial={a.guest.charAt(0)} size="S" />
                    <span className="dash-activity__text">
                      <span className="t-p-h4 one-line" title={`${a.guest} ${k.text}`}>
                        <strong>{a.guest}</strong> {k.text}
                      </span>
                      <span className="t-p-h5 admin-muted one-line">
                        {SHOW_CHECKIN_TIME ? `${formatTime(a.at)} · ` : ""}{ago(now - a.at)}{a.detail ? ` · ${a.detail}` : ""}
                      </span>
                      <Badge type={k.type} icon={k.icon}>
                        {k.tag}
                      </Badge>
                    </span>
                    {i === 0 && <span className="dash-activity__new" aria-label="Terbaru" />}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="admin-col">
          {/* One orange card: what's on now, then what's next */}
          <section className="dash-hero clay clay-accent">
            {live ? (
              <div className="dash-hero__now">
                <span className="agenda-card__tags">
                  <Badge type="now">Sekarang</Badge>
                </span>
                <span className="dash-hero__title">{live.title}</span>
                <span className="t-p-h4">
                  {roomName(live.roomId)} · PIC {live.pic ?? "–"}
                </span>
                {startedMin !== undefined ? (
                  <LiveTimer start={startedMin} end={startedMin + (live.end - live.start)} endsAt={stage!.startedAt + (live.end - live.start) * 60_000} now={now} />
                ) : (
                  <LiveTimer start={live.start} end={live.end} now={now} />
                )}
                <Button block size="small" style="secondary" icon="Check" onClick={() => onEndEvent(live.id)}>
                  Selesaikan acara
                </Button>
              </div>
            ) : (
              <div className="dash-hero__now">
                <span className="agenda-card__tags">
                  <Badge type={phase === "ended" ? "claimed" : "next"} icon={phase === "ended" ? "Check" : "Clock"}>
                    {phase === "pre" ? "Belum mulai" : phase === "ended" ? "Selesai" : "Jeda"}
                  </Badge>
                </span>
                <span className="dash-hero__title">{phase === "pre" ? `${daysLeft} hari lagi` : phase === "ended" ? "Semua acara selesai" : "Tidak ada acara berjalan"}</span>
                {phase === "pre" && <span className="t-p-h4">{yes} tamu akan datang.</span>}
                {phase === "ended" && (
                  <Button block size="small" style="secondary" icon="ArrowRight" onClick={() => onNavigate("feedback")}>
                    Lihat feedback
                  </Button>
                )}
              </div>
            )}
            {next && (
              <div className="dash-hero__next">
                <span className="t-p-h5-bold dash-hero__label">{phase === "pre" ? "Acara pertama" : "Berikutnya"}</span>
                <span className="t-p-h3-bold one-line" title={next.title}>{next.title}</span>
                <span className="t-p-h5">
                  {roomName(next.roomId)} · {formatTime(next.start)}–{formatTime(next.end)}
                </span>
                {/* As on the MC's screen: the next one starts once the one on stage has ended. */}
                {phase === "live" && !(stage && live) && (
                  <Button block size="small" style="tertiary" icon="ArrowRight" onClick={() => onStartEvent(next.id)}>
                    Mulai sekarang
                  </Button>
                )}
              </div>
            )}
          </section>

          <Panel
            icon="Megaphone"
            tone="coral"
            title="Pengumuman terakhir"
            footer={
              <Button block size="small" style="tertiary" icon="Plus" onClick={() => onNavigate("pengumuman")}>
                Pengumuman baru
              </Button>
            }
          >
            {lastAnn ? (
              <div className="dash-ann">
                <span className="t-p-h4-bold">{lastAnn.title}</span>
                <span className="t-p-h5 admin-muted">{lastAnn.body}</span>
                <span className="t-p-h5 admin-muted">
                  {formatTime(lastAnn.at)} · {lastAnn.recipients} tamu
                </span>
              </div>
            ) : (
              <Empty icon="Megaphone" tone="coral" title="Belum ada pengumuman" />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
