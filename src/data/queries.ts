import { useMutation, useQuery } from "@tanstack/react-query";
import { api, mutationKeys, queryKeys } from "./adapters";
import { queryClient } from "./queryClient";

/**
 * Reads come from the cache first, so a guest on a weak connection still sees
 * the list. Writes go through mutations with a stable key: while offline they
 * are paused, persisted to IndexedDB, and replayed in order once back online.
 *
 * The rundown is deliberately not here yet: statusAt(), currentItem() and
 * eventEndedAt() are pure module functions in data/agenda.ts used all over the
 * app. api.agenda and queryKeys.agenda are in place for when the rundown
 * becomes live admin-edited data, which is the next step.
 */

/**
 * Who is in the room right now.
 *
 * There is no bundled initial value any more: an invented guest list is worse
 * than an empty one, because a guest would try to collect a card from somebody
 * who is not here. The persisted cache fills this in instantly for anyone who
 * has loaded it once, which is the case that mattered.
 */
export function useGuests() {
  const { data } = useQuery({
    queryKey: queryKeys.guests,
    queryFn: api.guests,
    initialData: [],
  });
  return data;
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
