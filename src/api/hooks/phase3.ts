/** Phase 3: earnings (APP-31), My Week (APP-32), Learn & Help + support tickets (APP-33). */
import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { queryClient } from '../queryClient';
import type { components } from '../schema';

type S = components['schemas'];
export type Earnings = S['Earnings'];
export type EarningItem = S['EarningItem'];
export type EarningItemDetail = S['EarningItemDetail'];
export type EarningState = S['EarningItem']['state'];
export type PayoutHistory = S['PayoutHistory'];
export type MyWeek = S['MyWeek'];
export type Metric = S['Metric'];
export type HelpArticle = S['HelpArticle'];
export type HelpCategory = S['HelpArticle']['category'];
export type SupportTicket = S['SupportTicket'];
export type SupportTicketDetail = S['SupportTicketDetail'];
export type TicketCategory = S['SupportTicket']['category'];
export type TicketStatus = NonNullable<S['SupportTicket']['status']>;
export type DealStatus = S['DealStatus'];

export const TICKET_CATEGORIES: TicketCategory[] = ['APP_ISSUE', 'LEAD_ASSIGNMENT', 'LISTING', 'EARNINGS', 'TRAINING', 'OTHER'];

export const p3k = {
  earnings: (state?: EarningState) => (state ? (['earnings', state] as const) : (['earnings'] as const)),
  earning: (id: string) => ['earnings', 'item', id] as const,
  week: (start?: string) => ['week', start ?? 'current'] as const,
  articles: (f?: object) => (f ? (['help', 'articles', f] as const) : (['help', 'articles'] as const)),
  article: (id: string) => ['help', 'article', id] as const,
  tickets: ['tickets'] as const,
  ticket: (id: string) => ['tickets', id] as const,
};

export function useEarnings(state?: EarningState) {
  return useQuery({
    queryKey: p3k.earnings(state),
    queryFn: () => unwrap(api.GET('/api/v1/me/earnings', { params: { query: state ? { state } : {} } })),
  });
}

export function useEarningItem(id: string) {
  return useQuery({
    queryKey: p3k.earning(id),
    enabled: !!id,
    queryFn: () => unwrap(api.GET('/api/v1/me/earnings/{item_id}', { params: { path: { item_id: id } } })),
  });
}

export function useMyWeek(weekStart?: string) {
  return useQuery({
    queryKey: p3k.week(weekStart),
    queryFn: () => unwrap(api.GET('/api/v1/me/week', { params: { query: weekStart ? { week_start: weekStart } : {} } })),
  });
}

export interface ArticleFilters {
  category?: HelpCategory;
  language?: 'en' | 'hi';
  search?: string;
}

export function useHelpArticles(f: ArticleFilters) {
  return useQuery({
    queryKey: p3k.articles(f),
    queryFn: () => {
      const query: ArticleFilters = {};
      if (f.category) query.category = f.category;
      if (f.language) query.language = f.language;
      if (f.search?.trim()) query.search = f.search.trim();
      return unwrap(api.GET('/api/v1/help/articles', { params: { query } }));
    },
  });
}

export function useHelpArticle(id: string) {
  return useQuery({
    queryKey: p3k.article(id),
    enabled: !!id,
    queryFn: () => unwrap(api.GET('/api/v1/help/articles/{id}', { params: { path: { id } } })),
  });
}

export function useMyTickets() {
  return useQuery({ queryKey: p3k.tickets, queryFn: () => unwrap(api.GET('/api/v1/me/support-tickets')) });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: p3k.ticket(id),
    enabled: !!id,
    queryFn: () => unwrap(api.GET('/api/v1/me/support-tickets/{id}', { params: { path: { id } } })),
  });
}

const storeTicket = (t: SupportTicketDetail) => {
  queryClient.setQueryData(p3k.ticket(t.id), t);
  void queryClient.invalidateQueries({ queryKey: p3k.tickets, exact: true });
};

export function useCreateTicket() {
  return useMutation({
    mutationFn: (body: S['SupportTicketCreateRequest']) => unwrap(api.POST('/api/v1/support-tickets', { body })),
    onSuccess: storeTicket,
  });
}

export function useReplyTicket(id: string) {
  return useMutation({
    mutationFn: (body: string) => unwrap(api.POST('/api/v1/support-tickets/{id}/replies', { params: { path: { id } }, body: { body } })),
    onSuccess: storeTicket,
  });
}

/** Server-provided bilingual text: pick Hindi when the UI is Hindi and the server sent it. */
export function pickHi(hi: boolean, en: string, hiText?: string | null): string {
  return hi && hiText ? hiText : en;
}
