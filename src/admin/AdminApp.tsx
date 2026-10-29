import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminApi,
  adminPhotoSrc,
  endSession,
  loadSession,
  loadSessionEmail,
  patchStageAsAdmin,
  pullStageAsAdmin,
  resetStageAsAdmin,
  useStageWatchAsAdmin,
  type AdminPerson,
  type WireSettings,
  type AdminFeedback,
  EMPTY_FEEDBACK,
} from "./api";
import { AdminGallery } from "./Gallery";
import { firstName, type GalleryState } from "../data/gallery";
import { useRundownMinute } from "../data/clock";
import { KENALAN_TARGET } from "../config";
import { ApiError } from "../data/http";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Toast, ToastIcon } from "../components/Toast";
import type { IconName } from "../components/iconPaths";
import { DEMO_NOW, DOOR_CODE, EVENT, PANITIA_PIN } from "../config";
import { formatTime, setAgenda } from "../data/agenda";
import { ROOMS, roomIndexById } from "../data/rooms";
import { AdminShell, type AdminPage } from "./AdminShell";
import { AdminOfflineBanner, AdminSystem } from "./AdminSystem";
import { Announcements } from "./Announcements";
import { Dashboard, type Activity, type Phase } from "./Dashboard";
import {
  ADMIN_EMAIL,
  ADMIN_EVENTS,
  ADMIN_GUESTS,
  NEW_INVITEES,
  SAMPLE_ANNOUNCEMENTS,
  SAMPLE_EVENT_FEEDBACK,
  SAMPLE_EVENT_FEEDBACK_ALL,
  SAMPLE_FINAL_FEEDBACK,
  type AdminEvent,
  type AdminGuest,
  type Announcement,
} from "./data";
import { Feedback } from "./Feedback";
import { Guests } from "./Guests";
import { DEFAULT_TEMPLATE } from "./invite";
import { Login } from "./Login";
import { ADMIN_LINKS } from "./links";
import { Notifications, type AdminNotice } from "./Notifications";
import { Rewards } from "./Rewards";
import { Rundown } from "./Rundown";
import { Settings, type AdminSettings } from "./Settings";
import { Undangan } from "./Undangan";
import { Pengisi, type Access } from "./Pengisi";
import type { Person, ScriptPart } from "../stage/data";
import { EMPTY_STAGE, patchStage, read as readStage, useStageWatch, type StageState } from "../stage/store";
import { HELP_LABEL, PEOPLE } from "../stage/data";

const NOW: Record<Phase, number> = { pre: 8 * 60, live: DEMO_NOW.live, ended: DEMO_NOW.ended };
/** Review cases' frozen "today". Live uses the real one. */
const TODAY = new Date(2026, 9, 25);
const NOOP = () => undefined;
/** How often the live admin re-reads what other people change: MC sign-ins, MC announcements. */
const REFRESH_MS = 20_000;

/** Local midnight, so a day count does not depend on the hour it is asked at. */
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Where the live event stands, from the date in Pengaturan and the rundown.
 *
 * Before the day: "pre". On the day it is "live" until the last session has
 * ended -- including the morning before the first one, which the dashboard
 * shows as "Berikutnya" rather than a countdown of zero days. After: "ended".
 */
function livePhase(date: Date, events: AdminEvent[], now: number): { phase: Phase; daysLeft: number } {
  const daysLeft = Math.round((dayOf(date) - dayOf(new Date())) / 86_400_000);
  if (daysLeft > 0) return { phase: "pre", daysLeft };
  if (daysLeft < 0) return { phase: "ended", daysLeft: 0 };
  const lastEnd = events.length ? Math.max(...events.map((e) => e.end)) : Infinity;
  return { phase: now >= lastEnd ? "ended" : "live", daysLeft: 0 };
}

const newGuest = (id: string, name: string, phone: string): AdminGuest => ({
  id,
  name,
  email: "",
  rsvp: "belum",
  checkIn: null,
  hadir: false,
  phone,
  invite: "belum",
  cards: 0,
  reward: "mengumpulkan",
  finalFeedback: false,
});

/** Before D-day nobody has checked in or collected cards yet. Uninvited guests and one failed send are there in every phase. */
function guestsFor(phase: Phase): AdminGuest[] {
  const base: AdminGuest[] =
    phase === "pre"
      ? ADMIN_GUESTS.map((g) => ({ ...g, checkIn: null, checkInBy: undefined, hadir: false, cards: 0, reward: "mengumpulkan", claimedAt: undefined }))
      : ADMIN_GUESTS;
  const firstPending = base.findIndex((g) => g.rsvp === "belum");
  return [
    ...NEW_INVITEES.map((n) => newGuest(`baru-${n.name.toLowerCase()}`, n.name, n.phone)),
    ...base.map((g, i) => (i === firstPending ? { ...g, invite: "gagal" as const, inviteError: "Nomor tidak terdaftar di WhatsApp" } : g)),
  ];
}

/** Recent things guests did, newest first. Feedback is anonymous, so it never carries a name. */
/**
 * "Aktivitas terakhir": what has actually happened, newest first.
 *
 * Every line is derived from a row -- a check-in, a prize, a rating -- so the
 * feed cannot describe something the database does not have. It used to mix
 * in SAMPLE_EVENT_FEEDBACK, which is why anonymous guests kept rating a
 * session nobody had run.
 *
 * `events` is passed so a rating can name its session; `feedback` is the real
 * per-session feedback, already loaded for the Feedback page.
 */
