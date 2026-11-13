import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '@/theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  headerRight?: ReactNode;
  children: ReactNode;
  testID?: string;
}

/** Full-height drawer (profile, notifications). Backdrop tap or Android back closes it. */
export function SideDrawer({ visible, onClose, title, side = 'right', headerRight, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className={side === 'right' ? 'flex-1 flex-row justify-end' : 'flex-1 flex-row'} testID={testID}>
        <Pressable accessibilityLabel="Close" className="absolute inset-0 bg-slate-900/50" onPress={onClose} />
        <View className="w-[86%] max-w-[380px] bg-white" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-3">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</Text>
            <View className="flex-row items-center gap-2">
              {headerRight}
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} className="p-1">
                <X size={20} color={colors.slate400} />
              </Pressable>
            </View>
          </View>
          <View className="flex-1">{children}</View>
        </View>
      </View>
    </Modal>
  );
}
