import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { cursorFrom, qk, toE164 } from '../keys';
import { queryClient } from '../queryClient';
import type { AddLeadRequest, CallInput, EscalationInput, FollowUpInput, ReferralInput, RequirementInput, TransferInput } from '../types';
import type { components, operations } from '../schema';

/** Refresh everything a lead action can change (Home ranking, list row, detail, timeline). */
export function invalidateLead(relationshipId?: string | null) {
  void queryClient.invalidateQueries({ queryKey: qk.home });
  void queryClient.invalidateQueries({ queryKey: qk.relationships() });
  void queryClient.invalidateQueries({ queryKey: qk.followUps() });
  if (relationshipId) void queryClient.invalidateQueries({ queryKey: qk.relationship(relationshipId) });
}

// ---------------------------------------------------------------- Home (APP-08)
export function useHome() {
  return useQuery({
    queryKey: qk.home,
    queryFn: () => unwrap(api.GET('/api/v1/me/home')),
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------- Leads list (APP-09)
export type RelationshipFilters = NonNullable<operations['v1_relationships_list']['parameters']['query']>;

export function useRelationships(filters: Omit<RelationshipFilters, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: qk.relationships(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/v1/relationships', { params: { query: { page_size: 20, ...filters, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
}

// ---------------------------------------------------------------- Lead detail (APP-10)
/** One requirement (FB-07 allowed_visit_types, FB-03 properties). */
export function useRequirement(id: string) {
  return useQuery({ queryKey: ['requirement', id], enabled: !!id, queryFn: () => unwrap(api.GET('/api/v1/requirements/{id}', { params: { path: { id } } })) });
}

export function useRelationship(id: string) {
  return useQuery({
    queryKey: qk.relationship(id),
    enabled: !!id,
    queryFn: () => unwrap(api.GET('/api/v1/relationships/{id}', { params: { path: { id } } })),
  });
}

export function useTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: qk.timeline(id),
    enabled: !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/v1/relationships/{id}/timeline', { params: { path: { id }, query: { page_size: 20, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
}

export function useAddNote(relationshipId: string) {
  return useMutation({
    mutationFn: (text: string) =>
      unwrap(api.POST('/api/v1/relationships/{id}/notes', { params: { path: { id: relationshipId } }, body: { text, client_id: uuid() } })),
    onSuccess: () => invalidateLead(relationshipId),
  });
}

// ---------------------------------------------------------------- Add lead / requirement (APP-11/12)
export function useLookup() {
  return useMutation({
    mutationFn: (phone10: string) => unwrap(api.GET('/api/v1/customers/lookup', { params: { query: { phone: toE164(phone10) } } })),
  });
}

export function useAddLead() {
  return useMutation({
    mutationFn: (body: AddLeadRequest) => unwrap(api.POST('/api/v1/relationships', { body })),
    onSuccess: (rel) => invalidateLead(rel.id),
  });
}

export function useAddRequirements() {
  return useMutation({
    mutationFn: ({ relationshipId, requirements }: { relationshipId: string; requirements: RequirementInput[] }) =>
      unwrap(api.POST('/api/v1/relationships/{id}/requirements', { params: { path: { id: relationshipId } }, body: { requirements } })),
    onSuccess: (_r, v) => invalidateLead(v.relationshipId),
  });
}

/** R3-2: edit a requirement (Complete requirement). `save_as_draft` false → 400 requirement_incomplete with `fields`. */
export function useUpdateRequirement(relationshipId: string) {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: components['schemas']['PatchedRequirementUpdateRequest'] }) =>
      unwrap(api.PATCH('/api/v1/requirements/{id}', { params: { path: { id } }, body })),
    onSuccess: (r) => {
      queryClient.setQueryData(['requirement', r.id], r);
      invalidateLead(relationshipId);
    },
  });
}

/** R3-2: mark a Draft complete (400 requirement_incomplete with `fields` if something is still missing). */
export function useCompleteRequirement(relationshipId: string) {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/api/v1/requirements/{id}/complete', { params: { path: { id } } })),
    onSuccess: () => invalidateLead(relationshipId),
  });
}

export function useDuplicateReview() {
  return useMutation({
    mutationFn: (body: components['schemas']['DuplicateReviewInputRequest']) => unwrap(api.POST('/api/v1/duplicate-reviews', { body })),
  });
}

// ---------------------------------------------------------------- Calls / follow-ups / messages (APP-13/14/17)
export function useLogCall(relationshipId: string) {
  return useMutation({
    mutationFn: ({ requirementId, body }: { requirementId: string; body: Omit<CallInput, 'client_id'> }) =>
      unwrap(api.POST('/api/v1/requirements/{id}/calls', { params: { path: { id: requirementId } }, body: { ...body, client_id: uuid() } })),
    onSuccess: () => invalidateLead(relationshipId),
  });
}

