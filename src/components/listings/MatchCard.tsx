import { Text, View } from 'react-native';
import { Check, Minus } from 'lucide-react-native';
import { Badge, Button, Card, type BadgeTone } from '@/components/ui';
import { formatINR } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export type ShortlistState = 'SUGGESTED' | 'SHORTLISTED' | 'SHARED' | 'INTERESTED' | 'NOT_SUITABLE' | 'VISITED';

const STATE_TONE: Record<ShortlistState, BadgeTone> = { SUGGESTED: 'slate', SHORTLISTED: 'teal', SHARED: 'blue', INTERESTED: 'emerald', NOT_SUITABLE: 'rose', VISITED: 'indigo' };

export interface MatchCardProps {
  id: string;
  title: string;
  subtitle?: string;
  price?: number | null;
  rent?: number | null;
  score: number;
  /** Deterministic, explainable matching: why it scores high and where it differs. */
  reasons: string[];
  differences: string[];
  state?: ShortlistState | null;
  stateLabel?: string;
  /** FB-04: "Shared · WhatsApp · 10:42 AM" */
  sharedLine?: string | null;
  actions: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; testID?: string }[];
}

export function MatchCard(p: MatchCardProps) {
  const t = useT();
  const high = p.score >= 75;
  return (
    <Card testID={`match-${p.id}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-900">{p.title}</Text>
          {p.subtitle ? <Text className="text-xs text-slate-500">{p.subtitle}</Text> : null}
          {p.price || p.rent ? (
            <Text className="mt-0.5 text-xs font-bold text-teal-800">{p.price ? formatINR(p.price) : `${formatINR(p.rent)}/mo`}</Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          <View className={cn('rounded-xl px-2 py-1', high ? 'bg-emerald-600' : 'bg-slate-200')}>
            <Text className={cn('text-sm font-extrabold', high ? 'text-white' : 'text-slate-700')} style={{ fontVariant: ['tabular-nums'] }}>
              {Math.round(p.score)}
            </Text>
          </View>
          {p.state ? <Badge label={p.stateLabel ?? p.state} tone={STATE_TONE[p.state] ?? 'slate'} /> : null}
          {p.sharedLine ? <Text testID={`shared-${p.id}`} className="text-[10px] font-semibold text-blue-800">{p.sharedLine}</Text> : null}
        </View>
      </View>
      <View className="mt-2.5 gap-1">
        {p.reasons.map((r) => (
          <View key={r} className="flex-row items-start gap-1.5">
            <Check size={12} color={colors.ok} strokeWidth={3} />
            <Text className="flex-1 text-[11px] text-slate-700">{r}</Text>
          </View>
        ))}
        {p.differences.map((r) => (
          <View key={r} className="flex-row items-start gap-1.5">
            <Minus size={12} color={colors.warn} strokeWidth={3} />
            <Text className="flex-1 text-[11px] text-amber-900">{r}</Text>
          </View>
        ))}
        {!p.reasons.length && !p.differences.length ? <Text className="text-[11px] text-slate-400">{t('matches.noReasons')}</Text> : null}
      </View>
      {p.actions.length ? (
        <View className="mt-3 flex-row flex-wrap gap-2 border-t border-slate-100 pt-3">
          {p.actions.map((a) => (
            <Button key={a.label} testID={a.testID} size="sm" variant={a.variant ?? 'secondary'} label={a.label} onPress={a.onPress} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