function activityOf(
  guests: AdminGuest[],
  events: AdminEvent[],
  feedback: AdminFeedback["events"] | undefined,
  now: number,
): Activity[] {
  const list: Activity[] = [];
  guests.forEach((g) => {
    if (g.checkIn !== null && g.checkInBy) list.push({ at: g.checkIn, guest: g.name, kind: g.checkInBy });
    // "Siap ambil hadiah" has no timestamp of its own -- it is a consequence
    // of the fifth card -- so it is filed at the claim if there is one, and
    // at the check-in otherwise. Never invented minutes ahead of either.
    if (g.reward !== "mengumpulkan" && g.checkIn !== null) {
      list.push({ at: g.claimedAt ?? g.checkIn, guest: g.name, kind: "reward-ready", detail: `${g.cards}/${KENALAN_TARGET} kartu` });
    }
    if (g.reward === "diambil" && g.claimedAt) list.push({ at: g.claimedAt, guest: g.name, kind: "reward-claimed" });
  });

  const titleOf = (id: string) => events.find((e) => e.id === id)?.title ?? id;
  // `?? {}` on purpose: this screen is the committee's whole view of the
  // event, and a response that is missing a field should cost them one
  // panel, not the entire page. Object.entries(undefined) throws, and with
  // no error boundary above this that is a blank admin.
  Object.entries(feedback ?? {}).forEach(([eventId, rows]) =>
    rows.forEach((f) => list.push({ at: f.at, guest: "Tamu anonim", kind: "feedback", detail: `${titleOf(eventId)} · ${f.rating}/5` })),
  );

  return list.filter((a) => a.at <= now).sort((a, b) => b.at - a.at).slice(0, 12);
}

const SAMPLE_NOTICES = (phase: Phase): AdminNotice[] =>
  phase === "pre"
    ? [
        { id: "n-gagal", kind: "action", icon: "Close", tone: "red", title: "1 undangan gagal terkirim", body: "Nomor tidak terdaftar di WhatsApp. Cek lalu kirim ulang.", at: 7 * 60 + 50, read: false, page: "undangan" },
        { id: "n-rsvp", kind: "info", icon: "ChatCheck", tone: "blue", title: "3 RSVP baru", body: "Laras, Dimas, dan Putri akan datang.", at: 7 * 60 + 30, read: true, page: "tamu" },
      ]
    : [
        { id: "n-hadiah", kind: "action", icon: "Gift", tone: "amber", title: "Sinta siap ambil hadiah", body: "5/5 kartu kenalan. Siapkan voucher di meja panitia.", at: NOW[phase] - 4, read: false, page: "hadiah" },
        { id: "n-gagal", kind: "action", icon: "Close", tone: "red", title: "1 undangan gagal terkirim", body: "Nomor tidak terdaftar di WhatsApp. Cek lalu kirim ulang.", at: NOW[phase] - 20, read: false, page: "undangan" },
        { id: "n-bentrok", kind: "info", icon: "Calendar", tone: "teal", title: "Talkshow mulai 10 menit lagi", body: "Ruang Omakase. Tamu otomatis dapat notifikasi.", at: NOW[phase] - 10, read: false, page: "rundown" },
        { id: "n-feedback", kind: "info", icon: "Star", tone: "pink", title: "5 feedback baru untuk Pembukaan", body: "Rata-rata 4,2 dari 5.", at: NOW[phase] - 45, read: true, page: "feedback" },
      ];

/** Sample of what the MC / speaker send to the committee. */
const STAGE_NOTICES: AdminNotice[] = [
  { id: "n-bantuan", kind: "action", icon: "Bell", tone: "red", title: "Ardi butuh bantuan", body: "Mic bermasalah · Ruang Omakase. Kirim tim ke panggung.", at: NOW.live - 1, read: false, page: "pengisi" },
  { id: "n-mc", kind: "action", icon: "Megaphone", tone: "red", title: "MC memanggil panitia", body: "Jadwal perlu digeser. Hampiri MC di panggung.", at: NOW.live - 2, read: false, page: "pengisi" },
];

/** Admin (desktop): same design system as the guest app, one access level, PIN-by-email sign-in. */
/**
 * live decides where the guest list comes from: the API, or the bundled
 * sample. Only an explicit ?demo= review case turns it off -- see AdminRoute.
 */
