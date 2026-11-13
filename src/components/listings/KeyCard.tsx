import { Text, View } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { Button, Card, SyncChip } from '@/components/ui';
import type { SyncChipState } from '@/offline';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';

export interface KeyCardProps {
  id: string;
  unitLabel: string;
  society: string;
  takenAt: string;
  from?: string | null;
  purpose?: string | null;
  dueBack?: string | null;
  sync?: SyncChipState;
  onReturn?: () => void;
}

/** APP-28: keys the AA currently holds; returning one is recorded (works offline). */
export function KeyCard(p: KeyCardProps) {
  const t = useT();
  const now = useNow();
  const overdue = !!p.dueBack && Date.parse(p.dueBack) < now;
  return (
    <Card tone={overdue ? 'alert' : 'default'} testID={`key-${p.id}`}>
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <KeyRound size={18} color={colors.warn} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-900">{p.unitLabel}</Text>
          <Text className="text-xs text-slate-500">{p.society}</Text>
          <Text className="mt-1 text-[11px] text-slate-600">
            {t('keys.takenAt', { when: formatWhen(p.takenAt) })}
            {p.from ? ` · ${t('keys.from', { name: p.from })}` : ''}
          </Text>
          {p.purpose ? <Text className="text-[11px] text-slate-600">{p.purpose}</Text> : null}
          {p.dueBack ? <Text className={overdue ? 'text-[11px] font-bold text-rose-600' : 'text-[11px] text-slate-600'}>{t('keys.dueBack', { when: formatWhen(p.dueBack) })}</Text> : null}
        </View>
        {p.sync ? <SyncChip state={p.sync} hideSynced /> : null}
      </View>
      {p.onReturn ? <Button testID={`key-return-${p.id}`} className="mt-3" size="sm" variant="outline" label={t('keys.markReturned')} onPress={p.onReturn} /> : null}
    </Card>
  );
}
