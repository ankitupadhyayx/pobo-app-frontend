import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Grid3x3, Plus, Wand2 } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { BottomSheet, Button, Chips, EmptyState, ErrorState, InlineBanner, ListSkeleton, TextField } from '@/components/ui';
import { ProgressBars } from '@/components/survey/ProgressBars';
import { MatrixLegend, UnitMatrix } from '@/components/survey/UnitMatrix';
import { GenerateSheet } from '@/components/survey/GenerateSheet';
import { buildRows } from '@/components/survey/towerGrid';
import { useAddUnit, useTower } from '@/api/hooks/field';
import { useLabels } from '@/api/hooks/config';
import { useSubmit } from '@/hooks/useSubmit';
import { useOnline } from '@/hooks/useOnline';
import { useOutbox } from '@/offline';
import { useActions } from '@/state/actions';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

function AddUnitSheet({ towerId, floors, configurations, onClose, onDone }: { towerId: string; floors: { id: string; label: string }[]; configurations: { value: string; label: string }[]; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const add = useAddUnit(towerId);
  const [number, setNumber] = useState('');
  const [floorId, setFloorId] = useState<string | null>(floors[0]?.id ?? null);
  const [config, setConfig] = useState<string | null>(null);
  const [err, setErr] = useState<string>();
  const s = useSubmit(async () => {
    await add.mutateAsync({ number: number.trim(), floor_id: floorId, configuration: config ?? undefined });
    onDone();
  }, onClose);
  return (
    <BottomSheet
      testID="add-unit-sheet"
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={t('tower.addUnit')}
      footer={<Button testID="add-unit-save" className="flex-1" label={t('tower.addUnit')} loading={s.busy} onPress={() => (number.trim() ? void s.run(undefined) : setErr(t('errors.required')))} />}
    >
      <TextField label={t('tower.unitNumber')} required value={number} onChangeText={(v) => { setNumber(v); setErr(undefined); }} error={err ?? s.apiField('number')} />
      {floors.length ? <Chips scroll label={t('tower.floor')} options={floors.map((f) => ({ value: f.id, label: f.label }))} value={floorId} allowDeselect={false} onChange={(v) => setFloorId(v as string)} error={s.apiField('floor_id', 'floor_label')} /> : null}
      <Chips label={t('unitSurvey.configuration')} options={configurations} value={config} onChange={(v) => setConfig(v as string | null)} />
      {s.banner(['number', 'floor_id', 'floor_label', 'configuration']) ? <InlineBanner>{s.banner(['number', 'floor_id', 'floor_label', 'configuration'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** APP-21/22: tower matrix colour-coded by DEC-01 layer; generate structure; tap a flat to survey. */
export default function TowerScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const online = useOnline();
  const sync = useOutbox();
  const showToast = useActions((s) => s.showToast);
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useTower(id);
  const [sheet, setSheet] = useState<null | 'generate' | 'unit'>(null);
  const tw = q.data;
  const rows = useMemo(() => (tw ? buildRows(tw, sync.byEntity) : []), [tw, sync.byEntity]);

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={tw ? `${tw.society_name} · ${tw.name}` : t('common.loading')} />
      <ScrollView contentContainerClassName="p-4 pb-28 gap-3" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : !tw ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            {tw.duplicate_status === 'FLAGGED' ? (
              <InlineBanner tone="warn">
                <View className="flex-row items-center gap-1.5">
                  <AlertTriangle size={14} color={colors.warn} />
                  <Text className="flex-1 text-xs font-semibold text-amber-900">{t('mapping.flagged', { name: tw.possible_duplicate_of_name ?? '?' })}</Text>
                </View>
              </InlineBanner>
            ) : null}
            <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <ProgressBars mapped={tw.progress.units_mapped} expected={tw.progress.approx_units} surveyed={tw.progress.units_surveyed} />
              <MatrixLegend />
            </View>
            {rows.length === 0 ? (
              <EmptyState icon={Grid3x3} title={t('tower.emptyTitle')} body={t('tower.emptyBody')} action={tw.can_edit ? { label: t('tower.generate'), onPress: () => setSheet('generate') } : undefined} />
            ) : (
              <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                <Text className="text-[11px] font-semibold text-slate-500">{t('tower.tapHint')}</Text>
                <UnitMatrix floors={rows} onPress={(u) => router.push({ pathname: '/field/unit/[id]', params: { id: u.id } })} />
              </View>
            )}
          </>
        )}
      </ScrollView>
      {tw?.can_edit ? (
        <View className="absolute bottom-0 left-0 right-0 flex-row gap-2 border-t border-slate-200 bg-white px-4 pb-6 pt-3">
          <Button testID="tower-generate" className="flex-1" size="lg" icon={Wand2} label={t('tower.generate')} disabled={!online} onPress={() => setSheet('generate')} />
          <Button testID="tower-add-unit" size="lg" variant="outline" icon={Plus} label={t('tower.unit')} disabled={!online} onPress={() => setSheet('unit')} />
        </View>
      ) : null}
      {sheet === 'generate' && tw ? (
        <GenerateSheet
          towerId={tw.id}
          towerName={tw.name}
          defaults={{ topFloor: tw.floors_count, perFloor: tw.units_per_floor, ground: tw.has_ground_floor_units, pattern: tw.numbering_pattern }}
          configurations={L.options('CONFIGURATION')}
          onClose={() => setSheet(null)}
          onDone={showToast}
        />
      ) : null}
      {sheet === 'unit' && tw ? (
        <AddUnitSheet
          towerId={tw.id}
          floors={[...tw.floors].sort((a, b) => b.number - a.number).map((f) => ({ id: f.id, label: f.label || String(f.number) }))}
          configurations={L.options('CONFIGURATION')}
          onClose={() => setSheet(null)}
          onDone={() => showToast(t('tower.unitAdded'))}
        />
      ) : null}
    </View>
  );
}
