import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, XCircle } from 'lucide-react-native';
import type { SyncChipState } from '@/offline';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

const S: Record<SyncChipState, { box: string; text: string; icon: typeof CheckCircle2; color: string }> = {
  saved_local: { box: 'bg-amber-50 border-amber-300', text: 'text-amber-900', icon: CloudOff, color: colors.warn },
  syncing: { box: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: RefreshCw, color: colors.info },
  synced: { box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon: CheckCircle2, color: colors.ok },
  conflict: { box: 'bg-rose-50 border-rose-300', text: 'text-rose-800', icon: AlertTriangle, color: colors.danger },
  rejected: { box: 'bg-rose-50 border-rose-300', text: 'text-rose-800', icon: XCircle, color: colors.danger },
};

/** Visible sync state for offline-capable records (blueprint §23.1). */
export function SyncChip({ state, hideSynced }: { state: SyncChipState; hideSynced?: boolean }) {
  const t = useT();
  if (hideSynced && state === 'synced') return null;
  const s = S[state];
  const Icon = s.icon;
  return (
    <View testID={`sync-chip-${state}`} className={cn('flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5', s.box)}>
      <Icon size={11} color={s.color} />
      <Text className={cn('text-[10px] font-bold', s.text)}>{t(`sync.${state}`)}</Text>
    </View>
  );
}
