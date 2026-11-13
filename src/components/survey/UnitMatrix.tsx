import { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { LAYER_STYLE, listingCell, type ListingState, type UnitLayer } from './unitStyle';
import { useT } from '@/i18n';

export interface UnitCell {
  id: string;
  label: string;
  layer: UnitLayer;
  listingState?: ListingState | null;
  /** Local unsynced change for this unit. */
  pending?: boolean;
  conflict?: boolean;
  keysHeld?: boolean;
}

export interface FloorRow {
  floor: string;
  units: UnitCell[];
}

/** Tower matrix: floors top→bottom (highest first, like the building), units left→right. */
export const UnitMatrix = memo(function UnitMatrix({ floors, onPress }: { floors: FloorRow[]; onPress: (u: UnitCell) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-4">
      <View className="gap-1.5">
        {floors.map((f) => (
          <View key={f.floor} className="flex-row items-center gap-1.5">
            <Text className="w-9 text-right text-[10px] font-bold text-slate-500">{f.floor}</Text>
            {f.units.map((u) => {
              const s = u.layer === 'listing' ? listingCell(u.listingState) : LAYER_STYLE[u.layer];
              return (
                <Pressable
                  key={u.id}
                  testID={`unit-${u.label}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${u.label} ${u.layer}${u.listingState ? ` ${u.listingState}` : ''}`}
                  onPress={() => onPress(u)}
                  className={cn('h-11 w-14 items-center justify-center rounded-lg active:opacity-70', s.cell)}
                >
                  <Text className={cn('text-[11px] font-bold', s.text)} numberOfLines={1}>
                    {u.label}
                  </Text>
                  {u.keysHeld ? (
                    <View className="absolute bottom-0.5 left-0.5">
                      <KeyRound size={9} color="#334155" />
                    </View>
                  ) : null}
                  {u.pending || u.conflict ? <View className={cn('absolute right-0.5 top-0.5 h-2 w-2 rounded-full', u.conflict ? 'bg-rose-500' : 'bg-amber-500')} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

export function MatrixLegend() {
  const t = useT();
  const items: { key: string; cell: string }[] = [
    { key: 'mapped', cell: LAYER_STYLE.mapped.cell },
    { key: 'surveyed', cell: LAYER_STYLE.surveyed.cell },
    { key: 'opportunity', cell: LAYER_STYLE.opportunity.cell },
    { key: 'listing', cell: LAYER_STYLE.listing.cell },
    { key: 'verified', cell: listingCell('VERIFIED').cell },
  ];
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1.5">
      {items.map((i) => (
        <View key={i.key} className="flex-row items-center gap-1.5">
          <View className={cn('h-3.5 w-5 rounded', i.cell)} />
          <Text className="text-[11px] font-medium text-slate-600">{t(`survey.layer.${i.key}`)}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View className="h-2 w-2 rounded-full bg-amber-500" />
        <Text className="text-[11px] font-medium text-slate-600">{t('sync.saved_local')}</Text>
      </View>
    </View>
  );
}
