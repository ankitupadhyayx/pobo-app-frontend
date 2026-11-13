import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { queryClient } from '../queryClient';
import type { components } from '../schema';

type S = components['schemas'];
export type Reminder = S['Reminder'];
export type FieldFlag = S['FieldFlag'];

// ------------------------------------------------------------- FB-23 reminders from Ops
export function useReminders(unread = false) {
  return useQuery({ queryKey: ['reminders', unread], queryFn: () => unwrap(api.GET('/api/v1/me/reminders', { params: { query: unread ? { unread: true } : {} } })) });
}

export function useMarkReminderRead() {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/api/v1/me/reminders/{id}/read', { params: { path: { id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ------------------------------------------------------------- FB-13 "Not sure" facts
export function useFlagField() {
  return useMutation({
    mutationFn: (body: S['FieldFlagInputRequest']) => unwrap(api.POST('/api/v1/field-flags', { body })),
    onSuccess: (f: FieldFlag) => {
      void queryClient.invalidateQueries({ queryKey: ['unit', f.unit_id] });
      if (f.listing_id) void queryClient.invalidateQueries({ queryKey: ['listing', f.listing_id] });
    },
  });
}

export function useWithdrawFlag() {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/api/v1/field-flags/{id}/withdraw', { params: { path: { id } } })),
    onSuccess: (f: FieldFlag) => {
      void queryClient.invalidateQueries({ queryKey: ['unit', f.unit_id] });
      if (f.listing_id) void queryClient.invalidateQueries({ queryKey: ['listing', f.listing_id] });
    },
  });
}
