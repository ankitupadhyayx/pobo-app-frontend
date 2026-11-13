import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building, Building2, Home } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Button, Chips, InlineBanner, LocationField, MoneyField, NotSure, TextField, toggleIn } from '@/components/ui';
import { LocalityPicker, emptyLocality, type LocalityValue } from '@/components/leadForm/LocalityPicker';
import { emptyLocation, toLocationInput, type LocationValue } from '@/lib/location';
import { SocietyPicker, type PickedSociety } from '@/components/leadForm/SocietyPicker';
import { useAddRequirementProperty } from '@/api/hooks/listings';
import { useMappingSociety, useTower } from '@/api/hooks/field';
import { useRequirement } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { errorMessage, ApiError } from '@/api/errors';
import { useOnline } from '@/hooks/useOnline';
import { FieldAnchor, FormScrollView, useFormFocus } from '@/hooks/useFormFocus';
import { useActions } from '@/state/actions';
import { analytics } from '@/lib/analytics';
import { formatINR } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { placeTitle } from '@/lib/property';
import { useT } from '@/i18n';

/** R2-2: where the property is. Never assume a mapped flat. */
export type PropertySource = 'MAPPED' | 'SOCIETY' | 'INDEPENDENT';
const digits = (v: string) => v.replace(/\D/g, '');

/**
 * FB-03 / R2-2 Add Property on a SELL / RENT OUT requirement. Step 1 asks "Where is this
 * property?": an existing mapped flat (Society → Tower → Floor → Flat), a society flat that isn't
 * mapped yet (pick society, type tower/floor/flat; Ops verifies) or an independent property.
 * Step 2: specs and price/rent. Photos are added on the property screen right after.
 */
