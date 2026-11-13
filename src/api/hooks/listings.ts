import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '../client';
import { api } from '../instance';
import { queryClient } from '../queryClient';
import { invalidateLead } from './leads';
import { toApiError } from '../errors';
import type { components, operations } from '../schema';
import type { LocalPhoto } from '@/lib/photos';
import { nativeUploader, type NativeUploader } from '@/lib/nativeUpload';

type S = components['schemas'];
export type Listing = S['Listing'];
export type Key = S['Key'];
export type Match = S['Match'];
export type ShortlistItem = S['ShortlistItem'];
export type Visit = S['Visit'];

export const lk = {
  listings: (f?: object) => (f ? (['listings', f] as const) : (['listings'] as const)),
  listing: (id: string) => ['listing', id] as const,
  keys: ['keys'] as const,
  matches: (rid: string) => ['matches', rid] as const,
  shortlist: (rid: string) => ['shortlist', rid] as const,
  visits: (bucket?: string) => (bucket ? (['visits', bucket] as const) : (['visits'] as const)),
  visit: (id: string) => ['visit', id] as const,
};

const refreshListing = (l: Listing) => {
  queryClient.setQueryData(lk.listing(l.id), l);
  void queryClient.invalidateQueries({ queryKey: lk.listings() });
  if (l.unit) void queryClient.invalidateQueries({ queryKey: ['unit', l.unit.id] });
  void queryClient.invalidateQueries({ queryKey: ['mapping', 'tower'] });
  void queryClient.invalidateQueries({ queryKey: ['fieldTasks'] });
};

/** After the outbox syncs listing drafts or keys, refetch what they change. */
export function invalidateAfterSync(items: { type: string; entity: string; entityId: string }[]) {
  if (items.some((i) => i.type.startsWith('listing_draft.'))) void queryClient.invalidateQueries({ queryKey: lk.listings() });
  for (const i of items) if (i.entity === 'listing') void queryClient.invalidateQueries({ queryKey: lk.listing(i.entityId) });
  if (items.some((i) => i.type.startsWith('key.'))) {
    void queryClient.invalidateQueries({ queryKey: lk.keys });
    // FB-08: recording a key taken/returned closes the collect/return task on the server.
    void queryClient.invalidateQueries({ queryKey: ['fieldTasks'] });
    void queryClient.invalidateQueries({ queryKey: ['home'] });
    void queryClient.invalidateQueries({ queryKey: lk.visits() });
  }
}

// ------------------------------------------------------------- listings (APP-26)
export type ListingFilters = NonNullable<operations['v1_listings_list']['parameters']['query']>;

export function useListings(filters: ListingFilters) {
  return useQuery({ queryKey: lk.listings(filters), queryFn: () => unwrap(api.GET('/api/v1/listings', { params: { query: { page_size: 50, ...filters } } })) });
}

export function useListing(id: string) {
  return useQuery({ queryKey: lk.listing(id), enabled: !!id, queryFn: () => unwrap(api.GET('/api/v1/listings/{id}', { params: { path: { id } } })) });
}

export function useCreateListing() {
  return useMutation({ mutationFn: (body: S['ListingInputRequest']) => unwrap(api.POST('/api/v1/listings', { body })), onSuccess: refreshListing });
}

export function useSubmitListing() {
  return useMutation({ mutationFn: (id: string) => unwrap(api.POST('/api/v1/listings/{id}/submit', { params: { path: { id } } })), onSuccess: refreshListing });
}

export function useWithdrawListing() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.POST('/api/v1/listings/{id}/withdraw', { params: { path: { id } }, body: { reason } })),
    onSuccess: refreshListing,
  });
}

export function useDeletePhoto(listingId: string) {
  return useMutation({
    mutationFn: async (photoId: string) => {
      const r = await api.DELETE('/api/v1/listings/{id}/photos/{photo_id}', { params: { path: { id: listingId, photo_id: photoId } } });
      if (!r.response.ok) throw toApiError(r.response.status, r.error);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: lk.listing(listingId) }),
  });
}

export interface LocalMedia {
  uri: string;
  mime: string;
  kind: 'PHOTO' | 'VIDEO';
}

export interface UploadOpts {
  /** 0..1 for this file (direct PUT, then the proxy if that fails). */
  onProgress?: (fraction: number) => void;
  /** Injected in tests; the native Expo uploader on the phone. */
  uploader?: NativeUploader;
}

const okStatus = (s: number) => s >= 200 && s < 300;
const parseBody = (b: string) => {
  try {
    return JSON.parse(b) as unknown;
  } catch {
    return null;
  }
};

/**
 * APP-25 / R2-6 / R3-4 upload (needs a connection): presign → PUT the file straight to storage
 * with the native uploader; if that fails (phone can't reach storage, e.g. LAN URL over a tunnel)
 * PUT it through the API's `proxy_url` instead → returns the upload id to attach.
 */
