import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useMatch, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BottomNav, type NavTab } from "../components/BottomNav";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import type { RewardState } from "../components/RoomHeader";
import { SystemState } from "../components/SystemState";
import { Toast, ToastIcon } from "../components/Toast";
import { KENALAN_TARGET } from "../config";
import { currentItem, eventEndedAt, formatTime, hasQna, useAgenda, type AgendaItem } from "../data/agenda";
import {
  announcementKey as seenKey,
  announcementSub,
  api,
  queryKeys,
  type GuestAnnouncement,
  type KenalanInvite,
  type KenalanInvites,
} from "../data/adapters";
import { GALLERY_MAX, PHOTO_MAX_MB, SAMPLE_PHOTOS, firstName, type GalleryPhoto, type PickedPhoto } from "../data/gallery";
import { GUESTS, type Guest } from "../data/guests";
import { ApiError } from "../data/http";
import { addNotices, photosNotice, type GuestNotice } from "../data/notifications";
import { photosApi, shrink } from "../data/photos";
import {
  useAnnouncementsQuery,
  useCollectCard,
  useDeleteQuestion,
  useEditQuestion,
  useEventFeedback,
  useFinalFeedback,
  useGuests,
  useKenalanInvitesQuery,
  useSendQuestion,
} from "../data/queries";
import { queryClient } from "../data/queryClient";
import { ROOMS, roomIndexById } from "../data/rooms";
import { FLOW, INVITE_PATH, SCREENS, TABS, tabPath, type AppScreen } from "../routing/paths";
import { AgendaScreen } from "../screens/AgendaScreen";
import { AskScreen } from "../screens/AskScreen";
import { CheckIn } from "../screens/CheckIn";
import { CountdownScreen } from "../screens/CountdownScreen";
import { Customize } from "../screens/Customize";
import { DoorOpen } from "../screens/DoorOpen";
import { EventFeedback } from "../screens/EventFeedback";
import { FeedbackScreen } from "../screens/FeedbackScreen";
import { GalleryScreen, type GalleryFilter } from "../screens/GalleryScreen";
import { KenalanScreen } from "../screens/KenalanScreen";
import { PhotoViewer } from "../screens/PhotoViewer";
import { readPicked, usePhotoPicker } from "../screens/PhotoPicker";
import { UploadScreen } from "../screens/UploadScreen";
import { MainArea } from "../screens/MainArea";
import { MyQr } from "../screens/MyQr";
import { Narasi } from "../screens/Narasi";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { QuestionCard } from "../screens/QuestionCard";
import { Rsvp } from "../screens/Rsvp";
import { Start } from "../screens/Start";
import { Thanks } from "../screens/Thanks";
import { Voucher } from "../screens/Voucher";
import { CharacterStage } from "../character/CharacterStage";
import { GuestProvider } from "./GuestProvider";
import { useGuest } from "./guestContext";
import { ANNOUNCEMENT_GRACE_MIN, useLogNotices, useNoticeSync } from "./useNotices";

/** Provider + the system-state gate that used to sit at the top of App.tsx. */
export function GuestShell() {
  return (
    <GuestProvider>
      <StageHost>
        <SystemGate />
      </StageHost>
    </GuestProvider>
  );
}

/**
 * One Spline instance for every guest screen, inside the provider so it can
 * read the outfit. Admin sits outside this and never loads Spline.
 */
function StageHost({ children }: { children: React.ReactNode }) {
  const { state } = useGuest();
  return <CharacterStage outfit={state.outfit}>{children}</CharacterStage>;
}

function SystemGate() {
  const { state, set, demo, session } = useGuest();
  const onInviteLink = useMatch(INVITE_PATH);
  if (state.system) {
    return <SystemState type={state.system} onRetry={() => set({ system: state.system === "loading" ? null : "loading" })} />;
  }
  /**
   * No invite link opened on this phone, and not a review case. There is no
   * guest to be -- everything past this point is somebody's own RSVP, cards
   * and questions -- so say where to start instead of showing a sample guest
   * whose answers go nowhere.
   */
  if (!demo && !session && !onInviteLink) {
    return (
      <SystemState
        type="error"
        title="Buka link undangan pribadimu"
        sub="Halaman ini hanya bisa dibuka lewat link undangan yang dikirim panitia ke WhatsApp-mu."
      />
    );
  }
  return <Outlet />;
}

