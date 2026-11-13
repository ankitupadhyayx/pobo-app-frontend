import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

interface AppHeaderProps {
  territory?: string;
  dutyLabel: string;
  onDuty: boolean;
  unavailable?: boolean;
  unread: number;
  initials: string;
  onBell: () => void;
  onAvatar: () => void;
  onDutyPress: () => void;
  onBack?: () => void;
  title?: string;
}

/** Sticky top bar: brand/back, duty status pill, notification bell, avatar (profile drawer). */
export function AppHeader(p: AppHeaderProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View className="border-b border-slate-200 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <View className="flex-1 flex-row items-center gap-2">
          {p.onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={10} onPress={p.onBack} className="-ml-1.5 p-1.5">
              <ChevronLeft size={22} color={colors.slate700} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-teal-600">
              <Text className="text-sm font-bold text-white">P</Text>
            </View>
          )}
          <View className="flex-1">
            {p.title ? (
              <Text className="text-base font-extrabold text-slate-900" numberOfLines={1}>
                {p.title}
              </Text>
            ) : (
              <>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-base font-extrabold tracking-tight text-slate-900">POBO</Text>
                  <View className="rounded border border-teal-200/60 bg-teal-50 px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold tracking-wider text-teal-700">AA</Text>
                  </View>
                </View>
                {p.territory ? (
                  <Text className="-mt-0.5 text-[10px] font-medium text-slate-500" numberOfLines={1}>
                    {p.territory}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            testID="header-duty"
            accessibilityRole="button"
            accessibilityLabel={p.dutyLabel}
            onPress={p.onDutyPress}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full border px-2.5 py-1',
              p.unavailable ? 'border-amber-300 bg-amber-50' : p.onDuty ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-100',
            )}
          >
            <View className={cn('h-2 w-2 rounded-full', p.unavailable ? 'bg-amber-500' : p.onDuty ? 'bg-emerald-500' : 'bg-slate-400')} />
            <Text className={cn('text-xs font-semibold', p.unavailable ? 'text-amber-900' : p.onDuty ? 'text-emerald-800' : 'text-slate-600')} numberOfLines={1}>
              {p.dutyLabel}
            </Text>
          </Pressable>
          <Pressable testID="header-bell" accessibilityRole="button" accessibilityLabel={`${t('header.notifications')} (${p.unread})`} onPress={p.onBell} className="relative rounded-full p-1.5">
            <Bell size={20} color={colors.slate700} />
            {p.unread > 0 ? (
              <View className="absolute right-0.5 top-0.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-[10px] font-bold text-white">{p.unread > 99 ? '99+' : p.unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            testID="header-avatar"
            accessibilityRole="button"
            accessibilityLabel={t('header.profile')}
            onPress={p.onAvatar}
            className="h-8 w-8 items-center justify-center rounded-full border border-teal-300 bg-teal-100"
          >
            <Text className="text-xs font-bold text-teal-800">{p.initials}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
