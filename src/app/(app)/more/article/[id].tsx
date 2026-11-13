import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Button, Card, ErrorState, ListSkeleton } from '@/components/ui';
import { useHelpArticle } from '@/api/hooks/phase3';
import { useLabels } from '@/api/hooks/config';
import { useT } from '@/i18n';

/** Simple Markdown-ish rendering: `#` headings, `-`/`*` bullets, blank-line paragraphs, **bold** markers stripped. */
function Body({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View className="gap-1.5">
      {lines.map((raw, i) => {
        const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').trimEnd();
        if (!line.trim()) return <View key={i} className="h-1.5" />;
        const h = /^#{1,6}\s+(.*)$/.exec(line);
        if (h) return <Text key={i} className="mt-1 text-base font-bold text-slate-900">{h[1]}</Text>;
        const b = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
        if (b)
          return (
            <View key={i} className="flex-row gap-2 pl-1">
              <Text className="text-sm text-teal-700">•</Text>
              <Text className="flex-1 text-sm leading-5 text-slate-700">{b[1]}</Text>
            </View>
          );
        return <Text key={i} className="text-sm leading-5 text-slate-700">{line}</Text>;
      })}
    </View>
  );
}

export default function ArticleScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useHelpArticle(id ?? '');
  const a = q.data;
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('profile.learn')} />
      <ScrollView contentContainerClassName="p-4 gap-4 pb-12">
        {q.isPending ? (
          <ListSkeleton count={1} />
        ) : !a ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <Card>
              <Badge label={L.enumLabel('help_category', a.category) || a.category_label} tone="teal" />
              <Text testID="article-title" className="mt-2 text-lg font-extrabold text-slate-900">{a.title}</Text>
              {a.summary ? <Text className="mt-1 text-sm text-slate-600">{a.summary}</Text> : null}
              <View className="mt-3 border-t border-slate-100 pt-3">
                <Body text={a.body} />
              </View>
            </Card>
            <Button variant="secondary" label={t('help.stillStuck')} onPress={() => router.push({ pathname: '/more/learn', params: { tab: 'tickets' } })} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
