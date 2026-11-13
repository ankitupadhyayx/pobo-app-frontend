import { View } from 'react-native';
import { MediaPanel } from '@/components/listings/MediaPanel';
import { uploadVisitMedia, useListing, type Visit } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { useOnline } from '@/hooks/useOnline';

/**
 * R2-6: inside an active Inspection / Photography visit, Add photos / Add video right there.
 * Media saves to the visit's property; the progress shows the inspection minimum.
 */
export function VisitMedia({ visit }: { visit: Visit }) {
  const L = useLabels();
  const online = useOnline();
  const listingId = visit.media?.listing_id ?? '';
  const listing = useListing(listingId);
  if (!listingId) return null;
  return (
    <View testID={`visit-media-${visit.id}`} className="rounded-2xl border border-teal-100 bg-white p-3">
      <MediaPanel
        testID={`visit-media-panel-${visit.id}`}
        listingId={listingId}
        photos={listing.data?.photos ?? []}
        canAdd
        online={online}
        minPhotos={visit.media?.min_photos || undefined}
        maxVideoBytes={Number(L.setting('uploads.max_video_bytes', '150000000')) || undefined}
        upload={(m, o) => uploadVisitMedia(visit, m, o)}
      />
    </View>
  );
}
