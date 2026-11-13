import { useMe } from '@/api/hooks/me';
import { useHome } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { useActions } from '@/state/actions';
import { AppHeader } from './AppHeader';
import { initials } from './ProfileDrawer';
import { OfflineBanner } from '@/components/ui';
import { SyncBanner } from './SyncBanner';
import { queryClient } from '@/api/queryClient';
import { useT } from '@/i18n';

/** Header bound to /me (duty) and /me/home (unread count). */
export function ConnectedHeader({ onBack, title }: { onBack?: () => void; title?: string }) {
  const t = useT();
  const me = useMe();
  const home = useHome();
  const L = useLabels();
  const setDrawer = useActions((s) => s.setDrawer);
  const p = me.data?.aa_profile;
  const onDuty = p?.duty_status === 'ON_DUTY';
  const dutyLabel = p?.temporarily_unavailable
    ? t('profile.unavailableShort')
    : L.glossary(onDuty ? 'ON_DUTY' : 'OFF_DUTY', L.enumLabel('duty_status', p?.duty_status) || t(onDuty ? 'profile.onDuty' : 'profile.offDuty')).label;
  return (
    <>
      <AppHeader
        title={title}
        onBack={onBack}
        territory={p?.territory?.name}
        dutyLabel={dutyLabel}
        onDuty={onDuty}
        unavailable={!!p?.temporarily_unavailable}
        unread={home.data?.unread_notifications ?? 0}
        initials={initials(me.data?.name)}
        onBell={() => setDrawer('notifications')}
        onAvatar={() => setDrawer('profile')}
        onDutyPress={() => setDrawer('profile')}
      />
      <OfflineBanner onRetry={() => queryClient.refetchQueries({ type: 'active' })} />
      <SyncBanner />
    </>
  );
}
