import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Building, ChevronRight, Plus } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { BottomSheet, Button, Checkbox, EmptyState, ErrorState, InlineBanner, ListSkeleton, TextField } from '@/components/ui';
import { ProgressBars } from '@/components/survey/ProgressBars';
import { useAddTower, useMappingSociety } from '@/api/hooks/field';
import { useSubmit } from '@/hooks/useSubmit';
import { useOnline } from '@/hooks/useOnline';
import { useActions } from '@/state/actions';
import { findDuplicateNames } from '@/lib/mapping';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

function AddTowerSheet({ societyId, existing, onClose, onCreated }: { societyId: string; existing: string[]; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT();
  const add = useAddTower(societyId);
  const [name, setName] = useState('');
  const [floors, setFloors] = useState('');
  const [perFloor, setPerFloor] = useState('');
  const [groundUnits, setGroundUnits] = useState(false);
  const [basement, setBasement] = useState('');
  const [err, setErr] = useState<string>();
  const s = useSubmit(async () => {
    const tw = await add.mutateAsync({
      name: name.trim(),
      floors_count: floors ? Number(floors) : null,
      units_per_floor: perFloor ? Number(perFloor) : null,
      has_ground_floor_units: groundUnits,
      basement_notes: basement.trim() || undefined,
    });
    onCreated(tw.id);
  }, onClose);
  const dup = name.trim() ? findDuplicateNames([...existing, name.trim()]).find((g) => g.includes(name.trim()) && g.length > 1) : undefined;
  return (
    <BottomSheet
      testID="add-tower-sheet"
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={t('mapping.addTower')}
      footer={<Button testID="add-tower-save" className="flex-1" label={t('mapping.addTower')} loading={s.busy} onPress={() => (name.trim() ? void s.run(undefined) : setErr(t('errors.required')))} />}
    >
      <TextField testID="tower-name" label={t('mapping.towerName')} required placeholder="Tower 2 / Block A" value={name} onChangeText={(v) => { setName(v); setErr(undefined); }} error={err ?? s.apiField('name')} />
      {dup ? <InlineBanner tone="warn">{t('mapping.dupWarning', { names: dup.filter((n) => n !== name.trim()).join(', ') })}</InlineBanner> : null}
      <View className="flex-row gap-2">
        <TextField containerClassName="flex-1" label={t('mapping.floorsCount')} hint={t('mapping.floorsCountHint')} keyboardType="number-pad" value={floors} onChangeText={(v) => setFloors(v.replace(/\D/g, ''))} error={s.apiField('floors_count')} />
        <TextField containerClassName="flex-1" label={t('mapping.unitsPerFloor')} hint={t('mapping.unitsPerFloorHint')} keyboardType="number-pad" value={perFloor} onChangeText={(v) => setPerFloor(v.replace(/\D/g, ''))} error={s.apiField('units_per_floor')} />
      </View>
      <Checkbox testID="tower-ground" checked={groundUnits} onChange={setGroundUnits} label={t('mapping.groundUnits')} hint={t('mapping.groundUnitsHint')} />
      <TextField label={t('mapping.basementNotes')} value={basement} onChangeText={setBasement} />
      {s.banner(['name', 'floors_count', 'units_per_floor']) ? <InlineBanner>{s.banner(['name', 'floors_count', 'units_per_floor'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** Society → towers. Mapping progress and survey coverage stay separate (PHASE2 governance). */
export default function SocietyScreen() {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const showToast = useActions((s) => s.showToast);
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMappingSociety(id);
  const [adding, setAdding] = useState(false);
  const s = q.data;
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={s?.name ?? t('common.loading')} />
      <ScrollView contentContainerClassName="p-4 pb-28 gap-3" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={3} />
        ) : !s ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-xs text-slate-500">
                {s.locality}
                {s.developer ? ` · ${s.developer}` : ''}
              </Text>
              <ProgressBars mapped={s.progress.units_mapped} expected={s.progress.approx_units} surveyed={s.progress.units_surveyed} />
            </View>
            <Text className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t('mapping.towersTitle', { count: s.towers.length })}</Text>
            {s.towers.length === 0 ? (
              <EmptyState icon={Building} title={t('mapping.noTowersTitle')} body={t('mapping.noTowersBody')} action={{ label: t('mapping.addTower'), onPress: () => setAdding(true) }} />
            ) : (
              s.towers.map((tw) => (
                <Pressable
                  key={tw.id}
                  testID={`tower-${tw.name}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/field/tower/[id]', params: { id: tw.id } })}
                  className="gap-2 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-slate-900">{tw.name}</Text>
                    <ChevronRight size={16} color={colors.slate400} />
                  </View>
                  {tw.duplicate_status === 'FLAGGED' ? (
                    <View className="flex-row items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1">
                      <AlertTriangle size={12} color={colors.warn} />
                      <Text className="flex-1 text-[11px] font-semibold text-amber-900">{t('mapping.flagged', { name: tw.possible_duplicate_of_name ?? '?' })}</Text>
                    </View>
                  ) : null}
                  <Text className="text-[11px] text-slate-600">
                    {tw.units_mapped ? t('mapping.towerStats', { mapped: tw.units_mapped, surveyed: tw.units_surveyed }) : t('mapping.notMapped')}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
      {s ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 pb-6 pt-3">
          <Button testID="add-tower" size="lg" fullWidth icon={Plus} label={t('mapping.addTower')} disabled={!online} onPress={() => setAdding(true)} />
        </View>
      ) : null}
      {adding && s ? (
        <AddTowerSheet
          societyId={s.id}
          existing={s.towers.map((x) => x.name)}
          onClose={() => setAdding(false)}
          onCreated={(tid) => {
            showToast(t('mapping.towerAdded'));
            router.push({ pathname: '/field/tower/[id]', params: { id: tid } });
          }}
        />
      ) : null}
    </View>
  );
}
