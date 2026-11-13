import { useState } from 'react';
import { Text } from 'react-native';
import { BottomSheet, Button, Chips, InlineBanner, type Option } from '@/components/ui';
import { RequirementFields } from '@/components/leadForm/RequirementFields';
import { SocietyField } from '@/components/leadForm/SocietyField';
import { API_TO_DRAFT, draftToInput, emptyDraft, onlyMissing, validateDraft, type RequirementDraft } from '@/components/leadForm/types';
import { useSubmit } from '@/hooks/useSubmit';
import { FieldAnchor, useFormFocus } from '@/hooks/useFormFocus';
import { ApiError } from '@/api/errors';
import type { RequirementInput } from '@/api/types';
import { useT } from '@/i18n';
import type { SheetBaseProps } from './types';

interface Props extends SheetBaseProps<RequirementInput[]> {
  customerName: string;
  types: Option[];
  configurations: Option[];
  timelines: Option[];
}

/** APP-12: same customer, new requirement card(s). */
export function AddRequirementSheet(p: Props) {
  return p.visible ? <AddRequirementSheetBody {...p} /> : null;
}

function AddRequirementSheetBody(p: Props) {
  const t = useT();
  const [types, setTypes] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RequirementDraft>>({});
  const [clientErr, setClientErr] = useState<Record<string, Record<string, string>>>({});
  const [typeErr, setTypeErr] = useState<string>();
  const [canDraft, setCanDraft] = useState(false);
  const form = useFormFocus({ toast: false });
  const s = useSubmit(async (v: RequirementInput[]) => {
    try {
      return await p.onSubmit(v);
    } catch (e) {
      // R2-8: API field errors scroll to their card field; anything else to the banner.
      const out: Record<string, string> = {};
      if (e instanceof ApiError) {
        for (const [k, msg] of Object.entries(e.fields)) {
          const m = /^requirements\.(\d+)\.(\w+)$/.exec(k);
          out[m && types[Number(m[1])] && API_TO_DRAFT[m[2]] ? `${types[Number(m[1])]}.${API_TO_DRAFT[m[2]]}` : 'banner'] = msg;
        }
      }
      form.fail(Object.keys(out).length ? out : { banner: e instanceof Error ? e.message : 'error' }, e instanceof Error ? e.message : undefined);
      throw e;
    }
  }, p.onClose);

  const onTypes = (next: string[]) => {
    setTypes(next);
    setTypeErr(undefined);
    setDrafts((d) => Object.fromEntries(next.map((ty) => [ty, d[ty] ?? emptyDraft(ty)])));
  };

  const apiErrFor = (idx: number, field: string) => {
    if (!(s.error instanceof ApiError)) return undefined;
    for (const [k, v] of Object.entries(s.error.fields)) {
      const m = /^requirements\.(\d+)\.(\w+)$/.exec(k);
      if (m && Number(m[1]) === idx && API_TO_DRAFT[m[2]] === field) return v;
    }
    return undefined;
  };

  const submit = (asDraft = false) => {
    if (!types.length) {
      setTypeErr(t('addLead.intentRequired'));
      form.fail({ types: 'x' });
      return;
    }
    const errs: Record<string, Record<string, string>> = {};
    for (const ty of types) {
      const e = validateDraft(drafts[ty], t, { complete: !asDraft });
      if (Object.keys(e).length) errs[ty] = e;
    }
    setClientErr(errs);
    setCanDraft(!asDraft && Object.keys(errs).length > 0 && Object.entries(errs).every(([ty, x]) => onlyMissing(x, drafts[ty], t)));
    if (Object.keys(errs).length) {
      const flat: Record<string, string> = {};
      for (const [ty, x] of Object.entries(errs)) for (const [k, v] of Object.entries(x)) flat[`${ty}.${k}`] = v;
      form.fail(flat);
      return;
    }
    form.clear();
    void s.run(types.map((ty) => draftToInput(drafts[ty], { saveAsDraft: asDraft }) as RequirementInput));
  };

  // duplicate_requirement (same type + place already open) is explained in plain words by the API.
  const banner =
    s.error instanceof ApiError && !Object.keys(s.error.fields).every((k) => /^requirements\.\d+\./.test(k)) ? s.error.message : s.error && !(s.error instanceof ApiError) ? s.banner([]) : null;

  return (
    <BottomSheet
      testID="add-requirement-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      form={form}
      title={t('addReq.title')}
      subtitle={`${p.customerName} · ${t('addReq.subtitle')}`}
      footer={
        <>
          {canDraft ? <Button testID="add-requirement-draft" className="flex-1" variant="secondary" label={t('draftReq.saveDraft')} disabled={s.busy} onPress={() => submit(true)} /> : null}
          <Button testID="add-requirement-submit" className="flex-1" label={t('addReq.submit')} loading={s.busy} onPress={() => submit()} />
        </>
      }
    >
      <FieldAnchor form={form} name="types">
      <Chips testIDPrefix="addreq-type" label={t('addReq.type')} required multiple options={p.types} value={types} onChange={(v) => onTypes((v as string[]) ?? [])} error={typeErr} />
      </FieldAnchor>
      {types.map((ty, idx) => (
        <RequirementFields
          key={ty}
          draft={drafts[ty]}
          typeLabel={p.types.find((o) => o.value === ty)?.label ?? ty}
          onChange={(d) => setDrafts((all) => ({ ...all, [ty]: d }))}
          configurations={p.configurations}
          timelines={p.timelines}
          renderSociety={(d, on, err) => <SocietyField draft={d} onChange={on} error={err} />}
          error={(f) => clientErr[ty]?.[f] ?? apiErrFor(idx, f)}
          form={form}
          anchorPrefix={`${ty}.`}
        />
      ))}
      {canDraft ? <Text className="text-[11px] font-semibold text-amber-800">{t('draftReq.offer')}</Text> : null}
      {banner ? (
        <FieldAnchor form={form} name="banner">
          <InlineBanner>{banner}</InlineBanner>
        </FieldAnchor>
      ) : null}
    </BottomSheet>
  );
}