/**
 * Records the answer, then moves on.
 *
 * The navigation does not wait for the server. An RSVP is one byte of state
 * the committee reads later, not something the next screen depends on, and
 * making a guest watch a spinner for it on event wifi would be a worse trade
 * than the rare retry. The write is idempotent server-side, so a guest who
 * taps twice still has one answer.
 */
function useRsvp() {
  const navigate = useNavigate();
  const { state } = useGuest();
  return useCallback(
    (rsvp: "ya" | "tidak") => {
      void api.setRsvp(rsvp).catch(() => {
        // Nothing to show: the guest has moved on, and the committee's list is
        // not what this screen is for.
      });
      navigate(rsvp === "ya" ? (state.countdownEnabled ? FLOW.countdown : FLOW.start) : FLOW.thanks);
    },
    [navigate, state.countdownEnabled],
  );
}

export function RsvpRoute() {
  const rsvp = useRsvp();
  return <Rsvp onYes={() => rsvp("ya")} onNo={() => rsvp("tidak")} />;
}

export function ThanksRoute() {
  const rsvp = useRsvp();
  return <Thanks onChangeToYes={() => rsvp("ya")} />;
}

export function CountdownRoute() {
  const { state } = useGuest();
  const navigate = useNavigate();

  /**
   * The committee can switch this screen off, and the switch has to hold for
   * anyone who arrives here by any route -- a bookmark, the back button, a
   * link someone pasted in a group chat. Without the guard, turning the
   * countdown off only changed where "Ya" went, and a guest could still land
   * on a waiting screen for an event that had already opened.
   *
   * `replace` so the back button does not bounce them straight back into it.
   */
  if (!state.countdownEnabled) return <Navigate to={FLOW.start} replace />;

  return <CountdownScreen onCancel={() => navigate(FLOW.thanks)} onDday={() => navigate(FLOW.start)} />;
}

export function StartRoute() {
  const navigate = useNavigate();
  return <Start onStart={() => navigate(FLOW.checkin)} />;
}

export function CheckInRoute() {
  const { state, demo } = useGuest();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <CheckIn
      name={state.name}
      scenario={state.checkIn}
      camera={!demo}
      doorFromLink={demo ? undefined : (params.get("door") ?? undefined)}
      onBack={() => navigate(FLOW.start)}
      onCheckedIn={async (by, code) => {
        // Unlike the RSVP, this one is awaited: the door code is the server's
        // to accept or refuse, and everything after this screen assumes the
        // guest is actually checked in.
        await api.checkIn(by, code);
        navigate(FLOW.door);
      }}
    />
  );
}

export function DoorRoute() {
  const navigate = useNavigate();
  return <DoorOpen onDone={() => navigate(FLOW.narasi)} />;
}

export function NarasiRoute() {
  const navigate = useNavigate();
  return <Narasi onDone={() => navigate(FLOW.customize)} />;
}

export function CustomizeRoute() {
  const { state, set, demo } = useGuest();
  const navigate = useNavigate();
  return (
    <Customize
      name={state.name}
      initialOutfit={state.outfit}
      onConfirm={(outfit) => {
        // The character belongs to the guest, not to this browser, so it goes
        // to the server before anything else. Not awaited: the write is
        // idempotent and queued when offline, and making somebody watch a
        // spinner after they already pressed "selesai" is the one moment in
        // this flow where a delay is most felt.
        void api.finishCharacter(outfit).catch(() => {
          /* queued or lost; GuestProvider re-reads it from the server on the next load */
        });
        // "intro" plays the sample arrival toasts ("Nanda baru saja hadir"),
        // which are review copy; a real guest only gets the move notice.
        set({ outfit, roomIndex: 0, mainScenario: demo ? "intro" : "masuk", hadirAt: state.now });
        navigate(tabPath("ruangan"));
      }}
    />
  );
}

// ---------- In the app (after check-in + customisation = hadir) ----------

