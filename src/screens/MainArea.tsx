import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgendaMini } from "../components/AgendaMini";
import { Avatar } from "../components/Avatar";
import { BottomNav, type NavTab } from "../components/BottomNav";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { RoomHeader, type RewardState } from "../components/RoomHeader";
import { RoomIndicator } from "../components/RoomIndicator";
import { OfflineBanner } from "../components/SystemState";
import { Toast, ToastIcon } from "../components/Toast";
import { KENALAN_TARGET } from "../config";
import { announcementKey, announcementSub, type GuestAnnouncement } from "../data/adapters";
import { currentItem, nextItem } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import "./MainArea.css";

const SWIPE_THRESHOLD = 60;
const DRAG_START = 8;
const EDGE_RESISTANCE = 0.3;
/**
 * How many rooms either side of the current one get their illustration.
 * The track holds all five panels, but painting all five at once meant the
 * guest downloaded every room the moment they walked in. One neighbour each
 * way is enough: a swipe only ever moves one room, so the next panel is
 * already there when it slides into view.
 */
const ROOM_PRELOAD = 1;

const nearby = (index: number) => ROOMS.map((_, i) => i).filter((i) => Math.abs(i - index) <= ROOM_PRELOAD);
const TOAST_CLOSE_MS = 200;
const MOVE_COUNTDOWN_S = 5;

/**
 * Which notification story to play when the main area opens (first visit or a review link).
 * "intro" is the review version of arriving, with sample arrivals; "masuk" is a
 * real guest arriving, which only gets the heads-up about the session on now.
 */
export type MainScenario = "intro" | "masuk" | "ramai" | "segera" | "berubah" | "hadiah" | "setelah-feedback" | "none";

type ToastSpec = { key: string; lead: ReactNode; title: string; sub: string; action?: ReactNode; actions?: ReactNode };

type MainAreaProps = {
  name: string;
  kenalanCount: number;
  reward: RewardState;
  roomIndex: number;
  onRoomChange: (index: number) => void;
  onTab: (tab: NavTab) => void;
  /** Rundown clock in minutes since 00:00. */
  now: number;
  ended: boolean;
  offline: boolean;
  scenario: MainScenario;
  onScenarioPlayed: () => void;
  onOpenReward: () => void;
  /** Absent when the session on now has no Q&A. */
  onAsk?: () => void;
  /** The final survey is in: the ended card offers the memory card instead. */
  feedbackSent: boolean;
  /** A committee announcement not yet shown to this guest. */
  announcement?: GuestAnnouncement;
  onAnnouncementShown?: (id: string) => void;
};

