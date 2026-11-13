import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BellRing, ChevronRight } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Card, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { useMarkReminderRead, useReminders, type Reminder } from '@/api/hooks/reminders';
import { reminderHref } from '@/lib/deeplink';
import { formatWhen } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** FB-23: reminders sent by Ops. Tapping one marks it read and opens the exact record. */
export default function RemindersScreen() {
  const t = useT();
  const router = useRouter();
  const q = useReminders();
  const read = useMarkReminderRead();
  const items = q.data ?? [];
  const openIt = (r: Reminder) => {
    if (!r.is_read) read.mutate(r.id);
    const href = reminderHref(r.screen, r.target);
    if (href) router.push(href as never);
  };
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('reminders.title')} />
      <ScrollView contentContainerClassName="p-4 gap-3 pb-12" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={3} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={BellRing} title={t('reminders.emptyTitle')} body={t('reminders.emptyBody')} />
        ) : (
          items.map((r) => (
            <Card key={r.id} testID={`reminder-${r.id}`} tone={r.is_read ? 'muted' : 'default'} onPress={() => openIt(r)}>
              <View className="flex-row items-start gap-2">
                {!r.is_read ? <View className="mt-1.5 h-2 w-2 rounded-full bg-teal-600" /> : null}
                <View className="flex-1">
                  <Text className={cn('text-sm text-slate-900', r.is_read ? 'font-semibold' : 'font-extrabold')}>{r.title}</Text>
                  {r.message ? <Text className="mt-0.5 text-xs text-slate-700">{r.message}</Text> : null}
                  <Text className="mt-1 text-[11px] text-slate-500">{t('reminders.from', { name: r.sender_name, when: formatWhen(r.created_at) })}</Text>
                </View>
                <View className="flex-row items-center gap-0.5 self-center">
                  <Text className="text-xs font-bold text-teal-700">{r.label || t('common.open')}</Text>
                  <ChevronRight size={14} color={colors.brandDark} />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