export function AppRoute() {
  const { tab } = useParams<{ tab: string }>();
  const { state, set, update, toast, showToast, demo, session } = useGuest();
  const liveSession = !demo && Boolean(session);
  // Galeri and Notifikasi open full screen over Ruangan; every other path is a tab.
  const screen = (SCREENS as readonly string[]).includes(tab ?? "") ? (tab as AppScreen) : null;
  const navigate = useNavigate();
  // Review cases use the sample guests; a real guest sees who is actually
  // here, minus themselves -- their own card is not one to collect.
  const liveGuests = useGuests(!demo);
  const guestList = demo ? GUESTS : liveGuests.filter((g) => g.id !== state.guestId);
  // Subscribing re-renders this route (and MainArea under it) when the
  // committee edits the rundown.
  const agenda = useAgenda();
  const announcements = useAnnouncementsQuery(!demo);
  const kenalanInvites = useKenalanInvitesQuery(liveSession);
  const logNotices = useLogNotices();

  const sendQuestion = useSendQuestion();
  const editQuestion = useEditQuestion();
  const deleteQuestion = useDeleteQuestion();
  const eventFeedback = useEventFeedback();
  const finalFeedback = useFinalFeedback();
  const collectCard = useCollectCard();

  const ended = eventEndedAt(state.now);
  const count = Object.keys(state.collected).length;
  const reward: RewardState = count < KENALAN_TARGET ? "collecting" : state.rewardClaimed ? "claimed" : "ready";
  const guests = state.guestsPresent ? guestList : [];

  const onTab = useCallback(
    (next: NavTab) => {
      set({ overlay: null });
      navigate(tabPath(next));
    },
    [navigate, set],
  );

  const openGallery = useCallback(() => {
    set({ overlay: null, newPhotos: false });
    navigate(tabPath("galeri"));
  }, [navigate, set]);

  // A Kenalan card opens on the Kenalan tab, where it is at home (from "Lihat kartu" or Notifikasi).
  const openGuest = useCallback(
    (id: string) => {
      set({ overlay: { type: "guest", id } });
      navigate(tabPath("kenalan"));
    },
    [navigate, set],
  );

  const goToRoom = useCallback(
    (roomIndex: number) => {
      set({ roomIndex, visited: [...new Set([...state.visited, roomIndex])], overlay: null });
      navigate(tabPath("ruangan"));
    },
    [navigate, set, state.visited],
  );

  const onRoomChange = useCallback(
    (roomIndex: number) => set({ roomIndex, visited: [...new Set([...state.visited, roomIndex])] }),
    [set, state.visited],
  );

  const closeOverlay = useCallback(() => set({ overlay: null }), [set]);
  const onScenarioPlayed = useCallback(() => set({ mainScenario: "none" }), [set]);
  const openReward = useCallback(() => {
    set({ overlay: { type: "voucher" } });
    navigate(tabPath("kenalan"));
  }, [navigate, set]);

  const live = ended ? undefined : currentItem(state.now);
  const openAsk = useCallback(() => {
    if (live) set({ overlay: { type: "ask", eventId: live.id } });
  }, [live, set]);
  // "Tanya pembicara" only for a session the committee opened for questions.
  const canAsk = Boolean(live && hasQna(live));

  /**
   * The shared gallery.
   *
   * Above the early returns below: hooks after a conditional return made
   * React throw "rendered more hooks" when moving from Ruangan to another tab.
   *
   * The list (not the images) is re-read every 20 s while Galeri is open, so
   * new photos and the committee's censoring show up, and every minute
   * otherwise, which is what lights the dot on the Galeri button and logs
   * "X membagikan foto" in Notifikasi. The images themselves are cached by the
   * browser for a day -- a photo's bytes never change, since an edit is a new
   * photo, and nothing but the open gallery loads them.
   */
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("semua");
  const loadedGallery = useRef(false);
  const galleryOpen = screen === "galeri";

  // However Galeri was reached (the pill, a notice, a bookmarked /app/galeri), its dot is seen.
  useEffect(() => {
    if (galleryOpen && state.newPhotos) set({ newPhotos: false });
  }, [galleryOpen, state.newPhotos, set]);

  useEffect(() => {
    if (demo) {
      setPhotos(SAMPLE_PHOTOS);
      return;
    }
    if (!liveSession) return;
    let alive = true;
    const load = () => {
      const first = !loadedGallery.current;
      if (first && galleryOpen) setPhotosLoading(true);
      void photosApi
        .list()
        .then((list) => {
          if (!alive) return;
          loadedGallery.current = true;
          setPhotos(list);
          noticeNewPhotos(list, galleryOpen);
        })
        // A failed poll keeps the list on screen; the next one tries again. The
        // screen has its own offline state, so an empty first load reads right.
        .catch(() => undefined)
        .finally(() => first && setPhotosLoading(false));
    };
    load();
    const timer = window.setInterval(load, galleryOpen ? 20_000 : 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryOpen, demo, liveSession]);

  /**
   * Other guests' photos this phone has not seen in a poll before. The very
   * first poll only records what is there: a full gallery on arrival is not news.
   */
  const noticeNewPhotos = (list: GalleryPhoto[], open: boolean) =>
    update((s) => {
      const ids = list.map((p) => p.id);
      if (!s.knownPhotos) return { knownPhotos: ids };
      const known = new Set(s.knownPhotos);
      const added = list.filter((p) => !p.mine && !known.has(p.id)).sort((a, b) => b.at - a.at);
      const same = ids.length === s.knownPhotos.length && ids.every((id) => known.has(id));
      if (!added.length) return same ? null : { knownPhotos: ids };
      const notice = photosNotice(added, s.now);
      return {
        knownPhotos: ids,
        // Looking at Galeri already: no dot, and the notice is logged read.
        newPhotos: open ? s.newPhotos : true,
        notices: notice ? addNotices(s.notices, [notice], open) : s.notices,
      };
    });

  /**
   * Photos come from the phone's library only -- no `capture`, so the app
   * never asks for the camera itself.
   */
  const photoPicker = usePhotoPicker((files) => {
    const r = readPicked(files, GALLERY_MAX - photos.filter((p) => p.mine).length);
    if (r.picks.length) return set({ overlay: { type: "upload", initial: r } });
    showToast({
      icon: "Check",
      title: "Tidak ada foto yang bisa diunggah",
      sub: r.tooBig ? `Ukuran foto maksimal ${PHOTO_MAX_MB} MB.` : "Pilih file gambar dari galeri HP-mu.",
    });
  });

  /**
   * The committee moved a session: say so the way an announcement is said
   * (MainArea's slot on Ruangan, the page toast elsewhere), and tag the card
   * "Diubah" on Agenda. Compared poll to poll, never on the first load -- an
   * empty rundown filling in is not a change.
   */
  const [rundownNotices, setRundownNotices] = useState<GuestAnnouncement[]>([]);
  const prevAgenda = useRef(agenda);
  useEffect(() => {
    const prev = prevAgenda.current;
    prevAgenda.current = agenda;
    if (demo || prev.length === 0 || prev === agenda) return;
    for (const item of agenda) {
      const old = prev.find((a) => a.id === item.id);
      const note = old && describeChange(old, item);
      if (!note) continue;
      set({ changedId: item.id });
      setRundownNotices((list) => [...list, { id: `rundown-${item.id}`, title: "Rundown berubah", body: note, roomId: null, at: state.now }]);
      logNotices([
        {
          // One per resulting slot, so moving it twice is two notices and a re-poll is none.
          id: `rundown-${item.id}-${item.start}-${item.end}-${item.roomId}`,
          kind: "jadwal",
          title: "Rundown berubah",
          body: note,
          at: state.now,
          target: { to: "agenda" },
        },
      ]);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenda]);

  /**
   * The newest committee announcement this guest has not seen, sent since
   * they arrived or in the half hour before (anything older was for the
   * people already in the room; a guest walking in just after "foto bersama
   * 5 menit lagi" still needs it).
   * On Ruangan it shows in MainArea's notification slot; on the other tabs
   * as the page toast.
   */
  // Seen is keyed by id *and* time: the committee's "kirim ulang" keeps the id
  // and moves `at` to now, and that has to show again.
  const unseen = [...(announcements ?? []), ...rundownNotices].filter((a) => a.at >= state.hadirAt - ANNOUNCEMENT_GRACE_MIN && !state.seenAnnouncements.includes(seenKey(a)));
  const announcement = unseen[unseen.length - 1];
  // Marks everything waiting as seen, not just the one shown: a guest back
  // from a dead zone gets the latest announcement, not a queue of old ones.
  const unseenIds = unseen.map(seenKey).join(",");
  const markAnnouncementSeen = useCallback(
    () => set({ seenAnnouncements: [...state.seenAnnouncements, ...unseenIds.split(",").filter(Boolean)] }),
    [set, state.seenAnnouncements, unseenIds],
  );
  // On the bare room it's the room's own toast (with "Ke sana" / "Lihat kartu");
  // anywhere else -- a tab, Galeri, Notifikasi, an open card -- the page toast.
  const bareRoom = tab === "ruangan" && !state.overlay;
  useEffect(() => {
    if (!announcement || bareRoom) return;
    showToast({ icon: "Megaphone", title: announcement.title, sub: announcementSub(announcement) });
    markAnnouncementSeen();
  }, [announcement, bareRoom, showToast, markAnnouncementSeen]);

  /**
   * Another guest's "Ajak kenalan": logged in Notifikasi by useNoticeSync,
   * which hands over a recent one to pop up as well.
   */
  const [incomingInvite, setIncomingInvite] = useState<KenalanInvite | undefined>();
  useNoticeSync({
    live: liveSession,
    announcements,
    invites: kenalanInvites,
    onInvite: (inv) => {
      if (bareRoom) return setIncomingInvite(inv);
      const name = firstName(inv.fromName);
      showToast({ icon: "UserPlus", title: `${name} ngajak kenalan!`, sub: `Cari ${name}, lalu kalian bisa saling tanya.` });
    },
  });

  /** "Ajak kenalan" on a card. Review cases only pretend; live, the server holds the 10-minute cooldown. */
  const [inviting, setInviting] = useState(false);
  const inviteGuest = async (g: Guest) => {
    const sent = { icon: "UserPlus" as const, title: `Ajakan terkirim ke ${g.name}`, sub: `Cari ${g.name}, lalu tanyakan pertanyaan di kartunya.` };
    if (demo) {
      set({ invited: { ...state.invited, [g.id]: Date.now() } });
      return showToast(sent);
    }
    setInviting(true);
    try {
      const inv = await api.inviteKenalan(g.id);
      queryClient.setQueryData<KenalanInvites>(queryKeys.kenalanInvites, (d) => ({
        received: d?.received ?? [],
        sent: [inv, ...(d?.sent ?? []).filter((x) => x.toId !== inv.toId)],
      }));
      showToast(sent);
    } catch (e) {
      // The server's own words for a refusal (asked < 10 minutes ago, already
      // left); a network failure gets the usual line.
      const answered = e instanceof ApiError && e.status !== 0;
      showToast({ icon: answered ? "Clock" : "WifiOff", title: "Ajakan belum terkirim", sub: answered ? e.message : "Cek koneksimu lalu coba lagi." });
      // A 409 means this phone missed an invite it sent: fetch it for the cooldown.
      if (answered) void queryClient.invalidateQueries({ queryKey: queryKeys.kenalanInvites });
    } finally {
      setInviting(false);
    }
  };
  const invitedAt = (guestId: string) =>
    demo ? state.invited[guestId] : kenalanInvites?.sent.find((x) => x.toId === guestId)?.sentAt;

  if (!tab || !(TABS.includes(tab as NavTab) || screen)) return <Navigate to={tabPath("ruangan")} replace />;
  const activeTab: NavTab = screen ? "ruangan" : (tab as NavTab);

  const overlay = state.overlay;
  const askEvent = overlay?.type === "ask" ? agenda.find((a) => a.id === overlay.eventId) : undefined;
  const askScreen = askEvent && (
    <AskScreen
      event={askEvent}
      roomName={ROOMS[roomIndexById(askEvent.roomId)].name}
      questions={state.questions.filter((q) => q.eventId === askEvent.id)}
      // Q&A switched off while the form was open reads as closed, not broken.
      closed={state.askClosed || !hasQna(askEvent)}
      offline={state.askOffline}
      onBack={closeOverlay}
      onEdit={(id, text) => {
        if (state.askRace) {
          set({ questions: state.questions.map((q) => (q.id === id ? { ...q, status: "dibaca" } : q)) });
          return false;
        }
        set({ questions: state.questions.map((q) => (q.id === id ? { ...q, text, edited: true } : q)) });
        // A "local-" question has no server id yet; there is nothing to edit there.
        if (!id.startsWith("local-")) editQuestion.mutate({ id, text });
        return true;
      }}
      onDelete={(id) => {
        set({ questions: state.questions.filter((q) => q.id !== id) });
        if (!id.startsWith("local-")) deleteQuestion.mutate(id);
      }}
      onSend={(text, anonymous) => {
        const author = anonymous ? null : state.name;
        set({
          questions: [
            ...state.questions,
            { id: `local-${Date.now()}`, eventId: askEvent.id, text, author, mine: true, status: "terkirim", at: state.now },
          ],
        });
        // Shown as sent straight away; delivery is queued if the network is down.
        // Once it lands, the refetch swaps the local copy for the server's.
        sendQuestion.mutate(
          { eventId: askEvent.id, text, author, at: state.now },
          { onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.questions }) },
        );
      }}
    />
  );

  // Per-event feedback is required: it takes over the screen until it's sent.
  const due = agenda.find((a) => a.end <= state.now && a.end > state.hadirAt && !(a.id in state.eventFeedback));
  if (due) {
    return (
      <EventFeedback
        key={due.id}
        event={due}
        roomName={ROOMS[roomIndexById(due.roomId)].name}
        offline={state.feedbackOffline}
        onSubmit={(rating) => {
          set({ eventFeedback: { ...state.eventFeedback, [due.id]: rating }, overlay: null, mainScenario: "setelah-feedback" });
          eventFeedback.mutate({ eventId: due.id, rating });
          navigate(tabPath("ruangan"));
        }}
      />
    );
  }

  /**
   * Shares the picked photos, shrinking each one first.
   *
   * Sequential rather than parallel: five uploads at once on event wifi
   * compete for the same thin uplink and all of them crawl. One at a time
   * means the first photo is in the gallery while the fifth is still going.
   */
  const sharePhotos = async (picks: PickedPhoto[]) => {
    const added: GalleryPhoto[] = [];
    for (const pick of picks) {
      const file = pick.file;
      if (!file) continue;
      const data = await shrink(file);
      added.push(await photosApi.share(data, pick.caption));
    }
    setPhotos((list) => [...added, ...list]);
    set({ overlay: null });
    if (!galleryOpen) navigate(tabPath("galeri"));
    showToast({ icon: "Check", title: `${added.length} foto dibagikan`, sub: "Tamu lain bisa melihatnya di Galeri." });
  };

  const deletePhoto = (photo: GalleryPhoto) => {
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
    set({ overlay: null });
    void photosApi.remove(photo.id).catch((e: unknown) => {
      // Put it back: a photo that is still on the server but gone from this
      // screen is the one state the guest cannot recover from.
      setPhotos((list) => [photo, ...list].sort((a, b) => b.at - a.at));
      showToast({ icon: "Check", title: "Foto gagal dihapus", sub: e instanceof Error ? e.message : "Coba lagi." });
    });
  };

  /**
   * Downloads through the same authenticated URL the tile uses, as a blob, so
   * the saved file has a sensible name instead of the endpoint's path.
   */
  const downloadPhoto = (photo: GalleryPhoto) => {
    void fetch(photo.src)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hmd-${photo.id}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => showToast({ icon: "Check", title: "Gagal mengunduh", sub: "Cek koneksimu lalu coba lagi." }));
  };

  const collect = (guestId: string, note: string) => {
    const collected = { ...state.collected, [guestId]: note };
    const g = guests.find((x) => x.id === guestId)!;
    const done = Object.keys(collected).length === KENALAN_TARGET;
    set({ collected, overlay: done ? { type: "reward" } : null });
    collectCard.mutate({ guestId, note });
    if (!done) showToast({ icon: "Check", title: `Kartu ${g.name} didapat!`, sub: `${g.name} juga dapat kartumu.` });
  };

  const guest = overlay?.type === "guest" ? guests.find((g) => g.id === overlay.id) : undefined;

  // Tapping a notification marks it read and goes where it points.
  const openNotice = (n: GuestNotice) => {
    const notices = state.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x));
    const t = n.target;
    if (!t) return set({ notices });
    const go = (path: Parameters<typeof tabPath>[0], patch: Partial<typeof state>) => {
      set({ notices, ...patch });
      navigate(tabPath(path));
    };
    if (t.to === "agenda") return go("agenda", { overlay: null });
    if (t.to === "galeri") return go("galeri", { overlay: null, newPhotos: false });
    if (t.to === "voucher") return go("kenalan", { overlay: { type: "voucher" } });
    // A guest who has since left has no card: the Kenalan tab is the closest thing.
    if (t.to === "kartu") return go("kenalan", { overlay: { type: "guest", id: t.guestId } });
    if (t.to === "tanya") return go("ruangan", { overlay: { type: "ask", eventId: t.eventId } });
    const roomIndex = roomIndexById(t.roomId);
    go("ruangan", { overlay: null, roomIndex, visited: [...new Set([...state.visited, roomIndex])] });
  };

  // Layers shared by Ruangan and the tab pages: full-screen pages, overlays and the page toast.
  const layers = (
    <>
      {screen === "galeri" && (
        <GalleryScreen
          photos={photos}
          filter={galleryFilter}
          loading={photosLoading}
          offline={state.offline}
          onBack={() => navigate(tabPath("ruangan"))}
          onFilter={setGalleryFilter}
          onUpload={photoPicker.open}
          onOpen={(p) => set({ overlay: { type: "photo", id: p.id } })}
        />
      )}
      {screen === "notifikasi" && (
        <NotificationsScreen
          notices={state.notices}
          onBack={() => navigate(tabPath("ruangan"))}
          onReadAll={() => set({ notices: state.notices.map((n) => (n.read ? n : { ...n, read: true })) })}
          onOpen={openNotice}
        />
      )}
      {guest && (
        <QuestionCard
          key={guest.id}
          guest={guest}
          savedNote={state.collected[guest.id]}
          onBack={closeOverlay}
          onCollected={(note) => collect(guest.id, note)}
          invitedAt={invitedAt(guest.id)}
          inviting={inviting}
          onInvite={() => void inviteGuest(guest)}
        />
      )}
      {overlay?.type === "voucher" && (
        <Voucher name={state.name} claimed={state.rewardClaimed} onBack={closeOverlay} onClaimed={() => set({ rewardClaimed: true })} />
      )}
      {askScreen}
      {photoPicker.input}
      {overlay?.type === "photo" && (
        <PhotoViewer
          photos={photos}
          startId={overlay.id}
          confirmDelete={overlay.confirmDelete}
          onClose={closeOverlay}
          onDownload={downloadPhoto}
          onDelete={deletePhoto}
        />
      )}
      {overlay?.type === "upload" && (
        <UploadScreen initial={overlay.initial} offline={state.offline} onBack={closeOverlay} onShared={sharePhotos} />
      )}
      {overlay?.type === "myqr" && <MyQr name={state.name} code={state.code} onClose={closeOverlay} />}
      {overlay?.type === "reward" && <RewardDialog onClose={closeOverlay} onExchange={() => set({ overlay: { type: "voucher" } })} />}

      {toast && (
        <div className="page__toast">
          <Toast
            lead={<ToastIcon icon={toast.icon} tone={ACCENT_TOASTS.includes(toast.icon) ? "accent" : "neutral"} />}
            title={toast.title}
            sub={toast.sub}
          />
        </div>
      )}
    </>
  );

  if (activeTab === "ruangan") {
    return (
      <div className="page--room">
        <MainArea
          kenalanCount={count}
          reward={reward}
          roomIndex={state.roomIndex}
          onRoomChange={onRoomChange}
          onTab={onTab}
          now={state.now}
          ended={ended}
          offline={state.offline}
          scenario={state.mainScenario}
          onScenarioPlayed={onScenarioPlayed}
          // Only on the bare room; anywhere else the page toast says it (see above).
          announcement={bareRoom ? announcement : undefined}
          onAnnouncementShown={markAnnouncementSeen}
          kenalanInvite={incomingInvite}
          onKenalanInviteShown={() => setIncomingInvite(undefined)}
          onOpenGuest={openGuest}
          newPhotos={state.newPhotos}
          onGallery={openGallery}
          unread={state.notices.filter((n) => !n.read).length}
          onNotifications={() => navigate(tabPath("notifikasi"))}
          onNotice={(n) => logNotices([n])}
          onOpenReward={openReward}
          onAsk={canAsk ? openAsk : undefined}
          feedbackSent={state.feedbackSent}
        />
        {layers}
      </div>
    );
  }

  return (
    <main className="page">
      {activeTab === "agenda" && (
        <AgendaScreen
          now={state.now}
          currentRoomIndex={state.roomIndex}
          changedId={state.changedId}
          ended={ended}
          onGoToRoom={goToRoom}
          onFeedback={() => onTab("feedback")}
          onAsk={(eventId) => set({ overlay: { type: "ask", eventId } })}
          feedbackSent={state.eventFeedback}
          finalFeedbackSent={state.feedbackSent}
        />
      )}
      {activeTab === "kenalan" && (
        <KenalanScreen
          guests={guests}
          collected={state.collected}
          reward={reward}
          onOpenGuest={(g) => set({ overlay: { type: "guest", id: g.id } })}
          onMyQr={() => set({ overlay: { type: "myqr" } })}
          onReward={() => set({ overlay: { type: "voucher" } })}
        />
      )}
      {activeTab === "feedback" && (
        <FeedbackScreen
          name={state.name}
          kenalanCount={count}
          roomsVisited={state.visited.length}
          submitted={state.feedbackSent}
          onSubmit={(rating, note, moods) => {
            set({ feedbackSent: true });
            finalFeedback.mutate({ rating, note, moods });
          }}
          onShareFallback={() =>
            showToast({ icon: "Share", title: "Screenshot kartumu", sub: "Lalu unggah ke Story Instagram dan tag Potara." })
          }
        />
      )}

      <div className="page__bottom">
        <BottomNav
          active={activeTab}
          feedbackLocked={!ended}
          onChange={onTab}
          onLockedTap={() =>
            showToast({ icon: "Lock", title: "Feedback belum dibuka", sub: "Dibuka setelah acara selesai. Nikmati dulu acaranya!" })
          }
        />
      </div>
      {layers}
    </main>
  );
}