export async function putUpload(media: LocalMedia, opts: UploadOpts = {}): Promise<string> {
  const up = opts.uploader ?? nativeUploader;
  const purpose = media.kind === 'VIDEO' ? 'LISTING_VIDEO' : 'LISTING_PHOTO';
  const pre = await unwrap(api.POST('/api/v1/uploads/presign', { body: { purpose, content_type: media.mime, size_bytes: up.size(media.uri) } }));
  const method = (['PUT', 'POST', 'PATCH'].includes((pre.method || 'PUT').toUpperCase()) ? (pre.method || 'PUT').toUpperCase() : 'PUT') as 'PUT';
  let ok = false;
  try {
    ok = okStatus((await up.upload(media.uri, pre.url, { method, headers: { 'Content-Type': media.mime, ...pre.headers }, mime: media.mime, onProgress: opts.onProgress })).status);
  } catch {
    ok = false;
  }
  if (!ok && pre.proxy_url) {
    opts.onProgress?.(0);
    let res: { status: number; body: string };
    try {
      res = await up.upload(media.uri, pre.proxy_url, { method: 'PUT', headers: { 'Content-Type': media.mime }, mime: media.mime, onProgress: opts.onProgress });
    } catch {
      throw toApiError(0, null);
    }
    if (!okStatus(res.status)) throw toApiError(res.status, parseBody(res.body));
    ok = true;
  }
  if (!ok) throw toApiError(0, null);
  opts.onProgress?.(1);
  return pre.upload_id;
}

export async function uploadListingPhoto(listingId: string, photo: LocalPhoto | LocalMedia, opts: { caption?: string; isCover?: boolean; onProgress?: (f: number) => void } = {}) {
  const media: LocalMedia = 'kind' in photo ? photo : { uri: photo.uri, mime: photo.mime, kind: 'PHOTO' };
  const uploadId = await putUpload(media, { onProgress: opts.onProgress });
  const attached = await unwrap(api.POST('/api/v1/listings/{id}/photos', { params: { path: { id: listingId } }, body: { upload_id: uploadId, caption: opts.caption, is_cover: !!opts.isCover } }));
  void queryClient.invalidateQueries({ queryKey: lk.listing(listingId) });
  return attached;
}

/** R2-6: media taken during an Inspection / Photography visit is saved on that visit's property. */
export async function uploadVisitMedia(visit: { id: string; media?: { listing_id: string | null } | null }, media: LocalMedia, opts: { isCover?: boolean; onProgress?: (f: number) => void } = {}) {
  const uploadId = await putUpload(media, { onProgress: opts.onProgress });
  const attached = await unwrap(api.POST('/api/v1/visits/{id}/media', { params: { path: { id: visit.id } }, body: { upload_id: uploadId, is_cover: !!opts.isCover } }));
  void queryClient.invalidateQueries({ queryKey: lk.visits() });
  void queryClient.invalidateQueries({ queryKey: lk.visit(visit.id) });
  if (visit.media?.listing_id) void queryClient.invalidateQueries({ queryKey: lk.listing(visit.media.listing_id) });
  return attached;
}

/** Choose the cover / reorder / caption (R2-6). */
export function useUpdatePhoto(listingId: string) {
  return useMutation({
    mutationFn: ({ photoId, body }: { photoId: string; body: S['PatchedPhotoUpdateRequest'] }) =>
      unwrap(api.PATCH('/api/v1/listings/{id}/photos/{photo_id}', { params: { path: { id: listingId, photo_id: photoId } }, body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: lk.listing(listingId) }),
  });
}

// ------------------------------------------------------------- keys (APP-28)
export function useMyKeys(status: 'HELD' | 'all' = 'HELD') {
  return useQuery({ queryKey: [...lk.keys, status], queryFn: () => unwrap(api.GET('/api/v1/me/keys', { params: { query: { status } } })) });
}

// ------------------------------------------------------------- matching + shortlist (APP-29)
export function useMatches(requirementId: string) {
  return useQuery({ queryKey: lk.matches(requirementId), enabled: !!requirementId, queryFn: () => unwrap(api.GET('/api/v1/requirements/{id}/matches', { params: { path: { id: requirementId } } })) });
}

export function useShortlist(requirementId: string) {
  return useQuery({ queryKey: lk.shortlist(requirementId), enabled: !!requirementId, queryFn: () => unwrap(api.GET('/api/v1/requirements/{id}/shortlist', { params: { path: { id: requirementId } } })) });
}

const refreshMatching = (rid: string) => {
  void queryClient.invalidateQueries({ queryKey: lk.matches(rid) });
  void queryClient.invalidateQueries({ queryKey: lk.shortlist(rid) });
};

export function useAddToShortlist(requirementId: string) {
  return useMutation({
    // FB-04: the AA picking a listing for this customer makes it SHORTLISTED (Matched stays SUGGESTED).
    mutationFn: (listingId: string) => unwrap(api.POST('/api/v1/requirements/{id}/shortlist', { params: { path: { id: requirementId } }, body: { listing_id: listingId, status: 'SHORTLISTED' } })),
    onSuccess: () => refreshMatching(requirementId),
  });
}

export function useUpdateShortlist(requirementId: string) {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['PatchedShortlistUpdateRequest'] }) => unwrap(api.PATCH('/api/v1/shortlist/{id}', { params: { path: { id } }, body })),
    onSuccess: () => refreshMatching(requirementId),
  });
}

