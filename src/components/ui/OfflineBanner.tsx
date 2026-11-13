import { Pressable, Text, View } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useOnline } from '@/hooks/useOnline';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/**
 * Shown under the header when the phone has no connection. Phase 1 has no offline write queue
 * (blueprint §23 is Phase 2+): actions are disabled with this explanation instead of silently failing.
 */
export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  const online = useOnline();
  const t = useT();
  if (online) return null;
  return (
    <View testID="offline-banner" className="flex-row items-center justify-between bg-amber-600 px-3 py-2">
      <View className="flex-1 flex-row items-center gap-2">
        <WifiOff size={14} color={colors.white} />
        <Text className="flex-1 text-xs font-semibold text-white">{t('offline.banner')}</Text>
      </View>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} className="flex-row items-center gap-1 rounded bg-white px-2 py-1">
          <RefreshCw size={12} color="#78350f" />
          <Text className="text-[11px] font-bold text-amber-900">{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
