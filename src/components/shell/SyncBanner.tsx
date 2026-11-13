import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, CloudOff } from 'lucide-react-native';
import { useOutbox } from '@/offline';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** Visible sync state app-wide: queued offline changes, and conflicts that need a decision. */
export function SyncBanner() {
  const t = useT();
  const router = useRouter();
  const s = useOutbox();
  if (!s.pending && !s.conflicts && !s.rejected) return null;
  const problem = s.conflicts + s.rejected;
  return (
    <Pressable testID="sync-banner" accessibilityRole="button" onPress={() => router.push('/more/sync')} className={problem ? 'flex-row items-center justify-between bg-rose-600 px-3 py-1.5' : 'flex-row items-center justify-between bg-slate-700 px-3 py-1.5'}>
      <View className="flex-1 flex-row items-center gap-2">
        {problem ? <AlertTriangle size={13} color={colors.white} /> : <CloudOff size={13} color={colors.white} />}
        <Text className="flex-1 text-xs font-semibold text-white">
          {problem ? t('sync.bannerConflicts', { count: problem }) : `${t('sync.bannerPending', { count: s.pending })}${s.syncing ? ` · ${t('sync.syncing')}` : ''}`}
        </Text>
      </View>
      <Text className="text-xs font-bold text-white underline">{t('sync.open')}</Text>
    </Pressable>
  );
}
