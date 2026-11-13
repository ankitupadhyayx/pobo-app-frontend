import { useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { Badge, Button } from '@/components/ui';
import type { Communication } from '@/api/types';
import { formatWhen } from '@/lib/time';
import { useT } from '@/i18n';
import { useRequirementCommunications } from '@/api/hooks/leads';
import { colors } from '@/theme/colors';

type Tone = 'slate' | 'teal' | 'amber' | 'rose';
const STATUS_TONE: Record<string, Tone> = { DEEP_LINK: 'teal', SENT: 'teal', QUEUED_NO_PROVIDER: 'amber', FAILED: 'rose', SKIPPED: 'slate' };

/** REQ-11: "Open" only makes sense for a message the AA opened on their phone; automatic messages have no link. */
export const canOpenCommunication = (c: Pick<Communication, 'deep_link'>) => !!c.deep_link?.trim();

/**
 * REQ-11: messages logged on a requirement, with plain words for what happened to each one
 * (opened on your phone / queued, not sent / skipped for DNC) and who it was for.
 */
export function CommunicationList({ items }: { items: Communication[] }) {
  const t = useT();
  return (
    <View className="gap-2">
      {items.map((c) => (
        <View key={c.id} testID={`comm-${c.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Badge testID={`comm-status-${c.id}`} label={t(`messages.status.${c.status}`, { defaultValue: c.status })} tone={STATUS_TONE[c.status] ?? 'slate'} />
            <Text className="text-[11px] font-semibold text-slate-600">{t(`messages.recipient.${c.recipient_kind}`, { defaultValue: c.recipient_kind })}</Text>
            {!canOpenCommunication(c) ? <Text className="text-[11px] text-slate-500">· {t('messages.automatic')}</Text> : null}
            <Text className="ml-auto text-[10px] text-slate-400">{formatWhen(c.created_at)}</Text>
          </View>
          <Text className="mt-1 text-xs text-slate-700" numberOfLines={3}>{c.body}</Text>
          {canOpenCommunication(c) ? (
            <Button testID={`comm-open-${c.id}`} className="mt-2 self-start" size="sm" variant="ghost" label={t('messages.open')} onPress={() => void Linking.openURL(c.deep_link).catch(() => undefined)} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * REQ-12: a requirement's message history (manual + automatic) on the requirement card.
 * Collapsed by default so a lead with many requirements doesn't fetch every list up front.
 */
export function RequirementCommunications({ requirementId }: { requirementId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const q = useRequirementCommunications(requirementId, open);
  const items = q.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <View testID={`req-comms-${requirementId}`} className="gap-2">
      <Button
        testID={`req-comms-toggle-${requirementId}`}
        className="self-start"
        size="sm"
        variant="ghost"
        icon={MessageCircle}
        label={open ? t('messages.list.hide') : t('messages.list.show')}
        onPress={() => setOpen((o) => !o)}
      />
      {open ? (
        q.isPending ? (
          <ActivityIndicator color={colors.brandDark} />
        ) : q.isError ? (
          <Text className="text-xs text-rose-700">{t('messages.list.loadFailed')}</Text>
        ) : items.length === 0 ? (
          <Text testID={`req-comms-empty-${requirementId}`} className="text-xs italic text-slate-500">{t('messages.list.empty')}</Text>
        ) : (
          <>
            <CommunicationList items={items} />
            {q.hasNextPage ? (
              <Button className="self-start" size="sm" variant="ghost" label={t('messages.list.more')} disabled={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} />
            ) : null}
          </>
        )
      ) : null}
    </View>
  );
}
