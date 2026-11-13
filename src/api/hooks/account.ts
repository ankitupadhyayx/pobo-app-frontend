import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { cursorFrom, qk } from '../keys';
import { queryClient } from '../queryClient';
import type { components } from '../schema';

// ---------------------------------------------------------------- Notifications (APP-19)
export function useNotifications(enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.notifications,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET('/api/v1/notifications', { params: { query: { page_size: 25, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
}

export function useMarkRead() {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/api/v1/notifications/{id}/read', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications });
      void queryClient.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useMarkAllRead() {
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/notifications/read-all')),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications });
      void queryClient.invalidateQueries({ queryKey: qk.home });
    },
  });
}

// ---------------------------------------------------------------- Leave & roster (APP-20)
export function useRoster() {
  return useQuery({ queryKey: qk.roster, queryFn: () => unwrap(api.GET('/api/v1/me/roster')) });
}

export function useMyLeave() {
  return useQuery({
    queryKey: qk.leave,
    queryFn: () => unwrap(api.GET('/api/v1/me/leave', { params: { query: { page_size: 50 } } })),
  });
}

/** R2-17: cancel a pending (or approved, not started) leave request. */
export function useCancelLeave() {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/api/v1/me/leave/{id}/cancel', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.leave });
      void queryClient.invalidateQueries({ queryKey: qk.roster });
    },
  });
}

export function useRequestLeave() {
  return useMutation({
    mutationFn: (body: components['schemas']['LeaveRequestInputRequest']) => unwrap(api.POST('/api/v1/me/leave', { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.leave });
      void queryClient.invalidateQueries({ queryKey: qk.roster });
    },
  });
}
