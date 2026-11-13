import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, BottomSheet, Button, Card, Chips, EmptyState, ErrorState, InlineBanner, ListSkeleton, TextField, type BadgeTone } from '@/components/ui';
import { useCompleteFieldTask, useFieldTasks, type FieldTask } from '@/api/hooks/field';
import { useMyKeys } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { ReturnKeySheet, TakeKeySheet } from '@/components/listings/UnitSheets';
import { useOnline } from '@/hooks/useOnline';
import { useSubmit } from '@/hooks/useSubmit';
import { useActions } from '@/state/actions';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';

const TONE: Record<string, BadgeTone> = { TENANCY_EXPIRY: 'amber', LISTING_CHANGES: 'rose', SURVEY_REVISIT: 'blue', STRUCTURE_REVIEW: 'slate', KEY_COLLECT: 'teal', KEY_RETURN: 'indigo' };
const isKeyTask = (k: string) => k === 'KEY_COLLECT' || k === 'KEY_RETURN';

function CompleteSheet({ task, dismiss, onClose }: { task: FieldTask; dismiss: boolean; onClose: () => void }) {
  const t = useT();
  const done = useCompleteFieldTask();
  const showToast = useActions((s) => s.showToast);
  const [notes, setNotes] = useState('');
  const s = useSubmit(async () => {
    await done.mutateAsync({ id: task.id, notes: notes.trim() || undefined, dismiss });
    showToast(dismiss ? t('fieldTasks.dismissed') : t('fieldTasks.completed'));
  }, onClose);
  return (
    <BottomSheet visible onClose={onClose} dismissable={!s.busy} title={dismiss ? t('fieldTasks.dismiss') : t('fieldTasks.done')} subtitle={task.title} footer={<Button testID="task-complete-save" className="flex-1" variant={dismiss ? 'secondary' : 'primary'} label={dismiss ? t('fieldTasks.dismiss') : t('fieldTasks.done')} loading={s.busy} onPress={() => void s.run(undefined)} />}>
      <TextField label={t('fieldTasks.notes')} multiline value={notes} onChangeText={setNotes} error={s.apiField('notes')} />
      {s.banner(['notes']) ? <InlineBanner>{s.banner(['notes'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** APP-27 (and other field tasks): tenancy expiry follow-ups, revisits, listing changes, structure reviews. */
export default function FieldTasksScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const online = useOnline();
  const showSuccess = useActions((s) => s.showSuccess);
  const params = useLocalSearchParams<{ kind?: string }>();
  const [status, setStatus] = useState<'OPEN' | 'DONE'>('OPEN');
  const [filter, setFilter] = useState<'all' | 'keys'>(params.kind === 'keys' ? 'keys' : 'all');
  const q = useFieldTasks(status);
  const held = useMyKeys('HELD');
  const [sheet, setSheet] = useState<{ task: FieldTask; dismiss: boolean } | null>(null);
  const [keySheet, setKeySheet] = useState<FieldTask | null>(null);
  // FB-08: urgent ("Owner wants the key back") first, then by due time (server order otherwise).
  const tasks = (q.data ?? []).filter((x) => filter === 'all' || isKeyTask(x.kind)).sort((a, b) => Number(b.priority === 'URGENT') - Number(a.priority === 'URGENT'));
  const keyFor = (task: FieldTask) => (held.data ?? []).find((k) => k.id === task.key_id);
  const keyDone = (task: FieldTask) =>
    showSuccess({ title: task.kind === 'KEY_COLLECT' ? t('keyTasks.collected') : t('keyTasks.returned'), body: online ? undefined : t('unitSurvey.savedLocal'), lines: task.unit_label ? [{ label: t('visits.property'), value: task.unit_label }] : undefined });
  const now = useNow();
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('fieldTasks.screen')} />
      <ScrollView contentContainerClassName="p-4 gap-3 pb-12" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        <Button testID="tasks-floats" size="sm" variant="float" label={t('fieldTasks.floats')} onPress={() => router.push('/more/floats')} />
        <Chips options={[{ value: 'OPEN', label: t('fieldTasks.open') }, { value: 'DONE', label: t('fieldTasks.closed') }]} value={status} allowDeselect={false} onChange={(v) => setStatus(v as 'OPEN' | 'DONE')} />
        <Chips testIDPrefix="tasks-filter" options={[{ value: 'all', label: t('fieldTasks.all') }, { value: 'keys', label: t('keyTasks.filter') }]} value={filter} allowDeselect={false} onChange={(v) => setFilter(v as 'all' | 'keys')} />
        {q.isPending ? (
          <ListSkeleton count={3} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : tasks.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t('fieldTasks.emptyTitle')} body={t('fieldTasks.emptyBody')} />
        ) : (
          tasks.map((task) => {
            const overdue = !!task.due_at && task.status === 'OPEN' && Date.parse(task.due_at) < now;
            const urgent = task.priority === 'URGENT';
            const kc = task.key_context;
            return (
              <Card key={task.id} tone={overdue || urgent ? 'alert' : 'default'} testID={`task-${task.kind}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-row gap-1.5">
                    <Badge label={t(`fieldTasks.kind.${task.kind}`)} tone={TONE[task.kind] ?? 'slate'} />
                    {urgent ? <Badge label={t('keyTasks.urgent')} tone="rose" /> : null}
                  </View>
                  {task.due_at ? <Text className={overdue ? 'text-xs font-bold text-rose-600' : 'text-xs font-semibold text-slate-600'}>{formatWhen(task.due_at)}</Text> : null}
                </View>
                <Text className="mt-2 text-sm font-bold text-slate-900">{task.title}</Text>
                {task.unit_label ? <Text className="text-xs text-slate-500">{task.unit_label}</Text> : null}
                {kc ? (
                  <Text testID={`task-key-context-${task.id}`} className="mt-1 text-xs text-slate-700">
                    {[L.master('KEY_PARTY', kc.key_party), [kc.contact_name, kc.contact_phone].filter(Boolean).join(' · '), kc.collection_location, kc.mode ? L.enumLabel('access_mode', kc.mode) : ''].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {task.notes ? <Text className="mt-1 text-xs text-slate-600">{task.notes}</Text> : null}
                {task.completion_notes ? <Text className="mt-1 text-xs italic text-slate-500">{task.completion_notes}</Text> : null}
                {task.status === 'OPEN' ? (
                  <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
                    {task.unit_id ? (
                      <Button size="sm" variant="secondary" label={t('fieldTasks.openUnit')} onPress={() => router.push({ pathname: '/field/unit/[id]', params: { id: task.unit_id! } })} />
                    ) : task.listing_id ? (
                      <Button testID={`task-open-listing-${task.id}`} size="sm" variant="secondary" label={t('fieldTasks.openProperty')} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: task.listing_id! } })} />
                    ) : null}
                    {task.kind === 'KEY_COLLECT' && (task.unit_id || task.listing_id) ? (
                      <Button testID={`task-collect-${task.id}`} size="sm" className="flex-1" label={t('keyTasks.collect')} onPress={() => setKeySheet(task)} />
                    ) : task.kind === 'KEY_RETURN' && keyFor(task) ? (
                      <Button testID={`task-return-${task.id}`} size="sm" className="flex-1" variant={urgent ? 'danger' : 'primary'} label={t('keyTasks.return')} onPress={() => setKeySheet(task)} />
                    ) : (
                      <Button testID={`task-done-${task.id}`} size="sm" className="flex-1" label={t('fieldTasks.done')} onPress={() => setSheet({ task, dismiss: false })} />
                    )}
                    {isKeyTask(task.kind) ? null : <Button size="sm" variant="ghost" label={t('fieldTasks.dismiss')} onPress={() => setSheet({ task, dismiss: true })} />}
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
      {keySheet?.kind === 'KEY_COLLECT' && (keySheet.unit_id || keySheet.listing_id) ? (
        <TakeKeySheet unitId={keySheet.unit_id} unitLabel={keySheet.unit_label ?? ''} listingId={keySheet.listing_id} parties={L.options('KEY_PARTY')} defaultFrom={keySheet.key_context?.key_party} onClose={() => setKeySheet(null)} onDone={() => keyDone(keySheet)} />
      ) : null}
      {keySheet?.kind === 'KEY_RETURN' && keyFor(keySheet) ? (
        <ReturnKeySheet k={keyFor(keySheet)!} parties={L.options('KEY_PARTY')} onClose={() => setKeySheet(null)} onDone={() => keyDone(keySheet)} />
      ) : null}
      {sheet ? <CompleteSheet task={sheet.task} dismiss={sheet.dismiss} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}