// ------------------------------------------------------------- visits (APP-30)
/** R3-7: `past` = completed + no-show; `no_show` alone; `cancelled` no longer includes no-shows. */
export type VisitBucket = 'today' | 'upcoming' | 'completed' | 'past' | 'no_show' | 'cancelled';

export function useMyVisits(bucket: VisitBucket) {
  return useQuery({ queryKey: lk.visits(bucket), queryFn: () => unwrap(api.GET('/api/v1/me/visits', { params: { query: { bucket } } })) });
}

const refreshVisits = (v?: Visit) => {
  void queryClient.invalidateQueries({ queryKey: lk.visits() });
  void queryClient.invalidateQueries({ queryKey: ['home'] });
  if (v) {
    queryClient.setQueryData(lk.visit(v.id), v);
    invalidateLead(v.relationship_id ?? undefined);
    if (v.requirement_id) refreshMatching(v.requirement_id);
  }
};

export function useScheduleVisit(requirementId: string) {
  return useMutation({
    mutationFn: (body: S['VisitInputRequest']) => unwrap(api.POST('/api/v1/requirements/{id}/visits', { params: { path: { id: requirementId } }, body })),
    onSuccess: refreshVisits,
  });
}

export function useCompleteVisit() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['CompleteRequest'] }) => unwrap(api.POST('/api/v1/visits/{id}/complete', { params: { path: { id } }, body })),
    onSuccess: refreshVisits,
  });
}

export function useCancelVisit() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['CancelRequest'] }) => unwrap(api.POST('/api/v1/visits/{id}/cancel', { params: { path: { id } }, body })),
    onSuccess: (r: S['CancelResult']) => {
      refreshVisits(r.visit);
      if (r.replacement) refreshVisits(r.replacement);
    },
  });
}

export function useRescheduleVisit() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['RescheduleRequest'] }) => unwrap(api.POST('/api/v1/visits/{id}/reschedule', { params: { path: { id } }, body })),
    onSuccess: refreshVisits,
  });
}

/** R3-7: who was absent, reason, next step (RESCHEDULE books a new visit, FOLLOW_UP creates a follow-up). */
export function useNoShow() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: S['NoShowRequest'] }) => unwrap(api.POST('/api/v1/visits/{id}/no-show', { params: { path: { id } }, body })),
    onSuccess: (v) => {
      refreshVisits(v);
      void queryClient.invalidateQueries({ queryKey: ['followUps'] });
    },
  });
}

// ------------------------------------------------------------- Revision 1
export type RequirementProperty = S['RequirementProperty'];
export type ShareChannel = S['ShareChannelEnum'];
export type VisitType = S['VisitTypeEnum'];

/** FB-04: record that shortlisted items were shared with the customer (after the phone's share sheet). */
export function useRecordShare(requirementId: string) {
  return useMutation({
    mutationFn: (body: S['ShareInputRequest']) => unwrap(api.POST('/api/v1/requirements/{id}/shares', { params: { path: { id: requirementId } }, body })),
    onSuccess: () => {
      refreshMatching(requirementId);
      invalidateLead();
      void queryClient.invalidateQueries({ queryKey: ['relationship'] });
    },
  });
}

/** FB-03: add a property (listing) to a SELL / RENT_OUT requirement. */
export function useRequirementListings(requirementId: string) {
  return useQuery({ queryKey: ['requirementListings', requirementId], enabled: !!requirementId, queryFn: () => unwrap(api.GET('/api/v1/requirements/{id}/listings', { params: { path: { id: requirementId } } })) });
}

export function useAddRequirementProperty(requirementId: string, relationshipId?: string) {
  return useMutation({
    mutationFn: (body: S['RequirementListingInputRequest']) => unwrap(api.POST('/api/v1/requirements/{id}/listings', { params: { path: { id: requirementId } }, body })),
    onSuccess: (l: Listing) => {
      refreshListing(l);
      void queryClient.invalidateQueries({ queryKey: ['requirementListings', requirementId] });
      invalidateLead(relationshipId);
    },
  });
}

/** FB-08: key access arrangement on a property. */
export function useSaveAccess(listingId: string) {
  return useMutation({
    mutationFn: (body: S['AccessInputRequest']) => unwrap(api.PUT('/api/v1/listings/{id}/access', { params: { path: { id: listingId } }, body })),
    onSuccess: refreshListing,
  });
}

/** FB-06 / reminders: one visit by id (the "View visit" target). */
export function useVisit(id: string | undefined) {
  return useQuery({ queryKey: lk.visit(id ?? ''), enabled: !!id, queryFn: () => unwrap(api.GET('/api/v1/visits/{id}', { params: { path: { id: id! } } })) });
}