export function useScheduleFollowUp(relationshipId: string) {
  return useMutation({
    mutationFn: ({ requirementId, body }: { requirementId: string; body: Omit<FollowUpInput, 'client_id'> }) =>
      unwrap(api.POST('/api/v1/requirements/{id}/follow-ups', { params: { path: { id: requirementId } }, body: { ...body, client_id: uuid() } })),
    onSuccess: () => invalidateLead(relationshipId),
  });
}

export function useCompleteFollowUp() {
  return useMutation({
    mutationFn: ({ id, outcome, notes }: { id: string; outcome: string; notes?: string; relationshipId?: string | null }) =>
      unwrap(api.POST('/api/v1/follow-ups/{id}/complete', { params: { path: { id } }, body: { outcome, notes } })),
    onSuccess: (r, v) => invalidateLead(v.relationshipId ?? r.follow_up.relationship_id),
  });
}

export function usePendingFollowUps(requirementIds: string[]) {
  return useQuery({
    queryKey: qk.followUps({ requirementIds }),
    enabled: requirementIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        requirementIds.map((rid) =>
          unwrap(api.GET('/api/v1/me/follow-ups', { params: { query: { requirement_id: rid, status: ['PENDING'], page_size: 20 } } })),
        ),
      );
      return pages.flatMap((p) => p.results);
    },
  });
}

export function useTemplates() {
  return useQuery({ queryKey: qk.templates, staleTime: 10 * 60_000, queryFn: () => unwrap(api.GET('/api/v1/templates')) });
}

/** REQ-12: messages logged on a requirement (manual + automatic), newest first. Fetch only when shown. */
export function useRequirementCommunications(requirementId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.communications(requirementId),
    enabled: enabled && !!requirementId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/v1/requirements/{id}/communications', { params: { path: { id: requirementId }, query: { page_size: 20, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
}

export function useSendMessage(relationshipId: string) {
  return useMutation({
    mutationFn: ({ requirementId, body }: { requirementId: string; body: components['schemas']['CommunicationInputRequest'] }) =>
      unwrap(api.POST('/api/v1/requirements/{id}/communications', { params: { path: { id: requirementId } }, body })),
    onSuccess: (_d, { requirementId }) => {
      invalidateLead(relationshipId);
      void queryClient.invalidateQueries({ queryKey: qk.communications(requirementId) });
    },
  });
}

// ---------------------------------------------------------------- Transfer / referral / escalation (APP-15/16)
export function useRequestTransfer() {
  return useMutation({
    mutationFn: (body: TransferInput) => unwrap(api.POST('/api/v1/transfer-requests', { body })),
    onSuccess: (t) => {
      invalidateLead(t.relationship_id);
      void queryClient.invalidateQueries({ queryKey: qk.transfers });
    },
  });
}

export function useMyTransfers() {
  return useQuery({
    queryKey: qk.transfers,
    queryFn: () => unwrap(api.GET('/api/v1/me/transfer-requests', { params: { query: { page_size: 50 } } })),
  });
}

export function useReferral() {
  return useMutation({
    mutationFn: (body: ReferralInput) => unwrap(api.POST('/api/v1/referrals', { body })),
    onSuccess: () => invalidateLead(),
  });
}

export function useEscalate() {
  return useMutation({
    mutationFn: (body: EscalationInput) => unwrap(api.POST('/api/v1/escalations', { body })),
    onSuccess: (e) => invalidateLead(e.relationship_id),
  });
}

// ---------------------------------------------------------------- Territory float (APP-18)
export function useMyFloats() {
  return useQuery({
    queryKey: qk.floats,
    queryFn: () => unwrap(api.GET('/api/v1/me/floats', { params: { query: { page_size: 20 } } })),
    refetchInterval: 30_000,
  });
}

export function useClaimFloat() {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/api/v1/floats/{id}/claim', { params: { path: { id } } })),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.floats });
      invalidateLead();
    },
  });
}

// ---------------------------------------------------------------- Societies (Add Lead picker)
export function useSocietySearch(q: string) {
  return useQuery({
    queryKey: qk.societies(q),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
    queryFn: () => unwrap(api.GET('/api/v1/geo/societies', { params: { query: { search: q.trim(), page_size: 10 } } })),
  });
}

/** RFC4122 v4 idempotency key (client_id) without a native crypto dependency. */
export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ------------------------------------------------------------- R2-10 Locality Master (sectors)
export type LocalityOption = components['schemas']['Locality'];
/** Searches name / aliases / "sec 150" / "150"; unpaginated, sorted by sector number. */
export function useLocalities(search: string) {
  const q = search.trim();
  return useQuery({
    queryKey: ['localities', q],
    enabled: q.length >= 1,
    staleTime: 10 * 60_000,
    queryFn: () => unwrap(api.GET('/api/v1/geo/localities', { params: { query: { search: q } } })),
  });
}
