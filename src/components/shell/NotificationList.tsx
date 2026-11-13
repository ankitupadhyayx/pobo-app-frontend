import { FlatList, Pressable, Text, View } from 'react-native';
import { BellOff, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { formatAgo } from '@/lib/time';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  tone?: 'urgent' | 'normal';
  icon?: LucideIcon;
}

interface Props {
  items: NotificationItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen: (item: NotificationItem) => void;
  onEndReached?: () => void;
  footerNote?: string | null;
}

export function NotificationList({ items, loading, error, onRetry, onOpen, onEndReached, footerNote }: Props) {
  const t = useT();
  if (loading) return <View className="p-4"><ListSkeleton count={3} /></View>;
  if (error && !items.length) return <View className="p-4"><ErrorState error={error} onRetry={onRetry} /></View>;
  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      contentContainerClassName="p-3 gap-2"
      ListEmptyComponent={<EmptyState icon={BellOff} title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />}
      ListFooterComponent={footerNote ? <Text className="px-2 py-3 text-center text-[11px] text-slate-400">{footerNote}</Text> : undefined}
      renderItem={({ item }) => (
        <Pressable
          testID={`notification-${item.id}`}
          accessibilityRole="button"
          onPress={() => onOpen(item)}
          className={cn('rounded-2xl border p-3', item.read ? 'border-slate-200 bg-white' : item.tone === 'urgent' ? 'border-rose-200 bg-rose-50' : 'border-teal-200 bg-teal-50/60')}
        >
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row items-start gap-2">
              {!item.read ? <View className={cn('mt-1.5 h-2 w-2 rounded-full', item.tone === 'urgent' ? 'bg-rose-500' : 'bg-teal-500')} /> : null}
              {item.icon ? <item.icon size={15} color={item.tone === 'urgent' ? colors.danger : colors.slate600} /> : null}
              <Text className={cn('flex-1 text-sm', item.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900')}>{item.title}</Text>
            </View>
            <Text className="text-[10px] font-medium text-slate-400">{formatAgo(item.createdAt)}</Text>
          </View>
          {item.body ? <Text className="ml-4 mt-0.5 text-xs text-slate-600" numberOfLines={3}>{item.body}</Text> : undefined}
        </Pressable>
      )}
    />
  );
}
