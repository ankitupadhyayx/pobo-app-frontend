import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { BottomSheet, Button, Chips, EmptyState, InlineBanner, type Option } from '@/components/ui';
import { useSubmit } from '@/hooks/useSubmit';
import type { MessageTemplate } from '@/api/types';
import { useT } from '@/i18n';
import type { SheetBaseProps } from './types';

export interface MessageValues {
  requirementId: string;
  templateCode: string;
  channel: 'WHATSAPP' | 'SMS';
  to: 'CUSTOMER' | 'PRIMARY_CONTACT';
}

interface Props extends SheetBaseProps<MessageValues> {
  customerName: string;
  templates: MessageTemplate[];
  requirements: Option[];
  defaultRequirementId?: string;
  hasPrimaryContact: boolean;
  primaryContactLabel?: string;
  /** Values used only for the on-device preview; the server renders the real text. */
  preview: Record<string, string>;
  language: string;
}

function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/** APP-17: pick a template → server renders + logs it → open WhatsApp/SMS via deep link. */
export function MessageSheet(p: Props) {
  return p.visible ? <MessageSheetBody {...p} /> : null;
}

function MessageSheetBody(p: Props) {
  const t = useT();
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
  const [code, setCode] = useState<string | null>(null);
  const [to, setTo] = useState<'CUSTOMER' | 'PRIMARY_CONTACT'>(p.hasPrimaryContact ? 'PRIMARY_CONTACT' : 'CUSTOMER');
  const [reqId, setReqId] = useState<string | null>(p.defaultRequirementId ?? p.requirements[0]?.value ?? null);
  const s = useSubmit(p.onSubmit, p.onClose);

  const forChannel = useMemo(() => {
    const list = p.templates.filter((tpl) => tpl.channel === channel);
    // The AA's language first; other languages stay available.
    return [...list].sort((a, b) => Number((b.language ?? 'en') === p.language) - Number((a.language ?? 'en') === p.language));
  }, [p.templates, channel, p.language]);
  const selected = forChannel.find((tpl) => tpl.code === code) ?? forChannel[0];
  const channelLabel = channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS';
  const banner = s.banner(['template_code', 'channel', 'to']);

  return (
    <BottomSheet
      testID="message-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('messages.title')}
      subtitle={p.customerName}
      footer={
        <Button
          testID="message-send"
          className="flex-1"
          icon={MessageCircle}
          label={t('messages.send', { channel: channelLabel })}
          disabled={!selected || !reqId}
          loading={s.busy}
          onPress={() => selected && reqId && void s.run({ requirementId: reqId, templateCode: selected.code, channel, to })}
        />
      }
    >
      <Chips
        label={t('messages.channel')}
        options={[
          { value: 'WHATSAPP', label: 'WhatsApp' },
          { value: 'SMS', label: 'SMS' },
        ]}
        value={channel}
        allowDeselect={false}
        onChange={(v) => {
          setChannel(v as 'WHATSAPP' | 'SMS');
          setCode(null);
        }}
      />
      {p.hasPrimaryContact ? (
        <Chips
          label={t('messages.to')}
          options={[
            { value: 'PRIMARY_CONTACT', label: p.primaryContactLabel ?? t('lead.primaryContact') },
            { value: 'CUSTOMER', label: p.customerName },
          ]}
          value={to}
          allowDeselect={false}
          onChange={(v) => setTo(v as 'CUSTOMER' | 'PRIMARY_CONTACT')}
        />
      ) : null}
      {p.requirements.length > 1 ? (
        <Chips label={t('call.requirement')} options={p.requirements} value={reqId} onChange={(v) => setReqId(v as string)} allowDeselect={false} />
      ) : null}
      {forChannel.length === 0 ? (
        <EmptyState icon={MessageCircle} title={t('messages.template')} body={t('messages.none')} />
      ) : (
        <>
          <Chips
            label={t('messages.template')}
            options={forChannel.map((tpl) => ({ value: tpl.code, label: tpl.name }))}
            value={selected?.code ?? null}
            allowDeselect={false}
            onChange={(v) => setCode(v as string)}
            error={s.apiField('template_code')}
          />
          {selected ? (
            <View className="gap-1">
              <Text className="text-xs font-bold text-slate-700">{t('messages.preview')}</Text>
              <View className="rounded-2xl rounded-tl-sm bg-emerald-50 p-3">
                <Text className="text-sm leading-5 text-slate-800">{render(selected.body, p.preview)}</Text>
              </View>
            </View>
          ) : null}
        </>
      )}
      {banner ? <InlineBanner>{banner}</InlineBanner> : null}
    </BottomSheet>
  );
}
