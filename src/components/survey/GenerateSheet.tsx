import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BottomSheet, Button, Checkbox, Chips, InlineBanner, TextField, type Option } from '@/components/ui';
import { DEFAULT_PATTERN, floorLabels, previewUnits } from '@/lib/mapping';
import { useGenerate } from '@/api/hooks/field';
import { useSubmit } from '@/hooks/useSubmit';
import { useT } from '@/i18n';

/** APP-22 bulk-generate floors + flats with a live preview of exactly what will be created. */
export function GenerateSheet({ towerId, towerName, defaults, configurations, onClose, onDone }: {
  towerId: string;
  towerName: string;
  defaults: { topFloor?: number | null; perFloor?: number | null; ground?: boolean; pattern?: string };
  configurations: Option[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const t = useT();
  const gen = useGenerate(towerId);
  const [lg, setLg] = useState(false);
  const [ug, setUg] = useState(false);
  const [ground, setGround] = useState(!!defaults.ground);
  const [top, setTop] = useState(defaults.topFloor ? String(defaults.topFloor) : '');
  const [skip, setSkip] = useState('');
  const [rename13, setRename13] = useState(false);
  const [perFloor, setPerFloor] = useState(defaults.perFloor ? String(defaults.perFloor) : '4');
  const [pattern, setPattern] = useState(defaults.pattern || DEFAULT_PATTERN);
  const [config, setConfig] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  const skipList = skip.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);
  const labels = useMemo(
    () => floorLabels({ lowerGround: lg, upperGround: ug, ground, topFloor: Number(top) || 0, skip: rename13 ? [...skipList, 13] : skipList, rename: rename13 ? { 13: '12A' } : {} }),
    [lg, ug, ground, top, skip, rename13], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const preview = useMemo(() => previewUnits(labels, Number(perFloor) || 0, pattern, towerName), [labels, perFloor, pattern, towerName]);
  const total = preview.reduce((n, f) => n + f.units.length, 0);

  const s = useSubmit(async () => {
    const r = await gen.mutateAsync({ floor_labels: labels, units_per_floor: Number(perFloor), numbering_pattern: pattern, configuration: config ?? undefined });
    onDone(t('generate.result', { created: r.units_created, skipped: r.units_skipped, floors: r.floors_created }));
  }, onClose);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!labels.length) e.top = t('generate.needFloors');
    if (!Number(perFloor) || Number(perFloor) > 50) e.perFloor = t('generate.perFloorRange');
    if (!pattern.includes('{unit') && !pattern.includes('{letter}')) e.pattern = t('generate.patternNeedsUnit');
    setErr(e);
    if (!Object.keys(e).length) void s.run(undefined);
  };

  return (
    <BottomSheet
      testID="generate-sheet"
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={t('generate.title', { tower: towerName })}
      subtitle={t('generate.subtitle')}
      footer={<Button testID="generate-save" className="flex-1" label={t('generate.create', { count: total })} loading={s.busy} onPress={submit} />}
    >
      {/* FB-12: the floor-plan boxes, in plain words with what each one changes. */}
      <View className="gap-2">
        <Text className="text-xs font-bold text-slate-700">{t('generate.lowFloorsTitle')}</Text>
        <Text className="text-[11px] text-slate-500">{t('generate.lowFloorsHelp')}</Text>
        <Checkbox testID="gen-ground" checked={ground} onChange={setGround} label={t('generate.ground')} hint={t('generate.groundHint')} />
        <Checkbox testID="gen-ug" checked={ug} onChange={setUg} label={t('generate.upperGround')} hint={t('generate.upperGroundHint')} />
        <Checkbox testID="gen-lg" checked={lg} onChange={setLg} label={t('generate.lowerGround')} hint={t('generate.lowerGroundHint')} />
      </View>
      <View className="flex-row gap-2">
        <TextField testID="gen-top" containerClassName="flex-1" label={t('generate.topFloor')} hint={t('generate.topFloorHint')} keyboardType="number-pad" value={top} onChangeText={(v) => setTop(v.replace(/\D/g, ''))} error={err.top} />
        <TextField testID="gen-per-floor" containerClassName="flex-1" label={t('mapping.unitsPerFloor')} keyboardType="number-pad" value={perFloor} onChangeText={(v) => setPerFloor(v.replace(/\D/g, ''))} error={err.perFloor ?? s.apiField('units_per_floor')} />
      </View>
      <TextField label={t('generate.skip')} placeholder="e.g. 4, 14" value={skip} onChangeText={setSkip} hint={t('generate.skipHint')} />
      <Checkbox checked={rename13} onChange={setRename13} label={t('generate.rename13')} hint={t('generate.rename13Hint')} />
      <TextField label={t('generate.pattern')} value={pattern} onChangeText={setPattern} autoCapitalize="none" hint={t('generate.patternHint')} error={err.pattern ?? s.apiField('numbering_pattern')} />
      <Chips label={t('generate.configuration')} options={configurations} value={config} onChange={(v) => setConfig(v as string | null)} />
      <View className="gap-1.5 rounded-xl bg-slate-50 p-3">
        <Text className="text-xs font-bold text-slate-700">{t('generate.preview', { floors: labels.length, units: total })}</Text>
        <ScrollView className="max-h-40" nestedScrollEnabled>
          {[...preview].reverse().slice(0, 40).map((f) => (
            <Text key={f.floor} className="text-[11px] text-slate-600" numberOfLines={1}>
              <Text className="font-bold">{f.floor}</Text>: {f.units.join('  ')}
            </Text>
          ))}
        </ScrollView>
        <Text className="text-[10px] text-slate-500">{t('generate.idempotent')}</Text>
      </View>
      {s.banner(['floor_labels', 'units_per_floor', 'numbering_pattern']) ? <InlineBanner>{s.banner(['floor_labels', 'units_per_floor', 'numbering_pattern'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}
