import { ActivityIndicator, Text, View } from 'react-native';
import { Button, ErrorState } from '@/components/ui';
import { useTimeline } from '@/api/hooks/leads';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

const DOT: Record<string, string> = {
  CALL_LOGGED: 'bg-teal-500',
  FOLLOW_UP_CREATED: 'bg-amber-500',
  FOLLOW_UP_COMPLETED: 'bg-emerald-500',
  REQUIREMENT_ASSIGNED: 'bg-blue-500',
  TRANSFER_REQUESTED: 'bg-amber-600',
  DNC_SET: 'bg-rose-600',
  SLA_BREACHED: 'bg-rose-600',
};

/** Relationship timeline (who did what, when). Never silently rewritten (audit). */
export function Timeline({ relationshipId, typeLabelFor }: { relationshipId: string; typeLabelFor: (requirementId: string | null) => string | null }) {
  const t = useT();
  const q = useTimeline(relationshipId);
  const events = q.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <View className="gap-3 rounded-3xl border border-slate-200 bg-white p-5">
      <Text className="text-sm font-extrabold text-slate-900">{t('lead.timeline')}</Text>
      {q.isPending ? (
        <ActivityIndicator color={colors.brand} />
      ) : q.error && !events.length ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : events.length === 0 ? (
        <Text className="text-xs text-slate-500">{t('lead.timelineEmpty')}</Text>
      ) : (
        <View>
          {events.map((e, i) => {
            const tag = typeLabelFor(e.requirement_id);
            return (
              <View key={e.id} className="flex-row gap-3">
                <View className="items-center">
                  <View className={`mt-1 h-2.5 w-2.5 rounded-full ${DOT[e.verb] ?? 'bg-slate-400'}`} />
                  {i < events.length - 1 ? <View className="w-px flex-1 bg-slate-200" /> : null}
                </View>
                <View className="flex-1 pb-4">
                  <Text className="text-xs font-bold text-slate-900">{e.title}</Text>
                  {e.description ? <Text className="mt-0.5 text-xs text-slate-600">{e.description}</Text> : null}
                  <Text className="mt-0.5 text-[10px] text-slate-400">
                    {formatWhen(e.created_at)}
                    {e.actor_label ? ` · ${e.actor_label}` : ''}
                    {tag ? ` · ${tag}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
          {q.hasNextPage ? (
            <Button size="sm" variant="ghost" label={t('lead.loadOlder')} loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />
          ) : null}
        </View>
      )}
    </View>
  );
}
