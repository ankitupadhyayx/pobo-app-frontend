import { Text, View } from 'react-native';
import { ArrowRight, Lock } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { formatDuration } from '@/lib/time';
import { useT } from '@/i18n';

interface FloatCardProps {
  title: string;
  context?: string;
  expiresAt?: string | null;
  onClaim: () => void;
  claiming?: boolean;
  /** Inline outcome after a claim attempt. */
  result?: 'won' | 'lost' | null;
  error?: string | null;
  testID?: string;
}

/** Territory Float offer (blueprint §7.3): masked until claimed, live acceptance window. */
export function FloatCard({ title, context, expiresAt, onClaim, claiming, result, error, testID }: FloatCardProps) {
  const t = useT();
  const now = useNow();
  const left = expiresAt ? Date.parse(expiresAt) - now : null;
  const expired = left !== null && left <= 0;
  return (
    <View testID={testID} className="gap-3 rounded-3xl border border-amber-600/40 bg-amber-900 p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <Text className="text-[10px] font-black uppercase tracking-wider text-amber-300">{t('home.floatTitle')}</Text>
        </View>
        {left !== null ? (
          <View className="rounded-full border border-amber-400/40 bg-amber-500/30 px-2 py-0.5">
            <Text className="text-[10px] font-bold text-amber-100" style={{ fontVariant: ['tabular-nums'] }}>
              {expired ? t('home.floatExpired') : t('home.floatWindow', { time: formatDuration(left) })}
            </Text>
          </View>
        ) : null}
      </View>
      <View>
        <Text className="text-base font-extrabold text-white">{title}</Text>
        {context ? <Text className="mt-0.5 text-xs text-amber-100/80">{context}</Text> : null}
      </View>
      <View className="flex-row items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3">
        <Lock size={14} color="#fcd34d" />
        <Text className="flex-1 text-xs text-amber-100">{t('home.floatMasked')}</Text>
      </View>
      {result === 'lost' ? (
        <Text className="rounded-xl bg-black/30 p-3 text-xs font-semibold text-amber-100">{t('home.floatLost')}</Text>
      ) : result === 'won' ? (
        <Text className="rounded-xl bg-emerald-900/60 p-3 text-xs font-semibold text-emerald-100">{t('home.floatWon')}</Text>
      ) : (
        <>
          {error ? <Text className="text-xs font-semibold text-rose-200">{error}</Text> : null}
          <Button variant="float" fullWidth icon={ArrowRight} iconRight label={t('home.floatClaim')} loading={claiming} disabled={expired} onPress={onClaim} />
        </>
      )}
    </View>
  );
}
