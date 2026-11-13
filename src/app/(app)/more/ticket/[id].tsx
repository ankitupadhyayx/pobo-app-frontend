import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Button, Card, ErrorState, InlineBanner, ListSkeleton, TextField } from '@/components/ui';
import { TICKET_TONE } from '@/components/help/RaiseTicketSheet';
import { useReplyTicket, useTicket } from '@/api/hooks/phase3';
import { useSubmit } from '@/hooks/useSubmit';
import { useOnline } from '@/hooks/useOnline';
import { useActions } from '@/state/actions';
import { cn } from '@/lib/cn';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useLabels } from '@/api/hooks/config';
import { useT } from '@/i18n';

/** APP-33 ticket detail: status, the original message and the reply thread; replying re-opens a resolved ticket. */
export default function TicketScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useTicket(id ?? '');
  const reply = useReplyTicket(id ?? '');
  const online = useOnline();
  const showToast = useActions((s) => s.showToast);
  const [body, setBody] = useState('');
  const s = useSubmit(async () => {
    await reply.mutateAsync(body.trim());
    setBody('');
    showToast(t('help.replySent'));
  });
  const tk = q.data;
  const closed = tk?.status === 'CLOSED';
  return (
    <KeyboardAvoidingView className="flex-1 bg-slate-100" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ConnectedHeader onBack={() => router.back()} title={tk?.reference ?? t('help.tickets')} />
      <ScrollView contentContainerClassName="p-4 gap-3 pb-12" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : !tk ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <Card>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-xs font-bold text-slate-500">
                  {tk.reference} · {L.enumLabel('ticket_category', tk.category) || tk.category_label}
                </Text>
                <Badge label={L.enumLabel('ticket_status', tk.status) || tk.status_label} tone={TICKET_TONE[tk.status ?? 'OPEN']} />
              </View>
              {tk.subject ? <Text className="mt-2 text-base font-bold text-slate-900">{tk.subject}</Text> : null}
              <Text className="mt-1 text-sm text-slate-700">{tk.message}</Text>
              <Text className="mt-2 text-[11px] text-slate-500">{formatWhen(tk.created_at)}</Text>
              <Text className="mt-1 text-[11px] text-slate-500">{t(`help.statusHint.${tk.status ?? 'OPEN'}`)}</Text>
            </Card>
            {tk.replies.map((r) => (
              <View key={r.id} testID={`reply-${r.id}`} className={cn('max-w-[88%] rounded-2xl p-3', r.from_staff ? 'self-start border border-slate-200 bg-white' : 'self-end bg-teal-700')}>
                <Text className={cn('text-[11px] font-bold', r.from_staff ? 'text-teal-700' : 'text-teal-100')}>{r.from_staff ? r.author_name || t('help.pobo') : t('help.you')}</Text>
                <Text className={cn('mt-0.5 text-sm', r.from_staff ? 'text-slate-800' : 'text-white')}>{r.body}</Text>
                <Text className={cn('mt-1 text-[10px]', r.from_staff ? 'text-slate-400' : 'text-teal-200')}>{formatWhen(r.created_at)}</Text>
              </View>
            ))}
            {closed ? (
              <InlineBanner tone="info">{t('help.closedHint')}</InlineBanner>
            ) : (
              <Card>
                <TextField testID="reply-body" label={t('help.reply')} multiline value={body} onChangeText={setBody} maxLength={4000} error={s.apiField('body')} />
                {!online ? <Text className="mb-2 text-[11px] text-amber-700">{t('sync.onlineOnly')}</Text> : null}
                {s.banner(['body']) ? <InlineBanner>{s.banner(['body'])!}</InlineBanner> : null}
                <Button testID="reply-send" label={t('help.send')} loading={s.busy} disabled={!body.trim() || !online} onPress={() => void s.run(undefined)} />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
