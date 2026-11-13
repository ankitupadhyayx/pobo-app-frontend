import { Pressable, Text, View } from 'react-native';

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mb-2 flex-row items-center justify-between px-1">
      <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress}>
          <Text className="text-xs font-semibold text-teal-700">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
