import { useCallback, useEffect, useRef } from "react";
import { KENALAN_TARGET } from "../config";
import type { GuestAnnouncement, KenalanInvite, KenalanInvites } from "../data/adapters";
import {
  addNotices,
  announcementNotice,
  kenalanNotice,
  pruneAnnouncements,
  questionNotices,
  rewardNotices,
  type GuestNotice,
} from "../data/notifications";
import { useGuest } from "./guestContext";

/** How far before a guest arrived an announcement still reaches them, in minutes. */
export const ANNOUNCEMENT_GRACE_MIN = 30;

/** Notifikasi keeps the newest this many: it is saved with the guest's progress on every change. */
const NOTICE_MAX = 100;

/** An invite older than this is old news: logged in Notifikasi, but no toast. */
const INVITE_TOAST_MS = 10 * 60 * 1000;

const capped = (list: GuestNotice[]) => (list.length > NOTICE_MAX ? [...list].sort((a, b) => b.at - a.at).slice(0, NOTICE_MAX) : list);

/** Logs notices into Notifikasi, skipping ones already there; `read` for things the guest is looking at anyway. */
export function useLogNotices() {
  const { update } = useGuest();
  return useCallback(
    (fresh: Omit<GuestNotice, "read">[], read = false) =>
      update((s) => {
        const notices = addNotices(s.notices, fresh, read);
        return notices === s.notices ? null : { notices: capped(notices) };
      }),
    [update],
  );
}

type Sync = {
  /** Live session (not a review case, an invite token held). */
  live: boolean;
  announcements?: GuestAnnouncement[];
  invites?: KenalanInvites;
  /** A kenalan invite fresh enough to pop up as a toast. */
  onInvite: (inv: KenalanInvite) => void;
};

/**
 * Builds Notifikasi from what the server already sends: committee and MC
 * announcements, the MC reading this guest's questions, the prize, and other
 * guests' "Ajak kenalan". Rundown changes and new photos are logged where they
 * are detected (guest/routes.tsx); review cases bring their own sample list.
 */
export function useNoticeSync({ live, announcements, invites, onInvite }: Sync) {
  const { state, update } = useGuest();
  const log = useLogNotices();

  // Announcements: new ones in, deleted ones (gone from the server's list) out.
  useEffect(() => {
    if (!live || !announcements) return;
    update((s) => {
      const pruned = pruneAnnouncements(s.notices, announcements);
      const fresh = announcements.filter((a) => a.at >= s.hadirAt - ANNOUNCEMENT_GRACE_MIN).map(announcementNotice);
      const notices = addNotices(pruned, fresh);
      return notices === s.notices ? null : { notices: capped(notices) };
    });
  }, [live, announcements, update]);

  useEffect(() => {
    if (live) log(questionNotices(state.questions, state.now));
    // `now` only stamps a status change when it is first seen; it is not a reason to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, state.questions, log]);

  const cards = Object.keys(state.collected).length;
  const claimed = state.rewardClaimed;
  useEffect(() => {
    if (!live || cards < KENALAN_TARGET) return;
    // The prize is handed over on this guest's own phone (the committee types
    // their PIN on it), so "claimed" is never news: logged read, and the
    // "ready" reminder goes quiet with it.
    if (!claimed) return log(rewardNotices(cards, false, state.now));
    update((s) => {
      const read = s.notices.map((n) => (n.id === "hadiah-siap" && !n.read ? { ...n, read: true } : n));
      const notices = addNotices(read, rewardNotices(cards, true, s.now), true);
      return notices === s.notices ? null : { notices: capped(notices) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, cards, claimed, log, update]);

  // Kenalan invites: every one lands in Notifikasi; a recent one not seen before also pops up.
  const onInviteRef = useRef(onInvite);
  useEffect(() => {
    onInviteRef.current = onInvite;
  });
  const handled = useRef(new Set<string>());
  useEffect(() => {
    if (!live || !invites) return;
    const logged = new Set(state.notices.map((n) => n.id));
    const fresh = invites.received.filter((inv) => !handled.current.has(inv.id) && !logged.has(kenalanNotice(inv).id));
    invites.received.forEach((inv) => handled.current.add(inv.id));
    if (!fresh.length) return;
    log(fresh.map(kenalanNotice));
    // Newest first, as the server sends them; one toast is enough.
    const recent = fresh.find((inv) => inv.sentAt > Date.now() - INVITE_TOAST_MS);
    if (recent) onInviteRef.current(recent);
  }, [live, invites, state.notices, log]);
}
