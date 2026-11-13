import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  const [o] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.View style={{ opacity: o }}>
      <View className={cn('rounded-lg bg-slate-200', className)} />
    </Animated.View>
  );
}

/** Placeholder matching a lead/action card while the first page loads. */
export function CardSkeleton() {
  return (
    <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-2 h-10 w-full rounded-xl" />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}
