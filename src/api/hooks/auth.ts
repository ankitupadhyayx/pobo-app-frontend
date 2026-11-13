import { useMutation } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api, tokens } from '../instance';
import { ApiError } from '../errors';
import { qk, toE164 } from '../keys';
import { queryClient } from '../queryClient';
import { useSession } from '@/state/session';
import { setLanguage } from '@/i18n';

export function useRequestOtp() {
  return useMutation({
    mutationFn: async (phone10: string) => {
      const res = await unwrap(api.POST('/api/v1/auth/otp/request', { body: { phone: toE164(phone10) } }));
      return { resendAfterSeconds: res.resend_after, expiresIn: res.expires_in };
    },
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async ({ phone, code }: { phone: string; code: string }) => {
      const res = await unwrap(api.POST('/api/v1/auth/otp/verify', { body: { phone: toE164(phone), code } }));
      // This app is AA-only; other roles use the Ops/Finance web consoles (blueprint §3).
      if (res.user.role !== 'AA' || !res.user.aa_profile) {
        throw new ApiError(403, 'not_aa', 'This app is for Area Ambassadors. Use the POBO web console for your role.');
      }
      await tokens.set({ access: res.access, refresh: res.refresh });
      queryClient.setQueryData(qk.me, res.user);
      setLanguage(res.user.language);
      useSession.getState().setStatus('signedIn');
      return res.user;
    },
  });
}

/** Revoke the refresh token server-side (best effort), then wipe local state. */
export async function logout() {
  const t = await tokens.get();
  try {
    await api.DELETE('/api/v1/me/devices');
  } catch {
    /* offline: ignore */
  }
  if (t?.refresh) {
    try {
      await api.POST('/api/v1/auth/logout', { body: { refresh: t.refresh } });
    } catch {
      /* offline: token expires on its own */
    }
  }
  await tokens.clear();
  queryClient.clear();
  useSession.getState().setStatus('signedOut');
}
