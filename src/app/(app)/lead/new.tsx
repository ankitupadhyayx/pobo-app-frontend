import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowRight, FilePen, UserPlus } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Button, Checkbox, Chips, InlineBanner, TextField } from '@/components/ui';
import { RequirementFields } from '@/components/leadForm/RequirementFields';
import { SocietyField } from '@/components/leadForm/SocietyField';
import { AssignmentResult, type AssignmentRow } from '@/components/leadForm/AssignmentResult';
import { API_TO_DRAFT, draftToInput, emptyDraft, onlyMissing, validateDraft, type RequirementDraft } from '@/components/leadForm/types';
import { useAddLead, useAddRequirements, useDuplicateReview, useLookup } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { ApiError, errorMessage } from '@/api/errors';
import { toE164 } from '@/api/keys';
import type { ContactInput, ContactRole, LookupResponse, Requirement, RequirementInput } from '@/api/types';
import { useActions } from '@/state/actions';
import { FieldAnchor, FormScrollView, useFormFocus } from '@/hooks/useFormFocus';
import { useOnline } from '@/hooks/useOnline';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** APP-11 Add Lead: one customer, one or more requirement cards, optional secondary contact. */
export default function AddLeadScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const L = useLabels();
  const online = useOnline();
  const showToast = useActions((s) => s.showToast);
  const form = useFormFocus();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RequirementDraft>>({});
  const [withSecondary, setWithSecondary] = useState(false);
  const [sec, setSec] = useState({ name: '', phone: '', role: 'SPOUSE' as ContactRole, address: '' });
  const [coordinate, setCoordinate] = useState<'CUSTOMER' | 'SECONDARY'>('CUSTOMER');
  const [source, setSource] = useState<string | null>('AA_DIRECT');
  const [notes, setNotes] = useState('');
  const [callback, setCallback] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  // After submit: show who got each requirement and why before opening the lead (prototype parity).
  const [done, setDone] = useState<{ relationshipId: string; existing: boolean; rows: AssignmentRow[] } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [reqErrs, setReqErrs] = useState<Record<string, Record<string, string>>>({});
  const [dup, setDup] = useState<LookupResponse | null>(null);
  const [submitErr, setSubmitErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  /** R3-2: the last save stopped only on missing required requirement fields → offer "Save as draft". */
  const [canDraft, setCanDraft] = useState(false);

  const lookup = useLookup();
  const addLead = useAddLead();
  const addReqs = useAddRequirements();
  const dupReview = useDuplicateReview();

  const typeOptions = L.enumOptions('requirement_type', ['BUY', 'SELL', 'RENT', 'RENT_OUT']);
  const roleOptions = L.enumOptions('contact_role').filter((o) => o.value !== 'SELF');
  const sourceOptions = L.options('LEAD_SOURCE').filter((o) => o.value !== 'WEBSITE' && o.value !== 'REFERRAL');

  const onPhoneBlur = async () => {
    setDup(null);
    if (!PHONE_RE.test(phone)) return;
    try {
      const r = await lookup.mutateAsync(phone);
      setDup(r.exists ? r : null);
    } catch {
      /* lookup is advisory; submit still resolves identity server-side */
    }
  };

  const onTypes = (next: string[]) => {
    setTypes(next);
    setErrs((e) => ({ ...e, types: '' }));
    setDrafts((d) => Object.fromEntries(next.map((ty) => [ty, d[ty] ?? emptyDraft(ty)])));
  };

  const apiErr = submitErr instanceof ApiError ? submitErr : null;
  const field = (k: string) => errs[k] || apiErr?.fields[k];
  const reqApiErr = (idx: number, f: string) => {
    if (!apiErr) return undefined;
    for (const [k, v] of Object.entries(apiErr.fields)) {
      const m = /^requirements\.(\d+)\.(\w+)$/.exec(k);
      if (m && Number(m[1]) === idx && API_TO_DRAFT[m[2]] === f) return v;
    }
    return undefined;
  };

  const contacts = useMemo((): ContactInput[] => {
    if (!withSecondary || !sec.name.trim()) return [];
    return [
      {
        name: sec.name.trim(),
        phone: sec.phone ? toE164(sec.phone) : undefined,
        role: sec.role,
        priority: coordinate === 'SECONDARY' ? 'PRIMARY' : 'SECONDARY',
        address: sec.address.trim() || undefined,
      },
    ];
  }, [withSecondary, sec, coordinate]);

  const submit = async (asDraft = false) => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('errors.required');
    if (!PHONE_RE.test(phone)) e.phone = t('errors.phone');
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = t('errors.email');
    if (!types.length) e.types = t('addLead.intentRequired');
    if (withSecondary && !sec.name.trim()) e['secondary.name'] = t('errors.required');
    if (withSecondary && sec.phone && !PHONE_RE.test(sec.phone)) e['secondary.phone'] = t('errors.phone');
    if (!consent) e.consent = t('addLead.consentRequired');
    const re: Record<string, Record<string, string>> = {};
    for (const ty of types) {
      const x = validateDraft(drafts[ty], t, { complete: !asDraft });
      if (Object.keys(x).length) re[ty] = x;
    }
    setErrs(e);
    setReqErrs(re);
    setSubmitErr(null);
    setCanDraft(!asDraft && !Object.keys(e).length && Object.keys(re).length > 0 && Object.entries(re).every(([ty, x]) => onlyMissing(x, drafts[ty], t)));
    if (Object.keys(e).length || Object.keys(re).length) {
      // R2-8: say so at once and scroll to the first invalid field.
      const flat: Record<string, string> = { ...e };
      for (const [ty, x] of Object.entries(re)) for (const [k, v] of Object.entries(x)) flat[`${ty}.${k}`] = v;
      form.fail(flat);
      return;
    }
    form.clear();

    const requirements = types.map((ty) => draftToInput(drafts[ty], { saveAsDraft: asDraft }) as RequirementInput);
    setBusy(true);
    try {
      let relationshipId: string;
      let created: Requirement[];
      const existing = !!(dup?.exists && dup.can_access && dup.relationship_id);
      if (dup?.exists && dup.can_access && dup.relationship_id) {
        // Known customer I can see: add requirement cards, never a second identity.
        created = await addReqs.mutateAsync({ relationshipId: dup.relationship_id, requirements });
        relationshipId = dup.relationship_id;
      } else if (dup?.exists && !dup.can_access) {
        await dupReview.mutateAsync({ phone: toE164(phone), name: name.trim(), requirements, note: notes.trim() || undefined });
        analytics.track('lead_created', { result: 'duplicate_review', requirement_count: requirements.length });
        showToast(t('addLead.sentToReview'));
        router.back();
        return;
      } else {
        const rel = await addLead.mutateAsync({
          name: name.trim(),
          phone: toE164(phone),
          email: email.trim() || undefined,
          consent_confirmed: consent,
          contacts,
          requirements,
          source: source ? { source } : undefined,
          notes: notes.trim() || undefined,
          preferred_callback: callback ?? undefined,
        });
        relationshipId = rel.id;
        created = rel.requirements;
      }
      analytics.track('lead_created', { requirement_count: requirements.length, requirement_types: types.join(','), has_secondary_contact: contacts.length > 0, draft: asDraft });
      if (created.some((r) => r.is_draft)) showToast(t('draftReq.savedAsDraft'));
      setDone({
        relationshipId,
        existing,
        rows: created.map((r) => ({
          id: r.id,
          type: r.type,
          typeLabel: L.enumLabel('requirement_type', r.type),
          assignmentState: r.assignment_state,
          servicingName: r.servicing_aa?.name ?? null,
          isMine: r.is_mine,
          isDraft: !!r.is_draft,
          reason: r.assignment_reason ?? null,
          firstCallDueAt: r.sla?.state && r.sla.state !== 'MET' ? r.sla.due_at : null,
        })),
      });
    } catch (err) {
      // Server found the phone after all (race with lookup): switch to the existing-customer path.
      if (err instanceof ApiError && err.code === 'customer_exists') {
        const d = (err.details ?? {}) as { accessible?: boolean; relationship_id?: string; owner_name?: string };
        setDup({
          exists: true,
          can_access: !!d.accessible,
          relationship_id: d.relationship_id ?? null,
          owner_name: d.owner_name ?? null,
          phone_masked: phone.slice(0, 5) + ' •••••',
          customer_first_name: null,
          open_requirement_types: [],
        });
      }
      setSubmitErr(err);
      form.fail(apiAnchors(err, types), errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const shownApiFields = ['name', 'phone', 'email', 'preferred_callback', 'consent_confirmed', 'requirements', 'contacts.0.name', 'contacts.0.phone'];
  const bannerErr = submitErr
    ? apiErr && apiErr.hasFieldErrors() && Object.keys(apiErr.fields).every((k) => shownApiFields.includes(k) || /^requirements\.\d+\./.test(k))
      ? null
      : errorMessage(submitErr)
    : null;

  if (done) {
    return (
      <View className="flex-1 bg-slate-100">
        <ConnectedHeader onBack={() => router.back()} title={L.glossary('ADD_LEAD', t('addLead.title')).label} />
        <ScrollView contentContainerClassName="p-4 gap-4" contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}>
          <AssignmentResult title={done.existing ? t('addLead.successExistingTitle') : t('addLead.successTitle')} rows={done.rows} />
        </ScrollView>
        <View className="absolute bottom-0 left-0 right-0 gap-2 border-t border-slate-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button
            testID="addlead-open"
            size="lg"
            fullWidth
            icon={ArrowRight}
            label={t('addLead.openLead')}
            onPress={() => router.replace({ pathname: '/lead/[id]', params: { id: done.relationshipId } })}
          />
          <Button testID="addlead-another" variant="secondary" fullWidth label={t('addLead.addAnother')} onPress={() => router.replace('/lead/new')} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={L.glossary('ADD_LEAD', t('addLead.title')).label} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <FormScrollView form={form} innerClassName="gap-4" keyboardShouldPersistTaps="handled" contentContainerClassName="p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
          <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('addLead.customer')}</Text>
            <FieldAnchor form={form} name="name">
              <TextField testID="addlead-name" label={t('addLead.name')} required autoCapitalize="words" value={name} onChangeText={setName} error={field('name')} />
            </FieldAnchor>
            <FieldAnchor form={form} name="phone">
            <TextField
              testID="addlead-phone"
              label={t('addLead.phone')}
              required
              prefix="+91"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={(v) => {
                setPhone(v.replace(/\D/g, '').slice(0, 10));
                setDup(null);
              }}
              onBlur={onPhoneBlur}
              error={field('phone')}
            />
            </FieldAnchor>
            {dup ? (
              <View testID="duplicate-warning" className="flex-row items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <AlertTriangle size={16} color={colors.warn} />
                <Text className="flex-1 text-xs font-semibold text-amber-900">
                  {dup.can_access ? t('addLead.duplicateFound', { masked: dup.phone_masked }) : t('addLead.duplicateOther', { masked: dup.phone_masked })}
                  {dup.owner_name ? ` ${t('addLead.ownerIs', { name: dup.owner_name })}` : ''}
                </Text>
                {dup.can_access && dup.relationship_id ? (
                  <Button
                    testID="duplicate-view-existing"
                    size="sm"
                    variant="secondary"
                    label={t('addLead.viewExisting')}
                    onPress={() => router.replace({ pathname: '/lead/[id]', params: { id: dup.relationship_id! } })}
                  />
                ) : null}
              </View>
            ) : null}
            <FieldAnchor form={form} name="email">
              <TextField testID="addlead-email" label={t('addLead.email')} hint={t('common.optional')} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} error={field('email')} />
            </FieldAnchor>
            {!dup ? (
              <Chips
                testIDPrefix="addlead-callback"
                label={t('addLead.callback')}
                options={L.options('CALLBACK_WINDOW')}
                value={callback}
                onChange={(v) => setCallback((v as string | null) ?? null)}
                error={apiErr?.fields.preferred_callback}
              />
            ) : null}
          </View>

          <FieldAnchor form={form} name="types">
          <View className="gap-2">
            <Chips testIDPrefix="addlead-type" label={t('addLead.intents')} required multiple options={typeOptions} value={types} onChange={(v) => onTypes((v as string[]) ?? [])} error={field('types') || apiErr?.fields.requirements} />
            <Text className="text-[11px] text-slate-500">{t('addLead.intentsHint')}</Text>
          </View>
          </FieldAnchor>

          {types.map((ty, idx) => (
            <RequirementFields
              key={ty}
              draft={drafts[ty]}
              typeLabel={typeOptions.find((o) => o.value === ty)?.label ?? ty}
              onChange={(d) => setDrafts((all) => ({ ...all, [ty]: d }))}
              configurations={L.options('CONFIGURATION')}
              timelines={L.options('TIMELINE')}
              renderSociety={(d, on, err) => <SocietyField draft={d} onChange={on} error={err} />}
              error={(f) => reqErrs[ty]?.[f] ?? reqApiErr(idx, f)}
              form={form}
              anchorPrefix={`${ty}.`}
            />
          ))}

          {!dup ? (
            <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <Checkbox testID="addlead-secondary" checked={withSecondary} onChange={setWithSecondary} label={`${t('addLead.secondary')} · ${t('addLead.secondaryHint')}`} />
              {withSecondary ? (
                <>
                  <FieldAnchor form={form} name="secondary.name">
                  <TextField label={t('addLead.secondaryName')} required value={sec.name} onChangeText={(v) => setSec({ ...sec, name: v })} error={field('secondary.name') || apiErr?.fields['contacts.0.name']} />
                  </FieldAnchor>
                  <FieldAnchor form={form} name="secondary.phone">
                  <TextField
                    label={t('addLead.secondaryPhone')}
                    prefix="+91"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={sec.phone}
                    onChangeText={(v) => setSec({ ...sec, phone: v.replace(/\D/g, '').slice(0, 10) })}
                    error={field('secondary.phone') || apiErr?.fields['contacts.0.phone']}
                  />
                  </FieldAnchor>
                  <Chips label={t('addLead.secondaryRole')} options={roleOptions} value={sec.role} allowDeselect={false} onChange={(v) => setSec({ ...sec, role: v as ContactRole })} />
                  <TextField label={t('addLead.secondaryAddress')} multiline value={sec.address} onChangeText={(v) => setSec({ ...sec, address: v })} />
                  <Chips
                    label={t('addLead.primaryIs')}
                    options={[
                      { value: 'CUSTOMER', label: name.trim() || t('addLead.primaryCustomer') },
                      { value: 'SECONDARY', label: sec.name.trim() || t('addLead.primarySecondary') },
                    ]}
                    value={coordinate}
                    allowDeselect={false}
                    onChange={(v) => setCoordinate(v as 'CUSTOMER' | 'SECONDARY')}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {!dup ? (
            <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <Chips label={t('lead.source')} options={sourceOptions} value={source} onChange={(v) => setSource(v as string | null)} />
              <TextField label={t('addLead.notes')} multiline value={notes} onChangeText={setNotes} />
            </View>
          ) : null}

          <FieldAnchor form={form} name="consent">
          <Checkbox testID="addlead-consent" checked={consent} onChange={setConsent} label={t('addLead.consent')} error={field('consent') || apiErr?.fields.consent_confirmed} />
          </FieldAnchor>
          {bannerErr ? (
            <FieldAnchor form={form} name="banner">
              <InlineBanner testID="addlead-error">{bannerErr}</InlineBanner>
            </FieldAnchor>
          ) : null}
        </FormScrollView>
      </KeyboardAvoidingView>
      <View className="absolute bottom-0 left-0 right-0 gap-2 border-t border-slate-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        {canDraft ? (
          <View className="gap-1">
            <Text className="text-[11px] font-semibold text-amber-800">{t('draftReq.offer')}</Text>
            <Button testID="addlead-save-draft" variant="secondary" fullWidth icon={FilePen} disabled={!online || busy} label={t('draftReq.saveDraft')} onPress={() => void submit(true)} />
          </View>
        ) : null}
        <Button
          testID="addlead-submit"
          size="lg"
          fullWidth
          icon={UserPlus}
          disabled={!online}
          loading={busy}
          label={dup?.exists ? (dup.can_access ? t('addLead.submitExisting') : t('addLead.submitReview')) : t('addLead.submit')}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

/** R2-8: API field keys → anchor names on this screen (unknown keys → the banner). */
export function apiAnchors(err: unknown, types: string[]): Record<string, string> {
  if (!(err instanceof ApiError) || !err.hasFieldErrors()) return { banner: errorMessage(err) };
  const out: Record<string, string> = {};
  const direct: Record<string, string> = { name: 'name', phone: 'phone', email: 'email', consent_confirmed: 'consent', requirements: 'types', 'contacts.0.name': 'secondary.name', 'contacts.0.phone': 'secondary.phone' };
  for (const [k, v] of Object.entries(err.fields)) {
    const m = /^requirements\.(\d+)\.(\w+)$/.exec(k);
    if (m && types[Number(m[1])] && API_TO_DRAFT[m[2]]) out[`${types[Number(m[1])]}.${API_TO_DRAFT[m[2]]}`] = v;
    else out[direct[k] ?? 'banner'] = v;
  }
  return out;
}
