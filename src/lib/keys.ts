/**
 * REQ-11: body for POST /keys and the offline key.taken mutation. A flat sends unit_id (+ listing_id);
 * an independent property has no flat, so it is keyed by the listing alone (listing_id, no unit_id).
 */
export function keyTakenPayload<V extends { taken_from: string; key_count: number; taken_at: string }>(unitId: string | null | undefined, listingId: string | null | undefined, v: V) {
  return unitId ? { unit_id: unitId, listing_id: listingId ?? null, ...v } : { listing_id: listingId!, ...v };
}