export default function AddPropertyScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const L = useLabels();
  const online = useOnline();
  const showSuccess = useActions((s) => s.showSuccess);
  const form = useFormFocus();
  const { rid, relationshipId } = useLocalSearchParams<{ rid: string; relationshipId?: string }>();
  const req = useRequirement(rid);
  const r = req.data;
  const add = useAddRequirementProperty(rid, relationshipId);

  const [source, setSource] = useState<PropertySource | null>(null);
  // The requirement's society is a starting suggestion only; the AA can change it.
  const [pickedSociety, setPickedSociety] = useState<PickedSociety | null | undefined>(undefined);
  const society: PickedSociety | null = pickedSociety === undefined ? (r?.society ? { id: r.society.id, name: r.society.name } : null) : pickedSociety;
  const mapping = useMappingSociety(source === 'MAPPED' ? society?.id ?? '' : '');
  const towers = mapping.data?.towers ?? [];
  const [towerId, setTowerId] = useState<string | null>(null);
  const tower = useTower(source === 'MAPPED' ? towerId ?? '' : '');
  const [floorId, setFloorId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [towerName, setTowerName] = useState('');
  const [floor, setFloor] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  // R2-2 independent property: kind + sector + full address (RV2-A).
  const [kind, setKind] = useState<string | null>(null);
  const [indLocality, setIndLocality] = useState<LocalityValue | null>(null);
  const [indLocation, setIndLocation] = useState<LocationValue>(emptyLocation());
  const reqLocality: LocalityValue = r?.locality ? { items: [{ id: r.locality.id, name: r.locality.name }], other: '' } : emptyLocality();
  const locality = indLocality ?? reqLocality;

  const [config, setConfig] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [superArea, setSuperArea] = useState('');
  const [carpet, setCarpet] = useState('');
  const [furnishing, setFurnishing] = useState<string | null>(null);
  const [facing, setFacing] = useState<string | null>(null);
  const [unsure, setUnsure] = useState<Set<string>>(new Set());
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const isSell = r?.type === 'SELL';
  const cfg = config ?? r?.configuration ?? null;

  const floors = useMemo(() => {
    const tw = tower.data;
    if (!tw) return [];
    const used = new Set(tw.units.map((u) => u.floor_id).filter(Boolean));
    return [...tw.floors].filter((f) => used.has(f.id)).sort((a, b) => a.number - b.number).map((f) => ({ value: f.id, label: f.label || String(f.number) }));
  }, [tower.data]);
  const units = useMemo(() => {
    const tw = tower.data;
    if (!tw) return [];
    return tw.units
      .filter((u) => !floors.length || !floorId || u.floor_id === floorId)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
      .map((u) => ({ value: u.id, label: u.number }));
  }, [tower.data, floors.length, floorId]);

  const flatText =
    source === 'MAPPED' ? (units.find((u) => u.value === unitId)?.label ?? '') : source === 'SOCIETY' ? [towerName.trim(), unitLabel.trim()].filter(Boolean).join('-') : '';

  const pickSource = (s: PropertySource) => {
    setSource(s);
    setErrs({});
    setBanner(null);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!source) e.source = t('addProperty.sourceRequired');
    if (source === 'MAPPED') {
      if (!society) e.society = t('addProperty.pickSociety');
      else if (!unitId) e.unit = t('addProperty.pickFlat');
    }
    if (source === 'SOCIETY') {
      if (!society) e.society = t('addProperty.pickSociety');
      if (!towerName.trim()) e.tower = t('errors.required');
      if (!unitLabel.trim()) e.unitLabel = t('errors.required');
    }
    if (source === 'INDEPENDENT') {
      if (!kind) e.kind = t('addProperty.kindRequired');
      if (!indLocation.addressText.trim()) e.address = t('addProperty.addressRequired');
    }
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrs(e);
    setBanner(null);
    if (Object.keys(e).length) {
      form.fail(e);
      return;
    }
    if (!r) return;
    form.clear();
    try {
      const l = await add.mutateAsync({
        ...(source === 'MAPPED'
          ? { unit_id: unitId }
          : source === 'INDEPENDENT'
            ? {
                independent: {
                  property_kind: kind as 'INDEPENDENT_HOUSE',
                  ...(locality.items[0] ? { locality_id: locality.items[0].id } : locality.other.trim() ? { locality_other: locality.other.trim() } : {}),
                  ...toLocationInput(indLocation),
                },
              }
            : { new_unit: { society_id: society?.id ?? null, tower_name: towerName.trim(), floor_label: floor.trim() || undefined, unit_label: unitLabel.trim(), configuration: cfg ?? undefined } }),
        configuration: cfg ?? undefined,
        expected_price: isSell && price ? Number(price) : undefined,
        expected_rent: !isSell && rent ? Number(rent) : undefined,
        security_deposit: !isSell && deposit ? Number(deposit) : undefined,
        super_area_sqft: superArea ? Number(superArea) : undefined,
        carpet_area_sqft: carpet ? Number(carpet) : undefined,
        furnishing: furnishing ?? undefined,
        facing: facing ?? undefined,
        unsure_fields: [...unsure].map((field) => ({ field })),
      });
      analytics.track('property_added', { kind: r.type, source: source ?? '' });
      router.back();
      showSuccess({
        title: t('addProperty.doneTitle'),
        body: t('addProperty.doneBody'),
        lines: [
          { label: t('visits.property'), value: placeTitle(l, (c) => L.enumLabel('property_kind', c)) },
          ...(l.expected_price ? [{ label: t('addLead.expectedPrice'), value: formatINR(l.expected_price) }] : []),
          ...(l.expected_rent ? [{ label: t('addLead.expectedRent'), value: `${formatINR(l.expected_rent)}/mo` }] : []),
        ],
        actions: [{ label: t('addProperty.addPhotos'), testID: 'success-add-photos', onPress: () => router.push({ pathname: '/listing/[id]', params: { id: l.id } }) }],
      });
    } catch (err) {
      const next: Record<string, string> = {};
      if (err instanceof ApiError && err.hasFieldErrors()) {
        const f = err.fields;
        if (f.unit_id) next.unit = f.unit_id;
        if (f['new_unit.tower_name']) next.tower = f['new_unit.tower_name'];
        if (f['new_unit.unit_label']) next.unitLabel = f['new_unit.unit_label'];
        if (f.new_unit || f['new_unit.society_id']) next.society = err.message;
        if (f['independent.property_kind']) next.kind = f['independent.property_kind'];
        if (f['independent.address_text'] || f['independent.location_input']) next.address = f['independent.address_text'] ?? f['independent.location_input'];
        if (f['independent.locality_id'] || f['independent.locality_other']) next.locality = f['independent.locality_id'] ?? f['independent.locality_other'];
        if (f.expected_price) next.price = f.expected_price;
        if (f.expected_rent) next.rent = f.expected_rent;
      }
      setErrs(next);
      setBanner(errorMessage(err));
      form.fail(Object.keys(next).length ? next : { banner: errorMessage(err) }, errorMessage(err));
    }
  };

  const fact = (field: string) => <NotSure field={field} on={unsure.has(field)} onToggle={(on) => setUnsure((s) => toggleIn(s, field, on))} />;
  const sources: { key: PropertySource; icon: typeof Home; title: string; body: string }[] = [
    { key: 'MAPPED', icon: Building2, title: t('addProperty.srcMapped'), body: t('addProperty.srcMappedBody') },
    { key: 'SOCIETY', icon: Building, title: t('addProperty.srcSociety'), body: t('addProperty.srcSocietyBody') },
    { key: 'INDEPENDENT', icon: Home, title: t('addProperty.srcIndependent'), body: t('addProperty.srcIndependentBody') },
  ];

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('addProperty.title')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <FormScrollView form={form} innerClassName="gap-3" keyboardShouldPersistTaps="handled" contentContainerClassName="p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
            {r ? <Text className="px-1 text-xs text-slate-600">{t('addProperty.for', { title: r.title })}</Text> : null}

            <FieldAnchor form={form} name="source">
              <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('addProperty.stepWhere')}</Text>
                {sources.map((o) => {
                  const on = source === o.key;
                  const Icon = o.icon;
                  return (
                    <Pressable
                      key={o.key}
                      testID={`source-${o.key}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => pickSource(o.key)}
                      className={cn('flex-row items-start gap-3 rounded-xl border p-3', on ? 'border-teal-500 bg-teal-50' : errs.source ? 'border-rose-300' : 'border-slate-200')}
                    >
                      <Icon size={18} color={on ? colors.brandDark : colors.muted} />
                      <View className="flex-1">
                        <Text className={cn('text-sm font-bold', on ? 'text-teal-900' : 'text-slate-900')}>{o.title}</Text>
                        <Text className="text-[11px] text-slate-500">{o.body}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {errs.source ? <Text className="text-xs font-semibold text-rose-600">{errs.source}</Text> : null}
              </View>
            </FieldAnchor>

            {source === 'MAPPED' || source === 'SOCIETY' ? (
              <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{source === 'MAPPED' ? t('addProperty.stepFlat') : t('addProperty.stepNewFlat')}</Text>
                <FieldAnchor form={form} name="society">
                  <SocietyPicker
                    value={society}
                    required
                    error={errs.society || undefined}
                    onChange={(s) => {
                      setPickedSociety(s);
                      setTowerId(null);
                      setFloorId(null);
                      setUnitId(null);
                    }}
                  />
                </FieldAnchor>
                {source === 'MAPPED' && society ? (
                  mapping.isPending ? null : towers.length === 0 ? (
                    <View className="gap-2">
                      <Text className="text-xs text-slate-600">{t('addProperty.noTowers')}</Text>
                      <Button testID="switch-to-society" size="sm" variant="secondary" label={t('addProperty.srcSociety')} onPress={() => pickSource('SOCIETY')} />
                    </View>
                  ) : (
                    <FieldAnchor form={form} name="unit">
                      <View className="gap-3">
                        <Chips
                          scroll
                          testIDPrefix="pick-tower"
                          label={t('addProperty.tower')}
                          options={towers.map((tw) => ({ value: tw.id, label: tw.name }))}
                          value={towerId}
                          onChange={(v) => {
                            setTowerId(v as string | null);
                            setFloorId(null);
                            setUnitId(null);
                          }}
                        />
                        {towerId && floors.length > 1 ? (
                          <Chips
                            scroll
                            testIDPrefix="pick-floor"
                            label={t('addProperty.floorLabel')}
                            options={floors}
                            value={floorId}
                            onChange={(v) => {
                              setFloorId(v as string | null);
                              setUnitId(null);
                            }}
                          />
                        ) : null}
                        {towerId ? (
                          units.length ? (
                            <Chips testIDPrefix="pick-unit" label={t('addProperty.flat')} required options={units} value={unitId} onChange={(v) => setUnitId(v as string | null)} error={errs.unit || undefined} />
                          ) : tower.isPending ? null : (
                            <Text className="text-xs text-slate-500">{t('addProperty.noFlats')}</Text>
                          )
                        ) : errs.unit ? (
                          <Text className="text-xs font-semibold text-rose-600">{errs.unit}</Text>
                        ) : null}
                      </View>
                    </FieldAnchor>
                  )
                ) : null}
                {source === 'SOCIETY' ? (
                  <>
                    <FieldAnchor form={form} name="tower">
                      <TextField testID="qa-tower" label={t('addProperty.towerName')} required placeholder="Tower 2 / Block A" value={towerName} onChangeText={setTowerName} error={errs.tower || undefined} />
                    </FieldAnchor>
                    <FieldAnchor form={form} name="unitLabel">
                      <View className="flex-row gap-2">
                        <TextField testID="qa-floor" containerClassName="flex-1" label={t('addProperty.floorLabel')} placeholder="12 / G / UG" value={floor} onChangeText={setFloor} />
                        <TextField testID="qa-unit" containerClassName="flex-1" label={t('addProperty.unitLabel')} required placeholder="1204" value={unitLabel} onChangeText={setUnitLabel} error={errs.unitLabel || undefined} />
                      </View>
                    </FieldAnchor>
                    <Text className="text-[11px] text-slate-500">{t('addProperty.quickHint')}</Text>
                  </>
                ) : null}
              </View>
            ) : null}

            {source === 'INDEPENDENT' ? (
              <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('addProperty.stepIndependent')}</Text>
                <FieldAnchor form={form} name="kind">
                  <Chips testIDPrefix="kind" label={t('addProperty.kind')} required options={L.enumOptions('property_kind').filter((o) => o.value !== 'FLAT')} value={kind} onChange={(v) => setKind(v as string | null)} error={errs.kind || undefined} />
                </FieldAnchor>
                <FieldAnchor form={form} name="locality">
                  <LocalityPicker testID="ind-locality" label={t('addLead.propertySector')} value={locality} onChange={setIndLocality} error={errs.locality || undefined} />
                </FieldAnchor>
                <FieldAnchor form={form} name="address">
                  <LocationField testID="ind-location" required value={indLocation} onChange={setIndLocation} areaHint={[locality.items[0]?.name, 'Noida'].filter(Boolean).join(', ')} error={errs.address || undefined} />
                </FieldAnchor>
              </View>
            ) : null}

            {source ? (
              <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('addProperty.stepDetails')}</Text>
                <View className="gap-1">
                  <Chips label={t('unitSurvey.configuration')} options={L.options('CONFIGURATION')} value={cfg} onChange={(v) => setConfig(v as string | null)} />
                  {fact('configuration')}
                </View>
                {isSell ? (
                  <FieldAnchor form={form} name="price">
                    <MoneyField testID="qa-price" label={t('addLead.expectedPrice')} value={price} onChangeText={setPrice} error={errs.price || undefined} />
                  </FieldAnchor>
                ) : (
                  <FieldAnchor form={form} name="rent">
                    <View className="flex-row gap-2">
                      <MoneyField testID="qa-rent" containerClassName="flex-1" label={t('addLead.expectedRent')} value={rent} onChangeText={setRent} error={errs.rent || undefined} />
                      <MoneyField containerClassName="flex-1" label={t('listings.deposit')} value={deposit} onChangeText={setDeposit} />
                    </View>
                  </FieldAnchor>
                )}
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <TextField label={t('unitDetails.superArea')} keyboardType="number-pad" value={superArea} onChangeText={(v) => setSuperArea(digits(v))} />
                    {fact('super_area_sqft')}
                  </View>
                  <View className="flex-1 gap-1">
                    <TextField label={t('unitDetails.carpetArea')} keyboardType="number-pad" value={carpet} onChangeText={(v) => setCarpet(digits(v))} />
                    {fact('carpet_area_sqft')}
                  </View>
                </View>
                <View className="gap-1">
                  <Chips label={t('unitDetails.furnishing')} options={L.options('FURNISHING')} value={furnishing} onChange={(v) => setFurnishing(v as string | null)} />
                  {fact('furnishing')}
                </View>
                <View className="gap-1">
                  <Chips label={t('unitDetails.facing')} options={L.options('FACING')} value={facing} onChange={(v) => setFacing(v as string | null)} />
                  {fact('facing')}
                </View>
                <Text className="text-[11px] text-slate-500">{t('notSure.hint')}</Text>
              </View>
            ) : null}
            {banner ? (
              <FieldAnchor form={form} name="banner">
                <InlineBanner testID="add-property-error">{banner}</InlineBanner>
              </FieldAnchor>
            ) : null}
        </FormScrollView>
      </KeyboardAvoidingView>
      <View className="absolute bottom-0 left-0 right-0 gap-1 border-t border-slate-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button testID="add-property-save" size="lg" label={flatText ? t('addProperty.saveFlat', { flat: flatText }) : t('addProperty.save')} disabled={!online || !r} loading={add.isPending} onPress={save} />
        {!online ? <Text className="text-center text-[11px] text-slate-500">{t('addProperty.needOnline')}</Text> : <Text className="text-center text-[11px] text-slate-500">{t('addProperty.photosNext')}</Text>}
      </View>
    </View>
  );
}
