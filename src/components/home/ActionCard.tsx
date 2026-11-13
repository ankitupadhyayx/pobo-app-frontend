import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowRight, Ban } from 'lucide-react-native';
import { Button, Card, SlaChip, type SlaChipProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

export type ActionTone = 'breach' | 'overdue' | 'new' | 'visit' | 'due' | 'transfer' | 'info';

const badgeStyles: Record<ActionTone, { box: string; text: string }> = {
  breach: { box: 'bg-rose-100 border-rose-300', text: 'text-rose-800 font-black' },
  overdue: { box: 'bg-rose-50 border-rose-200', text: 'text-rose-800' },
  new: { box: 'bg-teal-100 border-teal-300', text: 'text-teal-900' },
  visit: { box: 'bg-blue-100 border-blue-200', text: 'text-blue-800' },
  due: { box: 'bg-teal-50 border-teal-200', text: 'text-teal-800' },
  transfer: { box: 'bg-amber-100 border-amber-300', text: 'text-amber-900' },
  info: { box: 'bg-slate-100 border-slate-200', text: 'text-slate-700' },
};

export interface CardAction {
  label: string;
  onPress: () => void;
  icon?: ComponentType<{ size?: number; color?: string }>;
  variant?: 'primary' | 'danger' | 'info' | 'secondary';
  loading?: boolean;
}

interface ActionCardProps {
  badge: string;
  tone: ActionTone;
  title: string;
  context?: string;
  /** Right-aligned due text when there's no live SLA. */
  dueText?: string;
  sla?: SlaChipProps;
  primary?: CardAction;
  secondary?: CardAction;
  onOpen?: () => void;
  /** DNC replaces outbound actions with an explanation. */
  dnc?: boolean;
  dncText?: string;
  testID?: string;
}

/** One ranked Home card. Every card shows its next action (blueprint §22). */
export function ActionCard({ badge, tone, title, context, dueText, sla, primary, secondary, onOpen, dnc, dncText, testID }: ActionCardProps) {
  const urgent = tone === 'breach' || tone === 'overdue';
  const b = badgeStyles[tone];
  return (
    <Card tone={urgent ? 'alert' : 'default'} testID={testID}>
      <View className="flex-row items-center justify-between gap-2">
        <View className={cn('rounded border px-2 py-0.5', b.box)}>
          <Text className={cn('text-[10px] font-bold uppercase tracking-wide', b.text)}>{badge}</Text>
        </View>
        {sla ? <SlaChip {...sla} compact /> : dueText ? (
          <Text className={cn('text-xs font-bold', urgent ? 'text-rose-600' : 'text-slate-600')}>{dueText}</Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" disabled={!onOpen} onPress={onOpen} className="mt-2.5">
        <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
          {title}
        </Text>
        {context ? (
          <Text className="mt-0.5 text-xs text-slate-600" numberOfLines={2}>
            {context}
          </Text>
        ) : null}
      </Pressable>
      <View className="mt-3.5 flex-row items-center gap-2 border-t border-slate-100 pt-3">
        {dnc ? (
          <View className="flex-1 flex-row items-center gap-1.5">
            <Ban size={14} color={colors.danger} />
            <Text className="flex-1 text-xs font-semibold italic text-rose-600">{dncText}</Text>
          </View>
        ) : (
          <>
            {primary ? (
              <Button
                className="flex-1"
                size="md"
                label={primary.label}
                icon={primary.icon}
                variant={primary.variant ?? (urgent ? 'danger' : 'primary')}
                loading={primary.loading}
                onPress={primary.onPress}
              />
            ) : (
              <View className="flex-1" />
            )}
            {secondary ? (
              <Button size="md" variant="secondary" label={secondary.label} icon={secondary.icon} loading={secondary.loading} onPress={secondary.onPress} />
            ) : null}
          </>
        )}
        {onOpen ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open lead" onPress={onOpen} className="h-11 w-11 items-center justify-center rounded-xl active:bg-slate-100">
            <ArrowRight size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
