import { useState } from 'react';
import { Text } from 'react-native';
import { BottomSheet, Button, InlineBanner } from '@/components/ui';
import { RequirementFields } from '@/components/leadForm/RequirementFields';
import { SocietyField } from '@/components/leadForm/SocietyField';
import { API_TO_DRAFT, draftFromRequirement, draftToInput, validateDraft, type RequirementDraft } from '@/components/leadForm/types';
import { useUpdateRequirement } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { ApiError, errorMessage } from '@/api/errors';
import { FieldAnchor, useFormFocus } from '@/hooks/useFormFocus';
import { useActions } from '@/state/actions';
import type { Requirement } from '@/api/types';
import type { components } from '@/api/schema';
import { useT } from '@/i18n';

/**
 * R3-2 "Complete requirement": the Draft's details in the same form as Add Lead, required fields
 * marked; Save submits it complete (inline errors + scroll if something is missing), "Save as
 * draft" keeps what was typed.
 */
export function CompleteRequirementSheet({ req, visible, onClose }: { req: Requirement; visible: boolean; onClose: () => void }) {
  return visible ? <Body req={req} onClose={onClose} /> : null;
}

function Body({ req, onClose }: { req: Requirement; onClose: () => void }) {
  const t = useT();
  const L = useLabels();
  const showToast = useActions((s) => s.showToast);
  const update = useUpdateRequirement(req.relationship_id);
  const form = useFormFocus({ toast: false });
  const hasProperty = (req.properties ?? []).length > 0;
  const [draft, setDraft] = useState<RequirementDraft>(() => draftFromRequirement(req));
  const [errs, setErrs] = useState<Record<string, string>>(() =>
    Object.fromEntries((req.missing_fields ?? []).map((m) => [API_TO_DRAFT[m.field] ?? m.field, m.message]).filter(([k]) => typeof k === 'string')),
  );
  const [banner, setBanner] = useState<string | null>(null);

  const save = async (asDraft: boolean) => {
    const e = validateDraft(draft, t, { complete: !asDraft, hasProperty });
    setErrs(e);
    setBanner(null);
    if (Object.keys(e).length) {
      form.fail(e);
      return;
    }
    form.clear();
    const { type: _type, ...rest } = draftToInput(draft);
    const body = { ...rest, version: req.version, save_as_draft: asDraft } as components['schemas']['PatchedRequirementUpdateRequest'];
    try {
      const r = await update.mutateAsync({ id: req.id, body });
      showToast(r.is_draft ? t('draftReq.savedAsDraft') : t('draftReq.completed'));
      onClose();
    } catch (err) {
      const out: Record<string, string> = {};
      if (err instanceof ApiError) for (const [k, v] of Object.entries(err.fields)) out[API_TO_DRAFT[k.split('.').pop() ?? k] ?? 'banner'] = v;
      const { banner: b, ...fieldErrs } = out;
      setErrs(fieldErrs);
      setBanner(b ?? (Object.keys(fieldErrs).length ? null : errorMessage(err)));
      form.fail(Object.keys(out).length ? out : { banner: errorMessage(err) }, errorMessage(err));
    }
  };

  return (
    <BottomSheet
      testID="complete-req-sheet"
      visible
      onClose={onClose}
      dismissable={!update.isPending}
      form={form}
      title={t('draftReq.completeTitle')}
      subtitle={req.title}
      footer={
        <>
          <Button testID="complete-req-draft" className="flex-1" variant="secondary" label={t('draftReq.saveDraft')} disabled={update.isPending} onPress={() => void save(true)} />
          <Button testID="complete-req-save" className="flex-1" label={t('draftReq.complete')} loading={update.isPending} onPress={() => void save(false)} />
        </>
      }
    >
      <Text className="text-[11px] text-slate-600">{t('draftReq.completeHint')}</Text>
      <RequirementFields
        draft={draft}
        typeLabel={L.enumLabel('requirement_type', req.type)}
        onChange={setDraft}
        configurations={L.options('CONFIGURATION')}
        timelines={L.options('TIMELINE')}
        renderSociety={(d, on, err) => <SocietyField draft={d} onChange={on} error={err} />}
        error={(f) => errs[f]}
        form={form}
        hasProperty={hasProperty}
      />
      {banner ? (
        <FieldAnchor form={form} name="banner">
          <InlineBanner>{banner}</InlineBanner>
        </FieldAnchor>
      ) : null}
    </BottomSheet>
  );
}
