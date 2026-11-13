import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { qk } from '../keys';
import { queryClient } from '../queryClient';
import type { Me } from '../types';
import type { components } from '../schema';
import { setLanguage } from '@/i18n';

export function useMe(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.me,
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const me = await unwrap(api.GET('/api/v1/me'));
      setLanguage(me.language);
      return me;
    },
  });
}

/** True when the server says this AA still has to acknowledge the current conduct version. */
export function needsOnboarding(me: Me | undefined): boolean {
  return !!me?.aa_profile?.onboarding_required;
}

export function useOnboardingAck() {
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/me/onboarding/ack', { body: {} })),
    onSuccess: (me) => queryClient.setQueryData(qk.me, me),
  });
}

type DutyPatch = components['schemas']['PatchedDutyUpdateRequest'];

/** APP-07 duty on/off and temporarily unavailable (+ reason, until). */
export function useUpdateDuty() {
  return useMutation({
    mutationFn: (body: DutyPatch) => unwrap(api.PATCH('/api/v1/me/duty', { body })),
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me, me);
      void queryClient.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useUpdateLanguage() {
  return useMutation({
    mutationFn: (language: 'en' | 'hi') => unwrap(api.PATCH('/api/v1/me', { body: { language } })),
    onMutate: (language) => setLanguage(language),
    onSuccess: (me) => queryClient.setQueryData(qk.me, me),
  });
}

export function registerDevice(token: string, platform: 'android' | 'ios', appVersion?: string) {
  return unwrap(api.POST('/api/v1/me/devices', { body: { token, provider: 'EXPO', platform, app_version: appVersion } }));
}
