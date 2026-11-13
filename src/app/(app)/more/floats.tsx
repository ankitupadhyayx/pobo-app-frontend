import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { FloatCard } from '@/components/home/FloatCard';
import { EmptyState, ErrorState, InlineBanner, ListSkeleton } from '@/components/ui';
import { useClaimFloat, useMyFloats } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { ApiError, errorMessage } from '@/api/errors';
import type { Float } from '@/api/types';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** All open territory floats offered to me (Home "Territory" → View all). */
export default function FloatsScreen() {
  const t = useT();
  const router = useRouter();
  const { float: focusId } = useLocalSearchParams<{ float?: string }>();
  const L = useLabels();
  const floats = useMyFloats();
  const claim = useClaimFloat();
  const [result, setResult] = useState<Record<string, { result: 'won' | 'lost' | null; error?: string }>>({});

  const onClaim = async (f: Float) => {
    try {
      const req = await claim.mutateAsync(f.id);
      setResult((r) => ({ ...r, [f.id]: { result: 'won' } }));
      analytics.track('territory_float_claimed', { float_id: f.id, result: 'won' });
      setTimeout(() => router.replace({ pathname: '/lead/[id]', params: { id: req.relationship_id, requirement: req.id } }), 600);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        setResult((r) => ({ ...r, [f.id]: { result: 'lost' } }));
        analytics.track('territory_float_lost', { float_id: f.id, reason_code: e.code });
      } else {
        setResult((r) => ({ ...r, [f.id]: { result: null, error: errorMessage(e) } }));
      }
    }
  };

  const rows = floats.data?.results ?? [];
  // Opened from a notification for a float that is no longer offered (claimed by another AA or expired).
  const gone = !!focusId && !!floats.data && !rows.some((f) => f.id === focusId) && !result[focusId];

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('floats.title')} />
      {floats.isPending ? (
        <View className="p-4">
          <ListSkeleton count={3} />
        </View>
      ) : floats.error && !floats.data ? (
        <View className="p-4">
          <ErrorState error={floats.error} onRetry={() => floats.refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(f) => f.id}
          contentContainerClassName="p-4 pb-10 gap-3"
          ListHeaderComponent={gone ? <InlineBanner testID="float-gone" tone="info">{t('floats.gone')}</InlineBanner> : undefined}
          refreshControl={<RefreshControl refreshing={floats.isRefetching} onRefresh={() => void floats.refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
          renderItem={({ item: f }) => (
            <FloatCard
              testID={`float-${f.id}`}
              title={[L.enumLabel('requirement_type', f.requirement_type), f.society_name ?? f.locality_name].filter(Boolean).join(' · ')}
              context={[L.master('CONFIGURATION', f.configuration), f.distance_km != null ? `${f.distance_km.toFixed(1)} km` : null].filter(Boolean).join(' · ')}
              expiresAt={f.expires_at}
              claiming={claim.isPending && claim.variables === f.id}
              result={result[f.id]?.result ?? null}
              error={result[f.id]?.error}
              onClaim={() => onClaim(f)}
            />
          )}
          ListEmptyComponent={<EmptyState icon={MapPin} title={t('floats.emptyTitle')} body={t('floats.emptyBody')} />}
        />
      )}
    </View>
  );
}