export function AdminApp({ token, live = true }: Readonly<{ token: string; live?: boolean }>) {
  const sc = ADMIN_LINKS[token] ?? ADMIN_LINKS["admin-404"];
  /**
   * Live, "signed in" means holding a session the server will accept -- not
   * what the scenario says. The default review link is signedIn: true so a
   * reviewer lands on the dashboard without typing a PIN, which was harmless
   * while nothing was behind it and is now exactly wrong: it would claim to
   * be signed in with no session, and every request would come back 401.
   */
  const [signedIn, setSignedIn] = useState(live ? loadSession() !== null : sc.signedIn);
  const [page, setPage] = useState<AdminPage>(sc.page);
  const [system, setSystem] = useState(token in ADMIN_LINKS ? sc.system : "404");
  const [demoPhase] = useState<Phase>(sc.phase);
  /**
   * The real clock, ticking, when this is the live admin. A review link keeps
   * its frozen time, because the whole point of those is a screen that looks
   * the same every time it is opened.
   *
   * This was frozen for everyone. It is why rows seemed to appear by
   * themselves: real check-ins arrive at whatever minute it actually is and
   * were being compared against a clock stuck at 09:50.
   */
  const liveNow = useRundownMinute();
  const now = live ? liveNow : NOW[sc.phase];
  const [guests, setGuests] = useState<AdminGuest[]>(() => (live ? [] : guestsFor(sc.phase)));
  const [events, setEvents] = useState<AdminEvent[]>(live ? [] : ADMIN_EVENTS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    live || sc.phase === "pre" ? [] : sc.failAnnouncement ? [...SAMPLE_ANNOUNCEMENTS, { id: "a-gagal", title: "Makan siang siap", body: "Silakan ke Ruang Meeting.", roomId: "ruang-meeting", at: NOW.live - 3, recipients: 22, read: 0, failed: true }] : SAMPLE_ANNOUNCEMENTS,
  );
  const [settings, setSettings] = useState<AdminSettings>({
    eventName: EVENT.name,
    date: new Date(2026, 10, 8),
    place: { name: EVENT.place, address: "Jl. Kemang Raya No. 18, Bangka, Mampang Prapatan, Jakarta Selatan" },
    doorCode: DOOR_CODE,
    panitiaPin: PANITIA_PIN,
    countdown: true,
    finalFeedbackAt: 13 * 60 + 30,
    codesChangedAt: 7 * 60 + 45,
    inviteTemplate: "",
    contact: { name: "", phone: "" },
  });
  /** One template for both: live it is a settings field, so it survives a reload and reaches the server's wa.me links. */
  const template = settings.inviteTemplate || DEFAULT_TEMPLATE;
  /**
   * Live: the MC and speakers the committee added, starting from none. Their
   * "Akses" comes with each row from the server; the map below is only the
   * review cases' sample.
   */
  const [people, setPeople] = useState<AdminPerson[]>(live ? [] : PEOPLE);
  const [demoAccess, setDemoAccess] = useState<Record<string, Access>>(live ? {} : { nadia: "masuk", ardi: "terkirim" });
  const access: Record<string, Access> = live ? Object.fromEntries(people.map((p) => [p.id, p.access ?? "belum"])) : demoAccess;
  /**
   * Live: the shared stage document -- what the MC has actually started and
   * ended. null until the first read; review cases never set it, so their
   * dashboard keeps reading the frozen clock.
   */
  const [stage, setStage] = useState<StageState | null>(null);
  /** Announcements sent from here that the server has not confirmed: a refresh must not drop them. */
  const drafts = useRef(new Set<string>());
  /**
   * Announcements deleted here: a refresh that left before the DELETE landed
   * would otherwise bring the row back for one tick.
   */
  const removed = useRef(new Set<string>());
  const { phase, daysLeft } = live ? livePhase(settings.date, events, now) : { phase: demoPhase, daysLeft: 14 };
  const [scripts, setScripts] = useState<Record<string, ScriptPart[]>>(() => readStage()?.scripts ?? {});
  /**
   * The bell starts empty on the live admin. Everything in it is raised by
   * something that happened -- a failed invitation, the MC calling for help
   * -- so a list that is already full on sign-in is describing an event that
   * did not take place.
   */
  const [notices, setNotices] = useState<AdminNotice[]>(() =>
    live ? [] : sc.stageNotices ? [...STAGE_NOTICES, ...SAMPLE_NOTICES(sc.phase)] : SAMPLE_NOTICES(sc.phase),
  );
  const [search, setSearch] = useState(sc.search ?? "");
  const [selected, setSelected] = useState<string | null>(sc.selected ?? null);
  const [inviteFor, setInviteFor] = useState<string | undefined>(sc.undangan?.single);
  const [sessionExpired, setSessionExpired] = useState(!!sc.sessionExpired);
  const [toast, setToast] = useState<{ icon: IconName; title: string; sub: string; action?: { label: string; page: AdminPage } } | null>(
    sc.actionToast ? { icon: "Gift", title: "Sinta siap ambil hadiah", sub: "5/5 kartu kenalan. Siapkan voucher di meja panitia.", action: { label: "Buka Hadiah", page: "hadiah" } } : null,
  );

  /**
   * Load the real guest list once the committee is in.
   *
   * Kept as plain state rather than react-query because everything else on
   * this screen already is: the admin edits its list optimistically in a
   * dozen places, and half-converting it would leave two sources of truth for
   * the same rows.
   */
  useEffect(() => {
    if (!live || !signedIn) return;
    let alive = true;
    void (async () => {
      try {
        // One trip for the whole admin: every page reads from this, and
        // fetching per page would make switching tabs feel like loading.
        const [rows, rundown, announced, set, crew] = await Promise.all([
          adminApi.guests(),
          adminApi.rundown(),
          adminApi.announcements(),
          adminApi.settings(),
          adminApi.people(),
        ]);
        if (!alive) return;
        // `?? []`: an empty table may come back as null from the API, and
        // every page here maps over these.
        setGuests(rows ?? []);
        setEvents(rundown ?? []);
        setAnnouncements(mergeAnnouncements(announced ?? [], [], drafts.current, removed.current));
        setSettings(fromWireSettings(set));
        setPeople(crew ?? []);
      } catch (e) {
        if (!alive) return;
        // A session that has expired -- they last 12 hours -- is not a
        // failure to report, it is a sign-in to repeat. Sending them to the
        // error screen would leave the only way back as clearing site data.
        if (e instanceof ApiError && e.status === 401) {
          endSession();
          setSignedIn(false);
          return;
        }
        // Anything else: showing an empty guest list would read as "nobody
        // has been invited yet", which is a worse lie than saying plainly
        // that something is wrong.
        setSystem("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [live, signedIn]);

  /**
   * What other people change, re-read every REFRESH_MS: the MC signing in
   * ("Sudah masuk" on Pengisi), announcing from the stage, and guests
   * checking themselves in at the door. The stage document has its own
   * stream; these tables do not.
   */
  useEffect(() => {
    if (!live || !signedIn) return;
    let alive = true;
    void pullStageAsAdmin()
      .then((s) => alive && setStage(s ?? EMPTY_STAGE()))
      .catch(() => {
        // The stream fills it in; until then the dashboard says nothing is on.
      });
    const t = window.setInterval(() => {
      if (document.hidden) return;
      // On its own: a failure here should not hold back the lists below.
      void adminApi
        .feedback()
        .then((f) => alive && setFeedback(f))
        .catch(() => undefined);
      void Promise.all([adminApi.people(), adminApi.announcements(), adminApi.guests()])
        .then(([crew, announced, rows]) => {
          if (!alive) return;
          setPeople(crew ?? []);
          // Rows just added here and not yet confirmed carry a placeholder
          // id (see onAdd); they stay until the server's answer replaces them.
          setGuests((gs) => [...gs.filter((g) => g.id.startsWith("baru-")), ...(rows ?? [])]);
          setAnnouncements((list) => mergeAnnouncements(announced ?? [], list, drafts.current, removed.current));
        })
        .catch((e: unknown) => {
          if (!alive) return;
          if (e instanceof ApiError && e.status === 401) {
            endSession();
            setSignedIn(false);
          }
          // Anything else: the next tick tries again, and the screen keeps what it had.
        });
    }, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [live, signedIn]);

  const notify = (icon: IconName, title: string, sub: string, action?: { label: string; page: AdminPage }) => {
    setToast({ icon, title, sub, action });
    window.setTimeout(() => setToast((t) => (t?.title === title ? null : t)), action ? 6000 : 3500);
  };
  /** Things that need the committee go to the bell and pop up as a toast. */
  const pushNotice = (n: Omit<AdminNotice, "id" | "at" | "read">) => {
    setNotices((list) => [{ ...n, id: `n${Date.now()}`, at: now, read: false }, ...list]);
    if (n.kind === "action") notify(n.icon, n.title, n.body, { label: "Lihat", page: n.page });
  };

  // MC / speaker calling for help shows up in the bell (and as a toast, since it needs action)
  const seenStage = useRef({ help: readStage()?.speakerSignal?.at ?? 0, call: readStage()?.panitiaCall?.at ?? 0 });
  const pushRef = useRef(pushNotice);
  pushRef.current = pushNotice;
  /** Read inside the stream callback, which is created once. */
  const crewRef = useRef({ people, events });
  crewRef.current = { people, events };
  const onStage = useCallback((st: StageState) => {
    setStage(st);
    const sig = st.speakerSignal;
    if (sig?.kind === "bantuan" && sig.at > seenStage.current.help) {
      seenStage.current.help = sig.at;
      // The speaker of the session on stage, not the first one on the list:
      // the signal itself does not say who sent it.
      const { people: crew, events: rundown } = crewRef.current;
      const session = rundown.find((e) => e.id === st.liveId);
      const sp = crew.find((p) => p.id === session?.speakerId) ?? crew.find((p) => p.role === "pembicara");
      const room = session ? ROOMS[roomIndexById(session.roomId)]?.name : undefined;
      pushRef.current({ kind: "action", icon: "Bell", tone: "red", title: `${sp?.name.split(" ")[0] ?? "Pembicara"} butuh bantuan`, body: `${HELP_LABEL[sig.help ?? "lainnya"]}${room ? ` · ${room}` : ""}. Kirim tim ke panggung.`, page: "pengisi" });
    }
    if (st.panitiaCall && st.panitiaCall.at > seenStage.current.call) {
      seenStage.current.call = st.panitiaCall.at;
      pushRef.current({ kind: "action", icon: "Megaphone", tone: "red", title: "MC memanggil panitia", body: `${st.panitiaCall.reason}. Hampiri MC di panggung.`, page: "pengisi" });
    }
  }, []);
  // Live listens with the committee's session; the stage store's own watch
  // would send the MC's token, which this laptop does not hold.
  useStageWatch(live ? NOOP : onStage);
  useStageWatchAsAdmin(onStage, live && signedIn);

  /**
   * The guest-side helpers (statusAt and friends, used by Dashboard, Rundown
   * and Feedback) read one shared agenda. Live, that is this rundown -- not
   * the bundled one -- including the committee's unsaved-to-guests edits.
   */
  useEffect(() => {
    if (live) setAgenda(events);
  }, [live, events]);

  /**
   * Feedback is loaded when its page opens, not with everything else.
   *
   * It is the one admin page nobody looks at until the event is under way,
   * and the rows only grow, so paying for them on every sign-in would be
   * waste. Re-fetched each time the page is opened, which is also how the
   * committee refreshes it.
   */
  /**
   * The gallery, loaded when its page is opened.
   *
   * `checked` is a list of ids here because that is what the screen asks --
   * "which have we already looked at" -- while the API keeps it as a flag per
   * photo. The fold happens here, at the seam.
   */
  const [gallery, setGallery] = useState<GalleryState>({ photos: [], checked: [] });
  const [galleryPhoto, setGalleryPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!live || !signedIn || page !== "galeri") return;
    let alive = true;
    const load = () =>
      void adminApi
        .photos()
        .then((rows) => {
          if (!alive) return;
          setGallery({
            photos: (rows ?? []).map((p) => ({ ...p, src: adminPhotoSrc(p.id), mine: false })),
            checked: (rows ?? []).filter((p) => p.checked).map((p) => p.id),
          });
        })
        .catch(() => {
          // The page's own empty state reads correctly, and the next tick
          // tries again. Not worth taking over their screen.
        });
    load();
    // Guests keep uploading during the event; the committee moderates as they come.
    const t = window.setInterval(() => !document.hidden && load(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [live, signedIn, page]);

  const [feedback, setFeedback] = useState<AdminFeedback>(EMPTY_FEEDBACK);
  useEffect(() => {
    // Also on the dashboard: "Aktivitas terakhir" lists ratings as they come
    // in, so waiting until somebody opens the Feedback page would leave the
    // feed quietly incomplete.
    if (!live || !signedIn || (page !== "feedback" && page !== "dashboard")) return;
    let alive = true;
    void adminApi
      .feedback()
      .then((f) => alive && setFeedback(f))
      .catch(() => {
        // The page renders "belum ada feedback", which is also what an empty
        // result looks like. Not worth a banner over the committee's screen.
      });
    return () => {
      alive = false;
    };
  }, [live, signedIn, page]);

  if (system)
    return (
      <AdminSystem
        kind={system}
        onAction={() => {
          setSystem(undefined);
          setPage("dashboard");
        }}
      />
    );
  if (!signedIn)
    return (
      <Login
        scenario={sc.login ?? "email"}
        onRequestPin={live ? (email) => adminApi.requestPin(email).then(() => undefined) : undefined}
        onSignedIn={async (email, pin) => {
          // A review case has no server behind it, so it signs in locally.
          if (live) await adminApi.verifyPin(email, pin);
          setSignedIn(true);
        }}
      />
    );

  const present = guests.filter((g) => g.checkIn !== null && g.hadir).length;
  const patchGuest = (id: string, patch: Partial<AdminGuest>) => setGuests((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const name = (id: string) => guests.find((g) => g.id === id)?.name ?? "";


  /**
   * Settings save as one row, from both the Pengaturan page and the PIN
   * change on Hadiah -- a partial update would let the two interleave into a
   * row neither of them chose.
   *
   * This one is not optimistic about failure the way guest actions are: the
   * door code is what every arriving guest is checked against, so the screen
   * must not keep showing a code the server refused.
   */
  const saveSettings = (next: AdminSettings, title: string, sub: string) => {
    const before = settings;
    setSettings(next);
    if (!live) return notify("Check", title, sub);
    void adminApi
      .saveSettings(toWireSettings(next))
      .then(() => notify("Check", title, sub))
      .catch((e: unknown) => {
        setSettings(before);
        notify("Close", "Pengaturan gagal disimpan", e instanceof Error ? e.message : "Coba lagi.");
      });
  };

  /**
   * A committee action on one guest: show it immediately, then make it true.
   *
   * Optimistic because the committee is standing at a door with a queue
   * behind them, and a spinner per guest is the wrong trade. Rolled back on
   * failure, because the alternative -- a row that says "hadir" while the
   * database says otherwise -- is the bug that makes the whole screen
   * untrustworthy. The guest's previous row is kept, not reconstructed, so
   * the rollback restores exactly what was there.
   */
  const guestAction = (id: string, patch: Partial<AdminGuest>, call: () => Promise<unknown>) => {
    const before = guests.find((g) => g.id === id);
    patchGuest(id, patch);
    if (!live) return;
    void call().catch((e: unknown) => {
      if (before) setGuests((gs) => gs.map((g) => (g.id === id ? before : g)));
      notify("Close", `Gagal menyimpan ${before?.name ?? "perubahan"}`, e instanceof Error ? e.message : "Coba lagi.");
    });
  };

  /**
   * MC and speakers: saved on the server first, then shown. Not optimistic,
   * because the id the server mints is what their personal link carries --
   * a row without it has no link to send.
   */
  const savePerson = async (p: Person | Omit<Person, "id">) => {
    const saved = "id" in p ? await adminApi.savePerson(p) : await adminApi.addPerson(p);
    setPeople((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]));
    notify("Check", "id" in p ? "Data pengisi disimpan" : `${saved.name} ditambahkan`, "Kirim link pribadinya dari daftar ini.");
  };
  const deletePerson = async (id: string) => {
    const gone = people.find((p) => p.id === id);
    await adminApi.deletePerson(id);
    setPeople((list) => list.filter((p) => p.id !== id));
    // The server unassigns their sessions; the rundown here follows.
    setEvents((es) => es.map((e) => (e.speakerId === id ? { ...e, speakerId: undefined } : e)));
    notify("Trash", `${gone?.name ?? "Pengisi"} dihapus`, "Linknya sudah tidak berlaku.");
  };

  /**
   * A committee write to the shared stage document, shown at once. On a
   * refusal the screen goes back to whatever the server holds, rather than
   * keeping a session "on stage" that the MC's screen never saw.
   */
  const stageAction = (fn: (s: StageState) => StageState, failTitle: string) => {
    setStage((s) => fn(s ?? EMPTY_STAGE()));
    void patchStageAsAdmin(fn).catch((e: unknown) => {
      notify("Close", failTitle, e instanceof Error ? e.message : "Coba lagi.");
      void pullStageAsAdmin()
        .then((s) => setStage(s ?? EMPTY_STAGE()))
        .catch(() => undefined);
    });
  };

  /**
   * A change to someone's personal link: shown at once, then the list is
   * re-read, because "access" is the server's to derive -- an invite to
   * someone already signed in stays "Sudah masuk".
   */
  const personAction = (id: string, optimistic: Access, call: () => Promise<unknown>) => {
    setPeople((list) => list.map((p) => (p.id === id && (optimistic === "dicabut" || p.access !== "masuk") ? { ...p, access: optimistic } : p)));
    void call()
      .catch((e: unknown) => notify("Close", "Gagal menyimpan akses", e instanceof Error ? e.message : "Coba lagi."))
      .finally(() => {
        void adminApi
          .people()
          .then((rows) => setPeople(rows ?? []))
          .catch(() => undefined);
      });
  };

  const goTo = (p: AdminPage) => {
    setPage(p);
    if (p !== "tamu") setSelected(null);
    if (p !== "undangan") setInviteFor(undefined);
  };

  return (
    <AdminShell
      page={page}
      onNavigate={goTo}
      now={now}
      search={search}
      onSearch={(q) => {
        setSearch(q);
        if (q && page !== "tamu") setPage("tamu");
      }}
      counts={{ hadiah: guests.filter((g) => g.reward === "siap").length, undangan: guests.filter((g) => g.rsvp === "belum" && g.invite === "gagal").length }}
      email={live ? (loadSessionEmail() ?? "") : ADMIN_EMAIL}
      onLogout={() => {
        endSession();
        setSignedIn(false);
      }}
      banner={sc.offline ? <AdminOfflineBanner /> : undefined}
      bell={
        <Notifications
          notices={notices}
          now={now}
          initialOpen={sc.notifOpen}
          onOpen={(n) => {
            setNotices((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
            goTo(n.page);
            if (n.guestId) setSelected(n.guestId);
          }}
          onReadAll={() => setNotices((list) => list.map((x) => ({ ...x, read: true })))}
        />
      }
    >
      {page === "dashboard" && (
        <Dashboard
          // The stage outranks the calendar: a session the MC started is on
          // whatever the date says (a rehearsal, a rundown running late).
          phase={live && stage && stage.phase !== "pre" ? stage.phase : phase}
          daysLeft={daysLeft}
          now={now}
          guests={guests}
          events={events}
          announcements={announcements}
          activity={activityOf(guests, events, live ? feedback.events : {}, now)}
          stage={live ? stage : undefined}
          onNavigate={goTo}
          onEndEvent={(id) => {
            const ev = events.find((e) => e.id === id)!;
            notify("Check", `${ev.title} diselesaikan`, `Form feedback dikirim ke ${present} tamu.`);
            if (!live) return setEvents((es) => es.map((e) => (e.id === id ? { ...e, end: now } : e)));
            // The MC's own "selesai" (stage/McApp endSession), field for field,
            // so the MC's screen, the speaker's and the guests' move with it.
            stageAction((s) => {
              if (s.liveId !== id) return s; // already ended, by the MC or another laptop
              const last = !events.some((e) => e.id !== id && !s.doneIds.includes(e.id));
              return {
                ...s,
                liveId: null,
                doneIds: [...s.doneIds, id],
                phase: last ? "ended" : s.phase,
                speaker: ev.speakerId ? "selesai" : s.speaker,
                mcSignal: ev.speakerId ? { kind: "terima-kasih", at: Date.now() } : s.mcSignal,
              };
            }, "Gagal menyelesaikan sesi");
          }}
          onStartEvent={(id) => {
            const ev = events.find((e) => e.id === id)!;
            notify("ArrowRight", `${ev.title} dimulai`, `Tamu dapat notifikasi pindah ke ${ROOMS[roomIndexById(ev.roomId)].name}.`);
            if (!live) return setEvents((es) => es.map((e) => (e.id === id ? { ...e, start: now, end: now + (e.end - e.start) } : e)));
            // The MC's "mulai" (stage/McApp startSession). The rundown keeps its
            // planned times; the real start is the stage's startedAt.
            stageAction(
              (s) => ({ ...s, phase: "live", liveId: id, startedAt: Date.now(), speaker: ev.speakerId ? "live" : s.speaker, mcSignal: null }),
              "Gagal memulai sesi",
            );
          }}
        />
      )}
      {page === "undangan" && (
        <Undangan
          guests={guests}
          now={now}
          template={template}
          initialTab={sc.undangan?.tab}
          initialSelected={sc.undangan?.selected}
          initialDialog={sc.undangan?.dialog}
          initialSingle={inviteFor}
          onPatch={patchGuest}
          onAdd={(rows) => {
            const stamp = Date.now();
            // Optimistic: the rows appear straight away, each with a
            // placeholder id. The server then answers with the real guest --
            // real id, real invite token -- and that replaces the placeholder.
            // Without the swap the committee could press "kirim undangan" on
            // a guest the server has never heard of.
            const added = rows.map((r, i) => newGuest(`baru-${stamp}-${i}`, r.name, r.phone));
            setGuests((gs) => [...added, ...gs]);

            if (live) {
              added.forEach((placeholder, i) => {
                void adminApi
                  .addGuest(rows[i].name, rows[i].phone)
                  .then((saved) => setGuests((gs) => gs.map((g) => (g.id === placeholder.id ? saved : g))))
                  .catch((e: unknown) => {
                    setGuests((gs) => gs.filter((g) => g.id !== placeholder.id));
                    notify("Close", `${rows[i].name} gagal ditambahkan`, e instanceof Error ? e.message : "Coba lagi.");
                  });
              });
            }
            return added.map((g) => g.id);
          }}
          onSendInvites={live ? (ids) => adminApi.sendInvites(ids) : undefined}
          onTemplate={(t) => {
            // Saved with the settings row. The default is stored as "", so a
            // later change to the server's built-in text still reaches it.
            saveSettings({ ...settings, inviteTemplate: t === DEFAULT_TEMPLATE ? "" : t }, "Pesan undangan disimpan", "Dipakai untuk undangan berikutnya.");
          }}
          onDone={(sent, failed) => {
            if (failed.length)
              pushNotice({
                kind: "action",
                icon: "Close",
                tone: "red",
                title: failed.length === 1 ? `Undangan ke ${failed[0].name} gagal` : `${failed.length} undangan gagal terkirim`,
                body: `${failed[0].inviteError ?? "Coba lagi"}. Cek nomornya lalu kirim ulang.`,
                page: "undangan",
              });
            else if (sent) notify("Send", `${sent} undangan terkirim`, "Status berubah jadi Dibaca begitu tamu membuka pesannya.");
          }}
          onToast={(title, sub) => notify("Send", title, sub)}
        />
      )}
      {page === "pengisi" && (
        <Pengisi
          people={people}
          events={events}
          live={live}
          access={access}
          scripts={scripts}
          initialEdit={sc.editScript}
          onSaveScript={(sid, parts) => {
            const next = { ...scripts };
            if (parts) next[sid] = parts;
            else delete next[sid];
            setScripts(next);
            // Goes to the shared stage document, which is what the MC's
            // screen reads. A failure has to be said out loud: the committee
            // would otherwise walk away believing the MC has the new script.
            // Only this session's entry is written onto the latest document,
            // so a script someone else saved meanwhile is not rolled back.
            const apply = (s: StageState) => {
              const merged = { ...(s.scripts ?? {}) };
              if (parts) merged[sid] = parts;
              else delete merged[sid];
              return { ...s, scripts: merged };
            };
            void (live ? patchStageAsAdmin(apply) : patchStage(apply)).catch((e: unknown) => {
              setScripts(scripts);
              notify("Close", "Naskah gagal disimpan", e instanceof Error ? e.message : "Coba lagi.");
            });
            notify("Pencil", parts ? "Naskah disimpan" : "Kembali ke saran Claude", "Langsung tampil di layar MC.");
          }}
          onSend={(id) => {
            notify("Send", live ? "WhatsApp dibuka" : "Link terkirim lewat WhatsApp", live ? "Tekan kirim di WhatsApp, lalu kirim kode panggungnya terpisah." : "Statusnya jadi Sudah masuk begitu kodenya dipakai.");
            if (live) personAction(id, "terkirim", () => adminApi.invitePerson(id));
            else setDemoAccess((a) => ({ ...a, [id]: "terkirim" }));
          }}
          onInvited={live ? (id) => personAction(id, "terkirim", () => adminApi.invitePerson(id)) : undefined}
          onRevoke={(id) => {
            notify("Lock", "Akses dicabut", "Link lama sudah tidak berlaku.");
            if (live) personAction(id, "dicabut", () => adminApi.revokePerson(id));
            else setDemoAccess((a) => ({ ...a, [id]: "dicabut" }));
          }}
          onRestore={
            live
              ? (id) => {
                  notify("Lock", "Akses dipulihkan", "Linknya bisa dipakai lagi.");
                  personAction(id, "terkirim", () => adminApi.restorePerson(id));
                }
              : undefined
          }
          onCopied={(what) => notify("Copy", `${what} disalin`, "Kirim sendiri lewat WhatsApp atau chat lain.")}
          onSavePerson={live ? savePerson : undefined}
          onDeletePerson={live ? deletePerson : undefined}
        />
      )}
      {page === "tamu" && (
        <Guests
          guests={guests}
          search={search}
          selectedId={selected}
          now={now}
          onSelect={setSelected}
          onCheckIn={(id) => {
            // Not "hadir": that means the guest finished their character,
            // which the committee cannot do for them.
            guestAction(id, { checkIn: now, checkInBy: "panitia" }, () => adminApi.checkIn(id));
            notify("Check", `${name(id)} sudah check-in`, `Tercatat jam ${formatTime(now)} lewat panitia.`);
          }}
          onUndoCheckIn={(id) => {
            guestAction(id, { checkIn: null, checkInBy: undefined, hadir: false }, () => adminApi.undoCheckIn(id));
            notify("Close", "Check-in dibatalkan", `${name(id)} kembali ke status belum datang.`);
          }}
          onClaimReward={(id) => {
            guestAction(id, { reward: "diambil", claimedAt: now }, () => adminApi.claimReward(id));
            notify("Gift", "Hadiah ditandai diambil", `Voucher ${name(id)} sudah tidak berlaku.`);
          }}
          onInvite={(id) => {
            setInviteFor(id);
            setPage("undangan");
          }}
          onExported={() => notify("Download", "CSV diunduh", "tamu-hmd.csv")}
        />
      )}
      {page === "rundown" && (
        <Rundown
          events={events}
          now={now}
          phase={phase}
          initialDraft={sc.rundownDraft?.(events)}
          initialEditId={sc.rundownEdit}
          people={people}
          onSave={(next, send) => {
            const before = events;
            setEvents(next);
            notify("Calendar", "Rundown disimpan", send ? `Notifikasi “Rundown berubah” dikirim ke ${present} tamu.` : "Tanpa notifikasi ke tamu.");
            if (!live) return;
            void adminApi
              .saveRundown(next)
              // The MC's "rundown berubah" banner: they are holding a printed
              // idea of the order, and the screen is the only way to tell them.
              .then(() => patchStageAsAdmin((s) => ({ ...s, rundownChanged: true })).catch(() => undefined))
              .catch((e: unknown) => {
                setEvents(before);
                notify("Close", "Rundown gagal disimpan", e instanceof Error ? e.message : "Coba lagi.");
              });
          }}
        />
      )}
      {page === "pengumuman" && (
        <Announcements
          history={announcements}
          recipients={present}
          now={now}
          failSend={!!sc.failAnnouncement}
          onSend={(a) => {
            const draft: Announcement = { ...a, id: `a${Date.now()}`, at: now, recipients: present, read: 0, source: "panitia" };
            setAnnouncements((list) => [...list, draft]);
            notify("Megaphone", "Pengumuman terkirim", `Muncul di HP ${present} tamu.`);
            if (!live) return;
            drafts.current.add(draft.id);
            // The server mints the real id and timestamp; swapping the draft
            // for it keeps "kirim ulang" pointing at a row that exists.
            void adminApi
              .sendAnnouncement(a)
              .then((saved) => {
                // Deleted while it was on its way: it has to go on the server too.
                if (!drafts.current.delete(draft.id)) {
                  removed.current.add(saved.id);
                  void adminApi.deleteAnnouncement(saved.id).catch(() => undefined);
                  return;
                }
                // A refresh may have brought the saved row in already.
                setAnnouncements((list) => [...list.filter((x) => x.id !== draft.id && x.id !== saved.id), saved]);
              })
              .catch((e: unknown) => {
                setAnnouncements((list) => list.map((x) => (x.id === draft.id ? { ...x, failed: true } : x)));
                notify("Close", "Pengumuman gagal terkirim", e instanceof Error ? e.message : "Coba lagi.");
              });
          }}
          resendAny={live}
          onResend={(id) => {
            if (!live) {
              setAnnouncements((list) => list.map((a) => (a.id === id ? { ...a, failed: false, at: now, recipients: present, read: 0 } : a)));
              return notify("Megaphone", "Pengumuman terkirim ulang", `Muncul di HP ${present} tamu.`);
            }
            const row = announcements.find((a) => a.id === id);
            // A draft that failed never reached the server, so there is nothing
            // to resend there: it goes out again as new.
            const call =
              drafts.current.has(id) && row
                ? adminApi.sendAnnouncement({ title: row.title, body: row.body, roomId: row.roomId })
                : adminApi.resendAnnouncement(id);
            void call
              .then((saved) => {
                drafts.current.delete(id);
                setAnnouncements((list) => [...list.filter((x) => x.id !== id && x.id !== saved.id), saved]);
                notify("Megaphone", "Pengumuman terkirim ulang", `Muncul di HP ${saved.recipients} tamu.`);
              })
              .catch((e: unknown) => notify("Close", "Gagal mengirim ulang", e instanceof Error ? e.message : "Coba lagi."));
          }}
          onDelete={(id) => {
            const row = announcements.find((a) => a.id === id);
            setAnnouncements((list) => list.filter((a) => a.id !== id));
            notify("Trash", "Pengumuman dihapus", "Hilang juga dari Notifikasi di HP tamu.");
            // A draft the server never confirmed has nothing to delete there.
            if (!live || !row || drafts.current.delete(id)) return;
            removed.current.add(id);
            void adminApi.deleteAnnouncement(id).catch((e: unknown) => {
              // Already gone (another admin, or a retry) is what was asked for.
              if (e instanceof ApiError && e.status === 404) return;
              removed.current.delete(id);
              setAnnouncements((list) => (list.some((a) => a.id === id) ? list : [...list, row].sort((a, b) => a.at - b.at)));
              notify("Close", "Pengumuman gagal dihapus", e instanceof Error ? e.message : "Coba lagi.");
            });
          }}
        />
      )}
      {page === "galeri" && (
        <AdminGallery
          gallery={gallery}
          selectedId={galleryPhoto}
          onSelect={setGalleryPhoto}
          onCensor={(p, censored, reason) => {
            const before = gallery.photos;
            setGallery((g) => ({
              ...g,
              photos: g.photos.map((x) => (x.id === p.id ? { ...x, censored, censorReason: censored ? reason : undefined } : x)),
            }));
            notify(
              censored ? "Lock" : "Eye",
              censored ? "Foto disensor" : "Sensor dibuka",
              censored ? `Foto ${firstName(p.author)} tidak lagi bisa dibuka tamu lain.` : `Foto ${firstName(p.author)} tampil normal lagi.`,
            );
            if (!live) return;
            void adminApi.censorPhotos([p.id], censored, reason).catch((e: unknown) => {
              setGallery((g) => ({ ...g, photos: before }));
              notify("Close", "Gagal menyimpan", e instanceof Error ? e.message : "Coba lagi.");
            });
          }}
          onCheckAll={(ids) => {
            setGallery((g) => ({ ...g, checked: [...new Set([...g.checked, ...ids])] }));
            notify("Check", "Semua foto sudah dicek", `${ids.length} foto ditandai sudah dicek.`);
            if (live) void adminApi.markPhotosChecked(ids).catch(() => undefined);
          }}
          onDownload={(p) => {
            const a = document.createElement("a");
            a.href = p.src;
            a.download = `hmd-foto-${firstName(p.author).toLowerCase()}-${p.id}.jpg`;
            a.click();
          }}
        />
      )}
      {page === "hadiah" && (
        <Rewards
          guests={guests}
          pin={settings.panitiaPin}
          changedAt={settings.codesChangedAt}
          onClaim={(id) => {
            guestAction(id, { reward: "diambil", claimedAt: now }, () => adminApi.claimReward(id));
            notify("Gift", "Hadiah ditandai diambil", `Voucher ${name(id)} sudah tidak berlaku.`);
          }}
          onChangePin={(pin) => {
            // The PIN is one field of the settings row, so changing it here
            // saves the whole row -- the same write the Pengaturan page does.
            saveSettings({ ...settings, panitiaPin: pin, codesChangedAt: now }, "PIN panitia diganti", "Berlaku di HP tamu sekarang juga.");
          }}
        />
      )}
      {page === "feedback" && (
        <Feedback
          events={events}
          now={now}
          phase={phase}
          perEvent={live ? feedback.events : phase === "pre" ? {} : sc.feedbackAll ? SAMPLE_EVENT_FEEDBACK_ALL : SAMPLE_EVENT_FEEDBACK}
          final={live ? foldFinal(feedback.final) : phase === "ended" ? SAMPLE_FINAL_FEEDBACK : null}
          present={present}
          initialTab={sc.feedbackTab}
          onExported={() => notify("Download", "CSV diunduh", "feedback-hmd.csv")}
        />
      )}
      {page === "pengaturan" && (
        <Settings
          settings={settings}
          today={live ? new Date() : TODAY}
          onSave={(s) => saveSettings(s, "Pengaturan disimpan", "Berlaku di HP tamu dalam beberapa detik.")}
          onCopied={(what) => notify("Copy", `${what} disalin`, "Tempel di grup panitia.")}
          doorQr={live}
          onResetStage={
            live
              ? () =>
                  resetStageAsAdmin()
                    .then((s) => {
                      setStage(s);
                      notify("Check", "Panggung direset", "Layar MC dan pembicara kembali ke awal acara.");
                    })
                    .catch((e: unknown) => notify("Close", "Panggung gagal direset", e instanceof Error ? e.message : "Coba lagi."))
              : undefined
          }
        />
      )}

      {toast && (
        <div className="admin-toast">
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
                    goTo(toast.action!.page);
                    setToast(null);
                  }}
                >
                  {toast.action.label}
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      {sessionExpired && (
        <Dialog
          icon="Lock"
          iconTone="ink"
          title="Sesi kamu sudah habis"
          description={`Demi keamanan, sesi admin berakhir setelah 12 jam. ${live ? "Masuk lagi dengan PIN admin." : "Masuk lagi dengan PIN baru dari email."}`}
          onClose={() => undefined}
          actions={
            <Button
              icon="Mail"
              onClick={() => {
                setSessionExpired(false);
                setSignedIn(false);
              }}
            >
              Masuk lagi
            </Button>
          }
        />
      )}
    </AdminShell>
  );
}

/**
 * Settings cross the wire with the date as a calendar day.
 *
 * The picker needs a Date and the event has a day, not an instant. Building
 * the Date from the parts rather than `new Date("2026-11-08")` keeps it local
 * midnight: the string form is parsed as UTC, which in Jakarta renders as the
 * 8th but in any zone west of London as the 7th.
 */
function fromWireSettings(s: WireSettings): AdminSettings {
  const [y, m, d] = (s.date ?? "").split("-").map(Number);
  // A row saved without a date would otherwise become Invalid Date, and every
  // day count on the dashboard NaN. The bundled day is the better guess.
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(dayOf(EVENT.startsAt));
  return {
    eventName: s.eventName,
    date,
    place: s.place?.name ? { name: s.place.name, address: s.place.address } : null,
    doorCode: s.doorCode,
    panitiaPin: s.panitiaPin,
    countdown: s.countdown,
    finalFeedbackAt: s.finalFeedbackAt,
    codesChangedAt: s.codesChangedAt,
    inviteTemplate: s.inviteTemplate ?? "",
    contact: { name: s.contact?.name ?? "", phone: s.contact?.phone ?? "" },
  };
}

function toWireSettings(s: AdminSettings): WireSettings {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    eventName: s.eventName,
    // Local parts, for the same reason: toISOString would shift the day.
    date: `${s.date.getFullYear()}-${p(s.date.getMonth() + 1)}-${p(s.date.getDate())}`,
    place: { name: s.place?.name ?? "", address: s.place?.address ?? "" },
    doorCode: s.doorCode,
    panitiaPin: s.panitiaPin,
    countdown: s.countdown,
    finalFeedbackAt: s.finalFeedbackAt,
    codesChangedAt: s.codesChangedAt,
    // PUT replaces the whole row: leaving these out would wipe them.
    inviteTemplate: s.inviteTemplate,
    contact: s.contact,
  };
}

/**
 * The server's announcements, plus the drafts it has not confirmed yet.
 *
 * Sorted by `at` so "the last one" -- the dashboard's card -- is the one that
 * most recently went out, resends included.
 */
function mergeAnnouncements(server: Announcement[], local: Announcement[], drafts: Set<string>, removed: Set<string>): Announcement[] {
  const pending = local.filter((a) => drafts.has(a.id));
  return [...server.filter((a) => !removed.has(a.id)), ...pending].sort((a, b) => a.at - b.at);
}

/**
 * Folds the closing answers into what the Feedback page draws.
 *
 * The API sends one row per guest because a row can be exported and an
 * aggregate cannot; the page wants a star histogram, mood counts and the
 * messages. Returns null for "nobody has answered yet", which the page
 * renders as its empty state -- an aggregate of nothing would draw a chart
 * of five zeroes and look like an answer.
 */
function foldFinal(rows: AdminFeedback["final"]) {
  if (!rows.length) return null;
  const ratings = [0, 0, 0, 0, 0];
  const moods: Record<string, number> = {};
  const messages: string[] = [];
  for (const r of rows) {
    if (r.rating >= 1 && r.rating <= 5) ratings[r.rating - 1]++;
    for (const m of r.moods ?? []) moods[m] = (moods[m] ?? 0) + 1;
    if (r.note?.trim()) messages.push(r.note.trim());
  }
  return { ratings, moods, messages };
}