/** Page toasts that carry good news (or the committee's voice) get the orange icon. */
const ACCENT_TOASTS: string[] = ["Check", "Megaphone", "UserPlus"];

/** One line on what moved, for the "Rundown berubah" notice; null when nothing a guest sees did. */
function describeChange(old: AgendaItem, item: AgendaItem): string | null {
  const d = item.start - old.start;
  if (d > 0) return `${item.title} diundur ${d} menit.`;
  if (d < 0) return `${item.title} dimajukan ${-d} menit.`;
  if (item.roomId !== old.roomId) return `${item.title} pindah ke ${ROOMS[roomIndexById(item.roomId)].name}.`;
  if (item.end !== old.end) return `${item.title} sekarang selesai ${formatTime(item.end)}.`;
  if (item.title !== old.title) return `${old.title} sekarang jadi ${item.title}.`;
  return null;
}

function RewardDialog({ onClose, onExchange }: { onClose: () => void; onExchange: () => void }) {
  return (
    <Dialog
      title={`${KENALAN_TARGET} kartu terkumpul!`}
      onClose={onClose}
      lead={
        <span className="reward-icon clay clay-dark">
          <Icon name="Gift" size={32} />
        </span>
      }
      actions={
        <>
          <Button block onClick={onExchange}>
            Tukar sekarang
          </Button>
          <Button block style="tertiary" onClick={onClose}>
            Nanti saja
          </Button>
        </>
      }
    >
      Hadiahmu dari Potara siap. Tukar di meja panitia sekarang, atau nanti sebelum pulang.
    </Dialog>
  );
}
