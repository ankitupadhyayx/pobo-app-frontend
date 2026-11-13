import { Text, View } from 'react-native';
import { ArrowRight, Ban, Clock, PhoneCall } from 'lucide-react-native';
import { memo } from 'react';
import { Button, Card, IntentTag, SlaChip, StagePill, type SlaChipProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export interface LeadCardProps {
  id: string;
  name: string;
  /** One tag per requirement (customer can have several). */
  intents: { type: string; label: string }[];
  stage: { status: string; label: string };
  meta?: string;
  sla?: SlaChipProps;
  nextAction?: { title: string; dueText?: string; overdue?: boolean } | null;
  dnc?: boolean;
  transferPending?: boolean;
  canCall?: boolean;
  onCall?: () => void;
  onOpen: () => void;
}

export const LeadCard = memo(function LeadCard(p: LeadCardProps) {
  const t = useT();
  const overdue = !!p.nextAction?.overdue;
  return (
    <Card tone={overdue ? 'alert' : 'default'} onPress={p.onOpen} testID={`lead-card-${p.id}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
            {p.name}
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-1">
            {p.intents.map((i, idx) => (
              <IntentTag key={`${i.type}-${idx}`} type={i.type} label={i.label} />
            ))}
          </View>
          {p.meta ? (
            <Text className="mt-1 text-xs text-slate-600" numberOfLines={1}>
              {p.meta}
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          <StagePill status={p.dnc ? 'DNC' : p.stage.status} label={p.stage.label} />
          {p.sla && !p.dnc ? <SlaChip {...p.sla} compact /> : null}
        </View>
      </View>

      {p.transferPending ? (
        <View className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-2">
          <Text className="text-[11px] font-semibold text-amber-900">{t('leads.transferPending')}</Text>
        </View>
      ) : null}

      {p.nextAction ? (
        <View className={cn('mt-3 flex-row items-center justify-between gap-2 rounded-xl border p-2.5', overdue ? 'border-rose-200 bg-rose-50/70' : 'border-slate-100 bg-slate-50')}>
          <View className="flex-1 flex-row items-center gap-2">
            <Clock size={14} color={overdue ? colors.danger : colors.slate400} />
            <Text className={cn('flex-1 text-xs font-medium', overdue ? 'text-rose-900' : 'text-slate-700')} numberOfLines={1}>
              {p.nextAction.title}
            </Text>
          </View>
          {p.nextAction.dueText ? (
            <Text className={cn('text-[11px] font-bold', overdue ? 'text-rose-600' : 'text-slate-600')}>{p.nextAction.dueText}</Text>
          ) : null}
        </View>
      ) : (
        <Text className="mt-3 text-xs italic text-slate-500">{t('leads.noNextAction')}</Text>
      )}

      <View className="mt-3.5 flex-row items-center justify-between gap-2 border-t border-slate-100 pt-3">
        {p.dnc ? (
          <View className="flex-1 flex-row items-center gap-1.5">
            <Ban size={14} color={colors.danger} />
            <Text className="flex-1 text-xs font-semibold italic text-rose-600">{t('leads.dncSuppressed')}</Text>
          </View>
        ) : p.canCall && p.onCall ? (
          <Button size="sm" variant={overdue ? 'danger' : 'primary'} icon={PhoneCall} label={overdue ? t('common.callNow') : t('common.call')} onPress={p.onCall} />
        ) : (
          <View />
        )}
        <Button size="sm" variant="secondary" icon={ArrowRight} iconRight label={t('common.open')} onPress={p.onOpen} />
      </View>
    </Card>
  );
});