/** Main area: the character stands in the middle of a Potara room; every action floats on top. */
export function MainArea({
  name,
  kenalanCount,
  reward,
  roomIndex,
  onRoomChange,
  onTab,
  now,
  ended,
  offline,
  scenario,
  onScenarioPlayed,
  onOpenReward,
  onAsk,
  feedbackSent,
  announcement,
  onAnnouncementShown,
}: MainAreaProps) {
  const [toast, setToast] = useState<ToastSpec | null>(null);
  const [toastClosing, setToastClosing] = useState(false);
  const [moveLeft, setMoveLeft] = useState(MOVE_COUNTDOWN_S);
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const toastTimers = useRef<number[]>([]);

  const live = ended ? undefined : currentItem(now);
  const upcoming = ended ? undefined : nextItem(now);
  const liveRoom = live ? roomIndexById(live.roomId) : -1;

  const clearToastTimers = () => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
  };
  const closeToast = () => {
    clearToastTimers();
    setToastClosing(true);
    toastTimers.current = [window.setTimeout(() => setToast(null), TOAST_CLOSE_MS)];
  };
  // Show a toast for `ms`, then scale it back out. A new toast replaces the current one.
  const showToast = (next: ToastSpec, ms: number) => {
    clearToastTimers();
    setToast(next);
    setToastClosing(false);
    toastTimers.current = [window.setTimeout(closeToast, ms)];
  };

  const goTo = (i: number) => onRoomChange(Math.max(0, Math.min(ROOMS.length - 1, i)));

  // Event-start notice: count down, then move the guest to the event room unless they chose to stay.
  const startMoveNotice = (event: string, target: number) => {
    const moveNow = () => {
      goTo(target);
      closeToast();
    };
    clearToastTimers();
    setToastClosing(false);
    setMoveLeft(MOVE_COUNTDOWN_S);
    setToast({
      key: "move",
      lead: <ToastIcon icon="MapPin" tone="accent" />,
      title: `${event} dimulai di ${ROOMS[target].name}`,
      sub: "",
      actions: (
        <>
          <Button style="tertiary" size="small" onClick={closeToast}>
            Tetap di sini
          </Button>
          <Button style="secondary" size="small" onClick={moveNow}>
            Pindah sekarang
          </Button>
        </>
      ),
    });
    for (let s = 1; s <= MOVE_COUNTDOWN_S; s++) {
      toastTimers.current.push(window.setTimeout(() => (s < MOVE_COUNTDOWN_S ? setMoveLeft(MOVE_COUNTDOWN_S - s) : moveNow()), s * 1000));
    }
  };

  const greet = <Button size="small" style="secondary" onClick={() => onTab("kenalan")}>Sapa</Button>;

  // Notification stories. Each runs once; the parent then sets the scenario back to "none".
  useEffect(() => {
    if (scenario === "none") return;
    onScenarioPlayed();
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers: number[] = [];
    if (scenario === "intro") {
      timers.push(
        at(1200, () =>
          showToast(
            { key: "first", lead: <ToastIcon icon="Sparkle" tone="accent" />, title: "Kamu yang pertama hadir!", sub: "Nanti aku kabari kalau ada yang datang." },
            5000,
          ),
        ),
        at(8000, () => showToast({ key: "hadir", lead: <Avatar initial="N" />, title: "Nanda baru saja hadir", sub: "Ayo sapa dan kenalan!", action: greet }, 5000)),
      );
      if (live && liveRoom !== roomIndex) timers.push(at(15000, () => startMoveNotice(live.title, liveRoom)));
    }
    if (scenario === "masuk" && live && liveRoom !== roomIndex) {
      timers.push(at(1500, () => startMoveNotice(live.title, liveRoom)));
    }
    if (scenario === "setelah-feedback") {
      timers.push(
        at(400, () =>
          showToast(
            { key: "thanks", lead: <ToastIcon icon="Check" tone="accent" />, title: "Terima kasih atas feedbackmu!", sub: "Tercatat sebagai anonim." },
            3000,
          ),
        ),
      );
      // Then the usual heads-up before moving to the event that's on now.
      if (live && liveRoom !== roomIndex) timers.push(at(3800, () => startMoveNotice(live.title, liveRoom)));
    }
    if (scenario === "ramai") {
      timers.push(
        at(1200, () =>
          showToast(
            {
              key: "group",
              lead: (
                <span className="avatar-stack">
                  <Avatar initial="N" size="S" />
                  <Avatar initial="A" size="S" />
                  <Avatar initial="D" size="S" />
                </span>
              ),
              title: "Nanda +2 orang baru hadir",
              sub: "Ruang kerja utama makin ramai.",
            },
            5000,
          ),
        ),
        at(7500, () =>
          showToast(
            {
              key: "crowd",
              lead: <ToastIcon icon="Users" tone="accent" />,
              title: "12 orang sudah hadir",
              sub: `Ayo kenalan, kumpulkan ${KENALAN_TARGET} kartu.`,
              action: <Button size="small" style="secondary" onClick={() => onTab("kenalan")}>Kenalan</Button>,
            },
            6000,
          ),
        ),
      );
    }
    if (scenario === "segera" && upcoming) {
      const target = roomIndexById(upcoming.roomId);
      timers.push(
        at(1000, () =>
          showToast(
            {
              key: "soon",
              lead: <ToastIcon icon="Clock" tone="accent" />,
              title: `${upcoming.title} dimulai ${upcoming.start - now} menit lagi`,
              sub: `Di ${ROOMS[target].name}. Kami antar kamu saat mulai.`,
            },
            7000,
          ),
        ),
      );
    }
    if (scenario === "berubah") {
      timers.push(
        at(1000, () =>
          showToast(
            {
              key: "changed",
              lead: <ToastIcon icon="Calendar" tone="accent" />,
              title: "Rundown berubah",
              sub: "Pengenalan kantor diundur 15 menit.",
              action: <Button size="small" style="secondary" onClick={() => onTab("agenda")}>Lihat</Button>,
            },
            7000,
          ),
        ),
      );
    }
    if (scenario === "hadiah") {
      timers.push(
        at(1000, () =>
          showToast(
            {
              key: "reward",
              lead: <ToastIcon icon="Gift" tone="accent" />,
              title: "Jangan lupa tukar hadiahmu",
              sub: "Sebelum pulang, mampir ke meja panitia ya.",
              action: <Button size="small" style="secondary" onClick={onOpenReward}>Tukar</Button>,
            },
            8000,
          ),
        ),
      );
    }
    return () => {
      timers.forEach(clearTimeout);
      toastTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Announcements from the committee or the MC, as they arrive. Keyed by id
  // and time, so a resend (same id, new time) plays again.
  const announcementSeen = announcement && announcementKey(announcement);
  useEffect(() => {
    if (!announcement) return;
    showToast(
      {
        key: `ann-${announcementSeen}`,
        lead: <ToastIcon icon="Megaphone" tone="accent" />,
        title: announcement.title,
        sub: announcementSub(announcement),
      },
      8000,
    );
    onAnnouncementShown?.(announcement.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementSeen]);

  const room = ROOMS[roomIndex];
  const atEdge = (dx: number) => (dx > 0 && roomIndex === 0) || (dx < 0 && roomIndex === ROOMS.length - 1);

  // Grows only, so swiping back never re-flashes a bare panel.
  const [painted, setPainted] = useState(() => nearby(roomIndex));
  useEffect(() => {
    setPainted((prev) => {
      const added = nearby(roomIndex).filter((i) => !prev.includes(i));
      return added.length ? [...prev, ...added] : prev;
    });
  }, [roomIndex]);

  const endDrag = (dx: number) => {
    if (drag.current?.active && Math.abs(dx) > SWIPE_THRESHOLD && !atEdge(dx)) goTo(roomIndex + (dx < 0 ? 1 : -1));
    drag.current = null;
    setDragX(0);
  };

  const agenda = ended ? (
    <AgendaMini type="ended" feedbackSent={feedbackSent} onFeedback={() => onTab("feedback")} />
  ) : live ? (
    <AgendaMini
      type="now"
      title={live.title}
      next={upcoming?.title}
      room={ROOMS[liveRoom].name}
      here={roomIndex === liveRoom}
      onClick={() => onTab("agenda")}
      onGoToRoom={() => goTo(liveRoom)}
      onAsk={onAsk}
    />
  ) : upcoming ? (
    <AgendaMini
      type="between"
      title={upcoming.title}
      minutesLeft={upcoming.start - now}
      room={ROOMS[roomIndexById(upcoming.roomId)].name}
      here={roomIndex === roomIndexById(upcoming.roomId)}
      onClick={() => onTab("agenda")}
      onGoToRoom={() => goTo(roomIndexById(upcoming.roomId))}
    />
  ) : null;

  return (
    <main
      className="main-area"
      onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, active: false })}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        // Only treat it as a room swipe once the gesture is clearly horizontal.
        if (!d.active && Math.abs(dx) > DRAG_START && Math.abs(dx) > Math.abs(e.clientY - d.y)) d.active = true;
        if (d.active) setDragX(atEdge(dx) ? dx * EDGE_RESISTANCE : dx);
      }}
      onPointerUp={(e) => drag.current && endDrag(e.clientX - drag.current.x)}
      onPointerCancel={() => endDrag(0)}
      onPointerLeave={(e) => drag.current && endDrag(e.clientX - drag.current.x)}
    >
      {/* Layer 1: room illustrations, side by side; follows the finger while dragging */}
      <div
        className={`room-track${dragX !== 0 ? " is-dragging" : ""}`}
        style={{ transform: `translateX(calc(-${roomIndex * 100}% + ${dragX}px))` }}
      >
        {ROOMS.map((r, i) => (
          <section
            key={r.id}
            className="room"
            aria-hidden={r.id !== room.id}
            style={painted.includes(i) ? { backgroundImage: `url(${r.image})` } : undefined}
          />
        ))}
      </div>

      {/* Layer 2: floating actions */}
      <div className="main-area__top">
        <RoomHeader name={name} kenalanCount={kenalanCount} kenalanTarget={KENALAN_TARGET} reward={reward} onKenalan={() => onTab("kenalan")} />
        {offline && <OfflineBanner />}
        {agenda}
        {/* Notifications grow out from under the agenda card, clear of the character */}
        {toast && (
          <Toast
            key={toast.key}
            lead={toast.lead}
            title={toast.title}
            sub={toast.key === "move" ? `Kamu pindah ke sana dalam ${moveLeft} detik` : toast.sub}
            action={toast.action}
            actions={toast.actions}
            closing={toastClosing}
          />
        )}
      </div>

      <div className="main-area__stage">
        <Character />
      </div>

      <div className="main-area__bottom">
        <RoomIndicator name={room.name} index={roomIndex} total={ROOMS.length} live={roomIndex === liveRoom} />
        <BottomNav
          active="ruangan"
          feedbackLocked={!ended}
          onChange={onTab}
          onLockedTap={() =>
            showToast(
              {
                key: "locked",
                lead: <ToastIcon icon="Lock" />,
                title: "Feedback belum dibuka",
                sub: "Dibuka setelah acara selesai. Nikmati dulu acaranya!",
              },
              3000,
            )
          }
        />
      </div>
    </main>
  );
}
