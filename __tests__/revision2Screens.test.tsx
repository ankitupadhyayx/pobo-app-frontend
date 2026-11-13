/** Revision 2 (Round 2 testing): R2-8 failed-save feedback, R2-16/17 leave, R2-3 hidden fields, RV2-A location, R2-18 links. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Linking } from 'react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import relationship from './fixtures/relationship.json';
import listing from './fixtures/listing.json';

let mockPickDate = new Date();
jest.mock('@react-native-community/datetimepicker', () => {
  const ce = require('react')['create' + 'Element'];
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (p: { onChange: (e: { type: string }, d: Date) => void }) => ce(Pressable, { testID: 'dtp', onPress: () => p.onChange({ type: 'set' }, mockPickDate) }) };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const roster = { weekly_off_weekday: 2, weekly_off_label: 'Wednesday', service_hours_start: '09:00', service_hours_end: '18:00', on_leave_today: false, upcoming_leave: [], covered_by: [], covering_for: [] };
const mockGet: Record<string, () => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => me,
  '/api/v1/me/roster': () => roster,
  '/api/v1/me/leave': () => ({ results: mockLeaves, next: null, previous: null }),
  '/api/v1/requirements/{id}': () => mockReq,
  '/api/v1/geo/localities': () => [sector150],
  '/api/v1/geo/societies': () => ({ results: [], next: null, previous: null }),
  '/api/v1/listings/{id}': () => mockListing,
};
const sector150 = { id: 'loc150', name: 'Sector 150', kind: 'SECTOR', aliases: [], city: 'Noida', territory: 'Noida • Sector 150', territory_id: 't150', latitude: null, longitude: null };
let mockLeaves: unknown[] = [];
let mockReq: unknown = relationship.requirements[0];
let mockListing: Record<string, unknown> = { ...listing, photos: listing.photos.map((p) => ({ ...p, media_type: 'PHOTO', mime: 'image/png', thumbnail_url: null, visit_id: null, stored_file_id: null })) };
const mockPatch = jest.fn(async (_path: string, opts: { body: Record<string, unknown> }) => ({ data: { ...listing.photos[0], ...opts.body }, response: { ok: true, status: 200 } }));
let mockPostImpl: (path: string, body: Record<string, unknown>) => { data?: unknown; error?: unknown; status: number } = () => ({ data: {}, status: 201 });
const mockPost = jest.fn(async (path: string, opts: { body: Record<string, unknown> }) => {
  const r = mockPostImpl(path, opts.body);
  return { data: r.data, error: r.error, response: { ok: r.status < 300, status: r.status } };
});
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string) => {
      if (!(path in mockGet)) throw new Error(`unmocked GET ${path}`);
      return { data: mockGet[path](), response: { ok: true, status: 200 } };
    },
    POST: (path: string, opts: { body: Record<string, unknown> }) => mockPost(path, opts),
    PUT: jest.fn(),
    PATCH: (path: string, opts: { body: Record<string, unknown> }) => mockPatch(path, opts),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

import { SuccessHost } from '@/components/shell/SuccessHost';
import { AddRequirementSheet } from '@/components/sheets/AddRequirementSheet';
import { LocationField } from '@/components/ui/LocationField';
import { emptyLocation, mapsSearchUrl, parseLocation, toLocationInput } from '@/lib/location';
import { useState } from 'react';

let qc: QueryClient;
const wrap = (ui: ReactNode) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return (
    <QueryClientProvider client={qc}>
      {ui}
      <SuccessHost />
    </QueryClientProvider>
  );
};
beforeEach(() => {
  mockPost.mockClear();
  mockBack.mockClear();
  mockPostImpl = () => ({ data: {}, status: 201 });
});

describe('RV2-A location parsing', () => {
  it('reads the common Google Maps forms and plain coordinates', () => {
    expect(parseLocation('28.5355, 77.3910')).toMatchObject({ source: 'PASTED_COORDS', latitude: 28.5355, longitude: 77.391 });
    expect(parseLocation('https://www.google.com/maps/place/Paras+Tierea/@28.5355161,77.3910265,17z')).toMatchObject({ source: 'MAPS_LINK', latitude: 28.535516, longitude: 77.391027 });
    expect(parseLocation('https://www.google.com/maps/place/X/data=!3d28.4!4d77.5')).toMatchObject({ latitude: 28.4, longitude: 77.5 });
    expect(parseLocation('https://maps.google.com/?q=28.61,77.23')).toMatchObject({ latitude: 28.61, longitude: 77.23 });
    expect(parseLocation('https://maps.google.com/?ll=28.61,77.23')).toMatchObject({ latitude: 28.61 });
    // Short links can't be resolved offline: kept, no coordinates.
    expect(parseLocation('https://maps.app.goo.gl/abc123')).toEqual({ source: 'MAPS_LINK', latitude: null, longitude: null, mapsUrl: 'https://maps.app.goo.gl/abc123' });
    expect(parseLocation('95, 200')).toBeNull();
    expect(parseLocation('hello')).toBeNull();
    expect(parseLocation('')).toBeNull();
  });

  it('serialises to the shared address fields; text alone is enough', () => {
    expect(toLocationInput({ addressText: ' B-12, Sector 50 ', paste: '' })).toEqual({ address_text: 'B-12, Sector 50' });
    expect(toLocationInput({ addressText: 'x', paste: ' 28.5, 77.4 ' })).toEqual({ address_text: 'x', location_input: '28.5, 77.4' });
    expect(mapsSearchUrl('Sector 150 Noida')).toBe('https://www.google.com/maps/search/?api=1&query=Sector%20150%20Noida');
  });

  it('LocationField opens Google Maps at the typed address and previews a pasted pin', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    function Host() {
      const [v, setV] = useState(emptyLocation());
      return <LocationField value={v} onChange={setV} areaHint="Sector 150" />;
    }
    await render(wrap(<Host />));
    await fireEvent.press(screen.getByTestId('location-open-maps'));
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Sector%20150');
    await fireEvent.changeText(screen.getByTestId('location-address'), 'B-12 Sector 50');
    await fireEvent.press(screen.getByTestId('location-open-maps'));
    expect(open).toHaveBeenLastCalledWith(mapsSearchUrl('B-12 Sector 50'));
    await fireEvent.changeText(screen.getByTestId('location-paste'), '28.5355, 77.3910');
    expect(screen.getByText('28.5355, 77.3910 ✓')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('location-paste'), 'not a place');
    expect(screen.getByText(/isn't a Maps link/)).toBeTruthy();
  });
});

describe('R2-16/17 leave', () => {
  it('reason is required; failed save says so at once; success shows Pending', async () => {
    mockPickDate = new Date(Date.now() + 10 * 86400000);
    const Leave = require('@/app/(app)/more/leave').default;
    await render(wrap(<Leave />));
    await fireEvent.press(await screen.findByTestId('leave-open'));
    await fireEvent.press(screen.getByTestId('leave-submit'));
    expect(screen.getByText('Write the reason for leave')).toBeTruthy();
    expect(screen.getByTestId('toast-error')).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('leave-from'));
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.changeText(screen.getByTestId('leave-reason'), 'Family function');
    mockPostImpl = () => ({ data: { id: 'l1', status: 'PENDING' }, status: 201 });
    await fireEvent.press(screen.getByTestId('leave-submit'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/me/leave', expect.objectContaining({ body: expect.objectContaining({ reason: 'Family function', start_date: expect.any(String), end_date: expect.any(String) }) })));
    expect(await screen.findByText('Pending approval')).toBeTruthy();
  });

  it('overlapping leave explains itself in plain words', async () => {
    mockPickDate = new Date(Date.now() + 10 * 86400000);
    mockPostImpl = () => ({ error: { error: { code: 'leave_overlap', message: 'You already have leave requested for these dates.', fields: {} } }, status: 409 });
    const Leave = require('@/app/(app)/more/leave').default;
    await render(wrap(<Leave />));
    await fireEvent.press(await screen.findByTestId('leave-open'));
    await fireEvent.press(screen.getByTestId('leave-from'));
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.changeText(screen.getByTestId('leave-reason'), 'Wedding');
    await fireEvent.press(screen.getByTestId('leave-submit'));
    expect((await screen.findAllByText(/already have leave requested for some of these dates/)).length).toBeGreaterThan(0);
  });
});

describe('R2-3 / R2-8 Add Requirement', () => {
  const props = {
    visible: true,
    onClose: jest.fn(),
    customerName: 'Tedr',
    types: [
      { value: 'BUY', label: 'Buy' },
      { value: 'SELL', label: 'Sell' },
    ],
    configurations: [{ value: '3BHK', label: '3 BHK' }],
    timelines: [],
  };
  it('a SELL requirement saves without a society (property comes later); R3-2: as a draft when details are missing', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(wrap(<AddRequirementSheet {...props} onSubmit={onSubmit} />));
    await fireEvent.press(screen.getByTestId('addreq-type-SELL'));
    await fireEvent.press(screen.getByTestId('add-requirement-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('add-requirement-draft'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([expect.objectContaining({ type: 'SELL', save_as_draft: true })]));
  });
  it('no intent → pinned notice + error under the field', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(wrap(<AddRequirementSheet {...props} onSubmit={onSubmit} />));
    await fireEvent.press(screen.getByTestId('add-requirement-submit'));
    expect(screen.getByTestId('form-notice')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('R2-18 reminder links', () => {
  it('push / drawer payload with nested target opens the exact record', () => {
    const { notificationHref } = require('@/lib/deeplink');
    expect(notificationHref('OPS_REMINDER', { screen: 'visit', target: { visit_id: 'v9' } })).toBe('/visits?visit=v9');
    expect(notificationHref('SUPPORT_TICKET', { ticket_id: 't1' })).toBe('/more/ticket/t1');
    expect(notificationHref('SOMETHING', { listing_id: 'l2' })).toBe('/listing/l2');
  });
});

describe('R2-2 Add Property: independent property', () => {
  it('asks where, then posts an independent builder floor with address + pasted pin', async () => {
    mockReq = { ...relationship.requirements[0], society: null, locality: { id: 'loc150', name: 'Sector 150' } };
    mockParams = { rid: relationship.requirements[0].id };
    mockPostImpl = () => ({ data: { ...listing, unit: null, property_kind: 'BUILDER_FLOOR', is_independent: true, address_text: 'B-12, Sector 150', locality: { id: 'loc150', name: 'Sector 150', territory_id: null } }, status: 201 });
    const AddProperty = require('@/app/(app)/lead/add-property/[rid]').default;
    await render(wrap(<AddProperty />));
    await screen.findByText(/For: /);
    await fireEvent.press(screen.getByTestId('source-INDEPENDENT'));
    // Sector defaults to the requirement's.
    expect(screen.getByTestId('ind-locality-picked-loc150')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-property-save'));
    expect(screen.getByText('Choose the type of property')).toBeTruthy();
    expect(screen.getByText('Write the full address')).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('kind-BUILDER_FLOOR'));
    await fireEvent.changeText(screen.getByTestId('ind-location-address'), 'B-12, Sector 150');
    await fireEvent.changeText(screen.getByTestId('ind-location-paste'), '28.5355, 77.3910');
    expect(screen.getByText('28.5355, 77.3910 ✓')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-property-save'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/requirements/{id}/listings',
        expect.objectContaining({ body: expect.objectContaining({ independent: { property_kind: 'BUILDER_FLOOR', locality_id: 'loc150', address_text: 'B-12, Sector 150', location_input: '28.5355, 77.3910' } }) }),
      ),
    );
    expect(await screen.findByText('Property Added')).toBeTruthy();
  });
});

describe('R2-10/R2-11 requirement location', () => {
  const props = {
    visible: true,
    onClose: jest.fn(),
    customerName: 'Tedr',
    types: [{ value: 'BUY', label: 'Buy' }],
    configurations: [],
    timelines: [],
  };
  it('BUY picks Sector 150 from the master (not free text) and sends its id', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(wrap(<AddRequirementSheet {...props} onSubmit={onSubmit} />));
    await fireEvent.press(screen.getByTestId('addreq-type-BUY'));
    expect(screen.getByTestId('req-BUY-no-location')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('req-BUY-pref-search'), 'sec 150');
    await fireEvent.press(await screen.findByTestId('req-BUY-pref-option-loc150', {}, { timeout: 3000 }));
    expect(screen.getByTestId('req-BUY-pref-picked-loc150')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-requirement-submit'));
    await fireEvent.press(screen.getByTestId('add-requirement-draft'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ type: 'BUY', save_as_draft: true, preferred_locality_ids: ['loc150'] }]));
  });
  it('Open area hides the pickers and sends area_open', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(wrap(<AddRequirementSheet {...props} onSubmit={onSubmit} />));
    await fireEvent.press(screen.getByTestId('addreq-type-BUY'));
    await fireEvent.press(screen.getByTestId('req-BUY-area-open'));
    expect(screen.queryByTestId('req-BUY-pref-search')).toBeNull();
    await fireEvent.press(screen.getByTestId('add-requirement-submit'));
    await fireEvent.press(screen.getByTestId('add-requirement-draft'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ type: 'BUY', save_as_draft: true, area_open: true }]));
  });
});

describe('R2-9 / R2-12 / RV2-D requirement card', () => {
  const { RequirementCard } = require('@/components/lead/RequirementCard');
  const base = relationship.requirements[0];
  const noop = jest.fn();
  const card = (req: unknown) => <RequirementCard req={req as never} dnc={false} onCall={noop} onFollowUp={noop} onCompleteFollowUp={noop} onMessage={noop} onTransfer={noop} />;
  it('shows Territory AA, Servicing AA and Relationship owner separately with the reason; source detail', async () => {
    const req = {
      ...base,
      type: 'BUY',
      is_mine: false,
      location_status: 'CAPTURED',
      preferred_localities: [{ id: 'loc150', name: 'Sector 150' }],
      preferred_societies: [],
      source_detail: { code: 'WEBSITE', label: 'Website', page: 'Sector 150 form', campaign: '', utm_source: '', utm_campaign: '', display: 'Website · Sector 150 form' },
      routing: {
        territory: { id: 't150', name: 'Noida • Sector 150' },
        territory_aa: { id: 'a', name: 'Anita Verma', code: 'AA-ANITA' },
        servicing_aa: { id: 'a', name: 'Anita Verma', code: 'AA-ANITA' },
        relationship_owner: { id: 'p', name: 'Priya Sharma', code: 'AA-PRIYA' },
        kind: 'TERRITORY',
        reason: 'Primary AA for territory Noida • Sector 150',
        assigned_at: null,
        servicing_differs_from_territory: false,
      },
    };
    await render(wrap(card(req)));
    expect(screen.getByText('Territory AA')).toBeTruthy();
    expect(screen.getByText('Relationship owner')).toBeTruthy();
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Why: Primary AA for territory Noida • Sector 150')).toBeTruthy();
    expect(screen.getByText('Website · Sector 150 form')).toBeTruthy();
    expect(screen.getByText('Sector 150')).toBeTruthy();
  });
  it('says "Location preference not captured" instead of pretending', async () => {
    await render(wrap(card({ ...base, type: 'BUY', location_status: 'NOT_CAPTURED', preferred_localities: [], preferred_societies: [], routing: null })));
    expect(screen.getByText('Location preference not captured')).toBeTruthy();
  });
});

describe('R2-5 visit outcomes by type', () => {
  const { CompleteVisitSheet } = require('@/components/sheets/VisitSheets');
  const inspection = [
    { value: 'INSPECTION_COMPLETED', label: 'Inspection completed', meta: { requires_next_action: false, media_check: 'photos' } },
    { value: 'MORE_MEDIA_REQUIRED', label: 'More media required', meta: { requires_next_action: false, media_check: null } },
  ];
  it('inspection: no buyer questions; "completed" blocked while photos are pending', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(
      wrap(
        <CompleteVisitSheet visible onClose={jest.fn()} onSubmit={onSubmit} subtitle="x" outcomes={inspection} interestLevels={[{ value: 'HIGH', label: 'High' }]} priceReactions={[]} followUpTypes={[]} buyerFeedback={false} media={{ photos_pending: 2, videos_pending: 0, min_photos: 3 }} />,
      ),
    );
    expect(screen.queryByText('High')).toBeNull();
    expect(screen.queryByText('Interested')).toBeNull();
    await fireEvent.press(screen.getByTestId('visit-outcome-INSPECTION_COMPLETED'));
    expect(screen.getByTestId('visit-media-pending')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('visit-feedback'), 'Owner showed all rooms');
    await fireEvent.press(screen.getByTestId('complete-visit-save'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-notice')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('visit-outcome-MORE_MEDIA_REQUIRED'));
    await fireEvent.press(screen.getByTestId('complete-visit-save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'MORE_MEDIA_REQUIRED', interest: null, priceReaction: null })));
  });
});

describe('R2-6 media panel', () => {
  it('shows photo/video counts and inspection progress; the star sets the cover', async () => {
    const { MediaPanel } = require('@/components/listings/MediaPanel');
    const photos = [
      { id: 'p1', media_type: 'PHOTO', mime: 'image/jpeg', url: 'u1', thumbnail_url: null, caption: '', is_cover: true, sort_order: 0, visit_id: null, stored_file_id: null, created_at: '' },
      { id: 'p2', media_type: 'PHOTO', mime: 'image/jpeg', url: 'u2', thumbnail_url: null, caption: '', is_cover: false, sort_order: 1, visit_id: null, stored_file_id: null, created_at: '' },
      { id: 'v1', media_type: 'VIDEO', mime: 'video/mp4', url: 'u3', thumbnail_url: null, caption: '', is_cover: false, sort_order: 2, visit_id: null, stored_file_id: null, created_at: '' },
    ];
    await render(wrap(<MediaPanel listingId="L1" photos={photos} canAdd online minPhotos={3} upload={jest.fn()} />));
    expect(screen.getByText('Photos 2 · Videos 1')).toBeTruthy();
    expect(screen.getByText('1 more photo(s) needed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('media-cover-p2'));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/v1/listings/{id}/photos/{photo_id}', expect.objectContaining({ body: { is_cover: true } })));
    await fireEvent.press(screen.getByTestId('media-add-video'));
    expect(screen.getByText('Record video')).toBeTruthy();
  });

  const presign = () => ({ data: { upload_id: 'up1', key: 'k', url: 'http://192.168.1.5:9000/x', method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, proxy_url: 'https://tunnel/api/v1/uploads/up1/content?token=t', max_bytes: 1, expires_at: '' }, status: 200 });
  const makeUploader = (direct: 'ok' | 'throw' | number, proxy: 'ok' | 'throw' | number) => {
    const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
    const outcome = async (o: 'ok' | 'throw' | number) => {
      if (o === 'throw') throw new Error('Network request failed');
      return { status: o === 'ok' ? 200 : o, body: o === 'ok' ? '' : '{"detail":"Upload token expired"}' };
    };
    const uploader = {
      size: () => 10,
      upload: jest.fn(async (_uri: string, url: string, o: { method: string; headers: Record<string, string>; onProgress?: (f: number) => void }) => {
        calls.push({ url, method: o.method, headers: o.headers });
        o.onProgress?.(0.5);
        return outcome(url.startsWith('http://192.168') ? direct : proxy);
      }),
    };
    return { uploader, calls };
  };

  it('R3-4: uploads the file natively straight to storage (no blob fetch)', async () => {
    const { putUpload } = require('@/api/hooks/listings');
    mockPostImpl = presign;
    const { uploader, calls } = makeUploader('ok', 'ok');
    const progress: number[] = [];
    expect(await putUpload({ uri: 'file:///v.mp4', mime: 'video/mp4', kind: 'VIDEO' }, { uploader, onProgress: (f: number) => progress.push(f) })).toBe('up1');
    expect(calls).toEqual([{ url: 'http://192.168.1.5:9000/x', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } }]);
    expect(progress).toEqual([0.5, 1]);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/uploads/presign', expect.objectContaining({ body: { purpose: 'LISTING_VIDEO', content_type: 'video/mp4', size_bytes: 10 } }));
  });

  it('R3-4: falls back to the API proxy when the direct storage PUT fails', async () => {
    const { putUpload } = require('@/api/hooks/listings');
    mockPostImpl = presign;
    for (const direct of ['throw', 403] as const) {
      const { uploader, calls } = makeUploader(direct, 'ok');
      expect(await putUpload({ uri: 'file:///v.mp4', mime: 'video/mp4', kind: 'VIDEO' }, { uploader })).toBe('up1');
      expect(calls.map((c) => c.url)).toEqual(['http://192.168.1.5:9000/x', 'https://tunnel/api/v1/uploads/up1/content?token=t']);
      expect(calls[1]).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'video/mp4' } });
    }
  });

  it('R3-4: an error when both the direct PUT and the proxy fail', async () => {
    const { putUpload } = require('@/api/hooks/listings');
    mockPostImpl = presign;
    const a = makeUploader('throw', 400);
    await expect(putUpload({ uri: 'file:///p.jpg', mime: 'image/jpeg', kind: 'PHOTO' }, { uploader: a.uploader })).rejects.toMatchObject({ status: 400 });
    const b = makeUploader('throw', 'throw');
    await expect(putUpload({ uri: 'file:///p.jpg', mime: 'image/jpeg', kind: 'PHOTO' }, { uploader: b.uploader })).rejects.toMatchObject({ status: 0 });
  });

  it('R3-4: a failed item keeps a Retry; camera shots offer "Take another"', async () => {
    const photos = require('@/lib/photos');
    const take = jest.spyOn(photos, 'takePhotos').mockResolvedValue([{ uri: 'file:///a.jpg', mime: 'image/jpeg', width: 1, height: 1 }]);
    const { MediaPanel } = require('@/components/listings/MediaPanel');
    const upload = jest.fn().mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue({});
    await render(wrap(<MediaPanel listingId="L1" photos={[]} canAdd online upload={upload} />));
    await fireEvent.press(screen.getByTestId('media-add-photos'));
    await fireEvent.press(screen.getByTestId('media-camera'));
    expect(await screen.findByTestId('media-retry')).toBeTruthy();
    expect(screen.queryByTestId('media-take-another')).toBeNull();
    await fireEvent.press(screen.getByTestId('media-retry'));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(upload.mock.calls[1][0]).toEqual({ uri: 'file:///a.jpg', mime: 'image/jpeg', kind: 'PHOTO' });
    await waitFor(() => expect(screen.queryByTestId('media-retry')).toBeNull());
    await fireEvent.press(screen.getByTestId('media-add-photos'));
    await fireEvent.press(screen.getByTestId('media-camera'));
    expect(await screen.findByTestId('media-take-another')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('media-take-another'));
    await waitFor(() => expect(take).toHaveBeenCalledTimes(3));
    take.mockRestore();
  });
});

describe('R2-17 leave cancel + cover', () => {
  it('a pending request shows cover AA and cancels on the second tap', async () => {
    mockLeaves = [{ id: 'lv1', leave_type: 'LEAVE', start_date: '2026-12-20', end_date: '2026-12-21', reason: 'Wedding', notes: '', status: 'PENDING', review_note: '', reviewed_at: null, created_at: '', cover_aa_name: 'Anita Verma', can_cancel: true }];
    mockPostImpl = () => ({ data: { id: 'lv1', status: 'CANCELLED' }, status: 200 });
    const Leave = require('@/app/(app)/more/leave').default;
    await render(wrap(<Leave />));
    expect(await screen.findByText('Anita Verma')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('leave-cancel-lv1'));
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.getByText('Tap again to cancel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('leave-cancel-lv1'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/me/leave/{id}/cancel', expect.anything()));
    mockLeaves = [];
  });
});
