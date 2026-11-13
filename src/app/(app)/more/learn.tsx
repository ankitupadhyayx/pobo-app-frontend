import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, LifeBuoy, MessageSquare } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Button, Card, Chips, EmptyState, ErrorState, ListSkeleton, TextField } from '@/components/ui';
import { RaiseTicketSheet, TICKET_TONE, type TicketLink } from '@/components/help/RaiseTicketSheet';
import { p3k, TICKET_CATEGORIES, useHelpArticles, useMyTickets, type HelpCategory, type TicketCategory } from '@/api/hooks/phase3';
import { queryClient } from '@/api/queryClient';
import { useLabels } from '@/api/hooks/config';
import { formatAgo } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

function Articles() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const [language, setLanguage] = useState<'en' | 'hi'>(L.hi ? 'hi' : 'en');
  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [search, setSearch] = useState('');
  const q = useHelpArticles({ language, category: category ?? undefined, search });
  // Categories come from the articles the server has (label from the server, not hard-coded).
  const all = useHelpArticles({ language });
  const cats = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of all.data ?? []) if (!m.has(a.category)) m.set(a.category, a.category_label);
    return [...m.entries()].map(([value, label]) => ({ value, label: L.enumLabel('help_category', value) || label }));
  }, [all.data, L]);
  const articles = q.data ?? [];
  return (
    <View className="gap-3">
      <Chips
        testIDPrefix="help-lang"
        options={[
          { value: 'hi', label: 'हिंदी' },
          { value: 'en', label: 'English' },
        ]}
        value={language}
        allowDeselect={false}
        onChange={(v) => setLanguage(v as 'en' | 'hi')}
      />
      <TextField testID="help-search" placeholder={t('help.search')} value={search} onChangeText={setSearch} returnKeyType="search" />
      {cats.length > 1 ? <Chips scroll testIDPrefix="help-cat" options={cats} value={category} onChange={(v) => setCategory(v as HelpCategory | null)} /> : null}
      {q.isPending ? (
        <ListSkeleton count={3} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : articles.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('help.noArticles')} body={t('help.noArticlesBody')} />
      ) : (
        articles.map((a) => (
          <Card key={a.id} testID={`article-${a.slug}`} onPress={() => router.push({ pathname: '/more/article/[id]', params: { id: a.id } })}>
            <Badge label={L.enumLabel('help_category', a.category) || a.category_label} tone="teal" />
            <Text className="mt-2 text-sm font-bold text-slate-900">{a.title}</Text>
            {a.summary ? <Text className="mt-0.5 text-xs text-slate-600">{a.summary}</Text> : null}
            {a.language !== language ? <Text className="mt-1 text-[11px] italic text-slate-500">{t('help.englishOnly')}</Text> : null}
          </Card>
        ))
      )}
    </View>
  );
}

function Tickets({ initialCategory, link, autoOpen }: { initialCategory?: TicketCategory; link?: TicketLink; autoOpen: boolean }) {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const q = useMyTickets();
  const [raise, setRaise] = useState(autoOpen);
  const tickets = q.data ?? [];
  return (
    <View className="gap-3">
      <Button testID="ticket-raise" icon={LifeBuoy} label={t('help.raise')} onPress={() => setRaise(true)} />
      {q.isPending ? (
        <ListSkeleton count={2} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : tickets.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('help.noTickets')} body={t('help.noTicketsBody')} />
      ) : (
        tickets.map((tk) => (
          <Card key={tk.id} testID={`ticket-${tk.reference}`} onPress={() => router.push({ pathname: '/more/ticket/[id]', params: { id: tk.id } })}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-xs font-bold text-slate-500">{tk.reference}</Text>
              <Badge label={L.enumLabel('ticket_status', tk.status) || tk.status_label} tone={TICKET_TONE[tk.status ?? 'OPEN']} />
            </View>
            <Text className="mt-1.5 text-sm font-bold text-slate-900">{tk.subject || tk.message}</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {L.enumLabel('ticket_category', tk.category) || tk.category_label} · {t('help.replies', { count: tk.reply_count })} · {formatAgo(tk.last_reply_at || tk.updated_at)}
            </Text>
          </Card>
        ))
      )}
      {raise ? (
        <RaiseTicketSheet
          initialCategory={initialCategory}
          link={link}
          onClose={() => setRaise(false)}
          onCreated={(tk) => router.push({ pathname: '/more/ticket/[id]', params: { id: tk.id } })}
        />
      ) : null}
    </View>
  );
}

/** APP-33 Learn & Help: articles by category and language, support tickets with status and replies. */
export default function LearnScreen() {
  const t = useT();
  const router = useRouter();
  const p = useLocalSearchParams<{ tab?: string; category?: string; relationship_id?: string; requirement_id?: string; listing_id?: string }>();
  const [tab, setTab] = useState<'articles' | 'tickets'>(p.tab === 'tickets' ? 'tickets' : 'articles');
  const cat = TICKET_CATEGORIES.includes(p.category as TicketCategory) ? (p.category as TicketCategory) : undefined;
  const link: TicketLink | undefined = p.relationship_id || p.requirement_id || p.listing_id ? { relationship_id: p.relationship_id, requirement_id: p.requirement_id, listing_id: p.listing_id } : undefined;
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('profile.learn')} />
      <ScrollView
        contentContainerClassName="p-4 gap-3 pb-12"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void Promise.all([queryClient.invalidateQueries({ queryKey: p3k.articles() }), queryClient.invalidateQueries({ queryKey: p3k.tickets })])} tintColor={colors.brand} />}
      >
        <Chips
          testIDPrefix="help-tab"
          options={[
            { value: 'articles', label: t('help.articles') },
            { value: 'tickets', label: t('help.tickets') },
          ]}
          value={tab}
          allowDeselect={false}
          onChange={(v) => setTab(v as 'articles' | 'tickets')}
        />
        {tab === 'articles' ? <Articles /> : <Tickets initialCategory={cat} link={link} autoOpen={p.tab === 'tickets' && !!cat} />}
      </ScrollView>
    </View>
  );
}
