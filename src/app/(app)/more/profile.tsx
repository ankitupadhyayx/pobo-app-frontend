import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Card, ErrorState, ListSkeleton } from '@/components/ui';
import { useMe } from '@/api/hooks/me';
import { useLabels } from '@/api/hooks/config';
import { useT } from '@/i18n';

function Row({ label, value, tone, hint, testID }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'rose' | 'slate'; hint?: string; testID?: string }) {
  return (
    <View testID={testID} className="min-h-[44px] justify-center border-b border-slate-100 py-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-slate-600">{label}</Text>
        {tone ? <Badge label={value} tone={tone} /> : <Text className="text-sm font-semibold text-slate-900">{value}</Text>}
      </View>
      {hint ? <Text className="mt-1 text-[11px] text-slate-500">{hint}</Text> : null}
    </View>
  );
}

/** Plain-language next step for an onboarding status; unknown codes get no hint. */
function statusHint(t: ReturnType<typeof useT>, field: 'kyc' | 'agreement' | 'deposit', code?: string | null) {
  return code ? t(`profile.hint.${field}.${code}`, { defaultValue: '' }) || undefined : undefined;
}

function trainingState(pct: number): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' {
  return pct >= 100 ? 'COMPLETE' : pct > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
}

const ok = (s?: string) => (s === 'VERIFIED' || s === 'SIGNED' || s === 'RECEIVED' || s === 'WAIVED' ? 'emerald' : s === 'REJECTED' ? 'rose' : 'amber');

export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMe();
  const L = useLabels();
  const p = me.data?.aa_profile;
  const pct = Math.max(0, Math.min(100, p?.training_progress ?? 0));
  const training = trainingState(pct);
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('profile.profile')} />
      <ScrollView contentContainerClassName="p-4 gap-4 pb-12">
        {me.isPending ? (
          <ListSkeleton count={1} />
        ) : !me.data ? (
          <ErrorState error={me.error} onRetry={() => me.refetch()} />
        ) : (
          <>
            <Card>
              <Text className="text-lg font-extrabold text-slate-900">{me.data.name}</Text>
              <Text className="text-xs text-slate-500">
                {p?.code} · {me.data.phone}
              </Text>
              {me.data.email ? <Text className="text-xs text-slate-500">{me.data.email}</Text> : null}
              <View className="mt-3">
                <Row label={t('profile.territory')} value={p?.territory?.name ?? '—'} />
                <Row label={t('profile.supervisor')} value={p?.supervisor_name ?? '—'} />
                <Row label={t('profile.joined')} value={p?.joined_on ?? '—'} />
                {p?.status ? <Row label={t('profile.accountStatus')} value={L.enumLabel('aa_status', p.status)} tone={p.status === 'ACTIVE' ? 'emerald' : p.status === 'SUSPENDED' ? 'rose' : 'amber'} /> : null}
              </View>
            </Card>
            <Card testID="profile-training">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-slate-900">{t('profile.training')}</Text>
                <Badge label={t(`profile.trainingState.${training}`)} tone={training === 'COMPLETE' ? 'emerald' : 'amber'} />
              </View>
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
                <View className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
              </View>
              <Text className="mt-1.5 text-xs text-slate-600">{t('profile.trainingPct', { pct })}</Text>
              {training !== 'COMPLETE' ? <Text className="mt-1 text-[11px] text-slate-500">{t('profile.trainingHint')}</Text> : null}
            </Card>
            <Card>
              <Text className="mb-1 text-sm font-bold text-slate-900">{t('profile.onboardingStatus')}</Text>
              <Row testID="profile-kyc" label={t('profile.kyc')} value={L.enumLabel('kyc_status', p?.kyc_status)} tone={ok(p?.kyc_status)} hint={statusHint(t, 'kyc', p?.kyc_status)} />
              <Row testID="profile-agreement" label={t('profile.agreement')} value={L.enumLabel('agreement_status', p?.agreement_status)} tone={ok(p?.agreement_status)} hint={statusHint(t, 'agreement', p?.agreement_status)} />
              <Row testID="profile-deposit" label={t('profile.deposit')} value={L.enumLabel('deposit_status', p?.deposit_status)} tone={ok(p?.deposit_status)} hint={statusHint(t, 'deposit', p?.deposit_status)} />
              <Row label={t('profile.conduct')} value={p?.onboarding_ack_version ? `v${p.onboarding_ack_version}` : '—'} />
              <Text className="mt-2 text-[11px] text-slate-500">{t('profile.changesViaOps')}</Text>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
