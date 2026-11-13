import { ActivityIndicator, Text, View } from 'react-native';
import { Button, ErrorState } from '@/components/ui';

export function BootScreen({ error, onRetry, onLogout }: { error?: unknown; onRetry?: () => void; onLogout?: () => void } = {}) {
  if (error) {
    return (
      <View className="flex-1 justify-center gap-3 bg-slate-100 p-6">
        <ErrorState error={error} onRetry={onRetry} />
        {onLogout ? <Button variant="ghost" label="Log out" onPress={onLogout} /> : null}
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center bg-teal-950">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-teal-600">
        <Text className="text-2xl font-extrabold text-white">P</Text>
      </View>
      <Text className="mt-3 text-lg font-extrabold tracking-tight text-white">POBO</Text>
      <ActivityIndicator className="mt-6" color="#5eead4" />
    </View>
  );
}
