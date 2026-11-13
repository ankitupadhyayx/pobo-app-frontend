import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Card, ErrorState, ListSkeleton } from '@/components/ui';
import { useConfig, useLabels } from '@/api/hooks/config';
import { useT } from '@/i18n';

/** Every in-app term, from the GLOSSARY master list (founder's note: all terms in the glossary). */
export default function GlossaryScreen() {
  const t = useT();
  const router = useRouter();
  const cfg = useConfig();
  const L = useLabels();
  const items = cfg.data?.master_lists?.GLOSSARY ?? [];
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('profile.glossary')} />
      <ScrollView contentContainerClassName="p-4 gap-2 pb-12">
        {cfg.isPending ? (
          <ListSkeleton count={2} />
        ) : cfg.error && !cfg.data ? (
          <ErrorState error={cfg.error} onRetry={() => cfg.refetch()} />
        ) : (
          items.map((g) => {
            const def = (g.metadata as { definition?: string } | null)?.definition;
            return (
              <Card key={g.code}>
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text className="text-sm font-bold text-slate-900">{L.hi ? g.label_hi || g.label : g.label}</Text>
                  {L.hi ? null : <Text className="text-xs text-slate-400">{g.label_hi}</Text>}
                </View>
                {def ? <Text className="mt-1 text-xs text-slate-600">{def}</Text> : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
