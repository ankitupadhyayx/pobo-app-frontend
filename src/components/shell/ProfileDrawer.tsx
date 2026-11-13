import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { BookOpen, CalendarDays, ChevronRight, CalendarOff, LogOut, Languages, User, BookA, Wifi, WifiOff, RefreshCw, Building2, KeyRound, BellRing } from 'lucide-react-native';
import { Button, DateTimeField, InlineBanner, SideDrawer, TextField } from '@/components/ui';
import { useMe, useUpdateDuty, useUpdateLanguage } from '@/api/hooks/me';
import { logout } from '@/api/hooks/auth';
import { useLabels } from '@/api/hooks/config';
import { errorMessage } from '@/api/errors';
import { useActions } from '@/state/actions';
import { useOnline } from '@/hooks/useOnline';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { formatWhen } from '@/lib/time';
import i18n, { useT } from '@/i18n';
import { cn } from '@/lib/cn';

export function initials(name: string | undefined) {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function LinkRow({ icon: Icon, label, hint, onPress, testID }: { icon: typeof User; label: string; hint?: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className="min-h-[52px] flex-row items-center gap-3 rounded-xl px-3 active:bg-slate-50">
      <Icon size={18} color={colors.slate600} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-800">{label}</Text>
        {hint ? <Text className="text-[11px] text-slate-400">{hint}</Text> : null}
      </View>
      <ChevronRight size={16} color={colors.slate400} />
    </Pressable>
  );
}

/** APP-07 profile drawer: duty on/off, temporarily unavailable, links, language, logout. */
export function ProfileDrawer() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const online = useOnline();
  const drawer = useActions((s) => s.drawer);
  const setDrawer = useActions((s) => s.setDrawer);
  const me = useMe();
  const duty = useUpdateDuty();
  const lang = useUpdateLanguage();
  const p = me.data?.aa_profile;
  const onDuty = p?.duty_status === 'ON_DUTY';
  const [confirmOff, setConfirmOff] = useState(false);
  const [unavailOpen, setUnavailOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState<Date | null>(null);
  const [reasonErr, setReasonErr] = useState<string>();
  const [loggingOut, setLoggingOut] = useState(false);

  const go = (href: string) => {
    setDrawer(null);
    router.push(href as never);
  };

  const setDuty = (next: 'ON_DUTY' | 'OFF_DUTY') => {
    duty.mutate(
      { duty_status: next },
      {
        onSuccess: () => {
          setConfirmOff(false);
          analytics.track('duty_status_changed', { duty_status: next });
        },
      },
    );
  };

  const saveUnavailable = () => {
    if (!reason.trim()) return setReasonErr(t('errors.required'));
    duty.mutate(
      { temporarily_unavailable: true, unavailable_reason: reason.trim(), unavailable_until: until?.toISOString() ?? null },
      { onSuccess: () => setUnavailOpen(false) },
    );
  };

  return (
    <SideDrawer testID="profile-drawer" visible={drawer === 'profile'} onClose={() => setDrawer(null)} title={t('profile.profile')}>
      <ScrollView contentContainerClassName="p-4 gap-4">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full border border-teal-300 bg-teal-100">
            <Text className="text-base font-bold text-teal-800">{initials(me.data?.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-slate-900">{me.data?.name}</Text>
            <Text className="text-xs font-medium text-teal-800">
              {p?.code} · {L.enumLabel('role', me.data?.role) || 'Area Ambassador'}
            </Text>
            {p?.territory ? (
              <Text className="text-[11px] text-slate-500">
                {t('profile.territory')}: {p.territory.name}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Duty */}
        <View className="gap-3 rounded-2xl border border-slate-200 p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-bold text-slate-900">{t('profile.duty')}</Text>
              <Text className="text-[11px] text-slate-500">{L.glossary('ON_DUTY', t('profile.onDuty')).definition ?? t('profile.dutyHint')}</Text>
            </View>
            <Switch
              testID="duty-switch"
              accessibilityLabel={t('profile.duty')}
              value={onDuty}
              disabled={duty.isPending || !online}
              trackColor={{ true: colors.ok, false: colors.line }}
              onValueChange={(v) => (v ? setDuty('ON_DUTY') : setConfirmOff(true))}
            />
          </View>
          <Text className={cn('text-xs font-bold', onDuty ? 'text-emerald-700' : 'text-slate-500')}>
            {L.enumLabel('duty_status', p?.duty_status)}
          </Text>
          {confirmOff ? (
            <View className="gap-2 rounded-xl bg-slate-50 p-3">
              <Text className="text-xs text-slate-700">{t('profile.dutyHint')}</Text>
              <View className="flex-row gap-2">
                <Button size="sm" variant="secondary" label={t('common.cancel')} onPress={() => setConfirmOff(false)} />
                <Button testID="duty-off-confirm" size="sm" variant="danger" className="flex-1" label={t('profile.goOffDuty')} loading={duty.isPending} onPress={() => setDuty('OFF_DUTY')} />
              </View>
            </View>
          ) : null}

          {/* Temporarily unavailable */}
          {p?.temporarily_unavailable ? (
            <View className="gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Text className="text-xs font-bold text-amber-900">
                {t('profile.unavailable')}: {p.unavailable_reason}
                {p.unavailable_until ? ` · ${t('profile.unavailableUntil')} ${formatWhen(p.unavailable_until)}` : ''}
              </Text>
              <Button size="sm" variant="outline" label={t('profile.clearUnavailable')} loading={duty.isPending} onPress={() => duty.mutate({ temporarily_unavailable: false, unavailable_reason: '', unavailable_until: null })} />
            </View>
          ) : unavailOpen ? (
            <View className="gap-2">
              <TextField label={t('profile.unavailableReason')} placeholder={t('profile.unavailableHint')} value={reason} onChangeText={(v) => { setReason(v); setReasonErr(undefined); }} error={reasonErr} />
              <DateTimeField label={t('profile.unavailableUntil')} value={until} onChange={setUntil} minimumDate={new Date()} />
              <View className="flex-row gap-2">
                <Button size="sm" variant="secondary" label={t('common.cancel')} onPress={() => setUnavailOpen(false)} />
                <Button size="sm" className="flex-1" label={t('profile.setUnavailable')} loading={duty.isPending} onPress={saveUnavailable} />
              </View>
            </View>
          ) : (
            <Button size="sm" variant="outline" icon={CalendarOff} label={t('profile.unavailable')} disabled={!onDuty || !online} onPress={() => setUnavailOpen(true)} />
          )}
          {duty.error ? <InlineBanner>{errorMessage(duty.error)}</InlineBanner> : null}
        </View>

        <View>
          <LinkRow icon={CalendarDays} label={t('profile.myWeek')} hint={t('profile.myWeekHint')} onPress={() => go('/more/my-week')} />
          <LinkRow testID="link-leave" icon={CalendarOff} label={t('profile.leave')} hint={t('profile.leaveHint')} onPress={() => go('/more/leave')} />
          <LinkRow icon={BookOpen} label={t('profile.learn')} hint={t('profile.learnHint')} onPress={() => go('/more/learn')} />
          <LinkRow testID="link-listings" icon={Building2} label={t('listings.mine')} onPress={() => go('/more/listings')} />
          <LinkRow testID="link-reminders" icon={BellRing} label={t('reminders.title')} hint={t('reminders.hint')} onPress={() => go('/more/reminders')} />
          <LinkRow testID="link-keys" icon={KeyRound} label={t('keys.title')} onPress={() => go('/more/keys')} />
          <LinkRow testID="link-sync" icon={RefreshCw} label={t('sync.title')} hint={t('profile.syncHint')} onPress={() => go('/more/sync')} />
          <LinkRow icon={BookA} label={t('profile.glossary')} onPress={() => go('/more/glossary')} />
          <LinkRow icon={User} label={t('profile.profile')} hint={t('profile.profileHint')} onPress={() => go('/more/profile')} />
        </View>

        <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 p-3">
          <View className="flex-row items-center gap-2">
            <Languages size={18} color={colors.slate600} />
            <Text className="text-sm font-semibold text-slate-800">{t('profile.language')}</Text>
          </View>
          <View className="flex-row rounded-full bg-slate-100 p-0.5">
            {(['en', 'hi'] as const).map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected: i18n.language === code }}
                onPress={() => lang.mutate(code)}
                className={cn('rounded-full px-3 py-1', i18n.language === code && 'bg-teal-600')}
              >
                <Text className={cn('text-xs font-bold', i18n.language === code ? 'text-white' : 'text-slate-600')}>{code === 'en' ? 'English' : 'हिन्दी'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="flex-row items-center gap-2 px-1">
          {online ? <Wifi size={14} color={colors.ok} /> : <WifiOff size={14} color={colors.warn} />}
          <Text className="text-xs text-slate-500">{online ? t('profile.online') : t('profile.offline')}</Text>
        </View>

        <Button
          testID="logout"
          variant="outline"
          icon={LogOut}
          label={t('profile.logout')}
          loading={loggingOut}
          onPress={async () => {
            setLoggingOut(true);
            setDrawer(null);
            await logout();
          }}
        />
        <Text className="text-center text-[11px] text-slate-400">{t('profile.version', { v: Constants.expoConfig?.version ?? '' })}</Text>
      </ScrollView>
    </SideDrawer>
  );
}
