import { Text, View } from 'react-native';
import { AlertTriangle, ImageIcon } from 'lucide-react-native';
import { Badge, Card, SyncChip, type BadgeTone } from '@/components/ui';
import type { SyncChipState } from '@/offline';
import type { ListingState } from '@/components/survey/unitStyle';
import { formatINR } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

const TONE: Record<ListingState, BadgeTone> = { DRAFT: 'slate', SUBMITTED: 'blue', CHANGES_REQUESTED: 'rose', VERIFIED: 'purple', REJECTED: 'slate', WITHDRAWN: 'dark' };

export interface ListingCardProps {
  id: string;
  title: string;
  subtitle?: string;
  state: ListingState;
  stateLabel: string;
  price?: number | null;
  rent?: number | null;
  photos: number;
  changeRequest?: string | null;
  sync?: SyncChipState;
  onPress?: () => void;
}

/** A listing (DEC-01 #5) is visibly a marketable record: violet, with its verification state. */
export function ListingCard(p: ListingCardProps) {
  const t = useT();
  return (
    <Card onPress={p.onPress} tone={p.state === 'CHANGES_REQUESTED' ? 'alert' : p.state === 'WITHDRAWN' ? 'muted' : 'default'} testID={`listing-${p.id}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">{t('listings.listing')}</Text>
          <Text className="text-sm font-bold text-slate-900">{p.title}</Text>
          {p.subtitle ? <Text className="text-xs text-slate-500">{p.subtitle}</Text> : null}
        </View>
        <View className="items-end gap-1">
          <Badge label={p.stateLabel} tone={TONE[p.state]} />
          {p.sync ? <SyncChip state={p.sync} hideSynced /> : null}
        </View>
      </View>
      <View className="mt-2 flex-row items-center gap-3">
        {p.price ? <Text className="text-xs font-bold text-teal-800">{formatINR(p.price)}</Text> : null}
        {p.rent ? <Text className="text-xs font-bold text-teal-800">{formatINR(p.rent)}/mo</Text> : null}
        <View className="flex-row items-center gap-1">
          <ImageIcon size={12} color={colors.muted} />
          <Text className="text-[11px] text-slate-500">{t('listings.photos', { count: p.photos })}</Text>
        </View>
      </View>
      {p.changeRequest ? (
        <View className="mt-2.5 flex-row items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5">
          <AlertTriangle size={14} color={colors.danger} />
          <Text className="flex-1 text-xs text-rose-900">
            <Text className="font-bold">{t('listings.changesRequested')}: </Text>
            {p.changeRequest}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
