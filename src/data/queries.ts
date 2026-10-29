import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, mutationKeys, queryKeys } from "./adapters";
import { setAgenda } from "./agenda";
import { queryClient } from "./queryClient";

/**
 * Reads come from the cache first, so a guest on a weak connection still sees
 * the list. Writes go through mutations with a stable key: while offline they
 * are paused, persisted to IndexedDB, and replayed in order once back online.
 */

/**
 * Who is in the room right now.
 *
 * There is no bundled initial value any more: an invented guest list is worse
 * than an empty one, because a guest would try to collect a card from somebody
 * who is not here. The persisted cache fills this in instantly for anyone who
 * has loaded it once, which is the case that mattered.
 */
export function useGuests(enabled = true) {
  const { data } = useQuery({
    queryKey: queryKeys.guests,
    queryFn: api.guests,
    enabled,
    initialData: [],
    // Without this the empty initialData counted as fresh, so the list was not
    // fetched at all until it went stale -- a guest saw "Kamu yang pertama
    // hadir!" in a full room.
    initialDataUpdatedAt: 0,
    // People keep arriving all day.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  return data;
}

/**
 * The rundown, from the server into the registry in data/agenda.ts.
 *
 * statusAt(), currentItem() and eventEndedAt() stay pure functions over that
 * registry, so they keep working wherever they are called; this is what
 * keeps the registry current. Polled, because the committee moves sessions
 * on the day and a guest's phone is open for hours.
 *
 * `enabled` is false for review links, which run on the sample rundown.
 */
export function useAgendaQuery(enabled: boolean) {
  const { data } = useQuery({
    queryKey: queryKeys.agenda,
    queryFn: api.agenda,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (enabled && data) setAgenda(data);
  }, [enabled, data]);
}

/**
 * Every question asked, with `mine` worked out by the server for this guest.
 *
 * Polled and refetched on focus: the MC marking a question dibaca/terjawab is
 * the whole feedback a guest gets that they were heard.
 */
export function useQuestionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.questions,
    queryFn: api.questions,
    enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  }).data;
}

/** Committee announcements, newest last as the server sends them. */
export function useAnnouncementsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.announcements,
    queryFn: api.announcements,
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  }).data;
}

/**
 * Registered as defaults so a mutation that was paused offline can be resumed
 * after a reload, when the component that started it no longer exists.
 */
export function registerMutationDefaults() {
  queryClient.setMutationDefaults(mutationKeys.sendQuestion, { mutationFn: api.sendQuestion });
  queryClient.setMutationDefaults(mutationKeys.editQuestion, { mutationFn: api.editQuestion });
  queryClient.setMutationDefaults(mutationKeys.deleteQuestion, { mutationFn: api.deleteQuestion });
  queryClient.setMutationDefaults(mutationKeys.eventFeedback, { mutationFn: api.sendEventFeedback });
  queryClient.setMutationDefaults(mutationKeys.finalFeedback, { mutationFn: api.sendFinalFeedback });
  queryClient.setMutationDefaults(mutationKeys.collectCard, { mutationFn: api.collectCard });
}

export const useSendQuestion = () => useMutation({ mutationKey: mutationKeys.sendQuestion, mutationFn: api.sendQuestion });
export const useEditQuestion = () => useMutation({ mutationKey: mutationKeys.editQuestion, mutationFn: api.editQuestion });
export const useDeleteQuestion = () => useMutation({ mutationKey: mutationKeys.deleteQuestion, mutationFn: api.deleteQuestion });
export const useEventFeedback = () => useMutation({ mutationKey: mutationKeys.eventFeedback, mutationFn: api.sendEventFeedback });
export const useFinalFeedback = () => useMutation({ mutationKey: mutationKeys.finalFeedback, mutationFn: api.sendFinalFeedback });
export const useCollectCard = () => useMutation({ mutationKey: mutationKeys.collectCard, mutationFn: api.collectCard });
