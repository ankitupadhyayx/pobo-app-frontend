/**
 * DEC-01: structure mapping, survey, opportunity and listing are different records and must look
 * different. One visual vocabulary used by the matrix, legend, unit header and Home cards.
 */
export type UnitLayer = 'mapped' | 'surveyed' | 'opportunity' | 'listing';
export type ListingState = 'DRAFT' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'VERIFIED' | 'REJECTED' | 'WITHDRAWN';

export const LAYER_STYLE: Record<UnitLayer, { cell: string; text: string; dot: string }> = {
  // Mapped only: exists in the structure, nothing collected yet. Dashed outline, no fill.
  mapped: { cell: 'border border-dashed border-slate-300 bg-white', text: 'text-slate-500', dot: 'bg-slate-300' },
  // Survey: field intelligence recorded. Teal fill.
  surveyed: { cell: 'border border-teal-600 bg-teal-600', text: 'text-white', dot: 'bg-teal-600' },
  // Property opportunity: Sell / Rent Out intent. Amber fill.
  opportunity: { cell: 'border border-amber-500 bg-amber-400', text: 'text-amber-950', dot: 'bg-amber-400' },
  // Listing: marketable record. Violet; solid only when VERIFIED.
  listing: { cell: 'border-2 border-violet-600 bg-violet-100', text: 'text-violet-900', dot: 'bg-violet-600' },
};

export function listingCell(state: ListingState | null | undefined): { cell: string; text: string } {
  if (state === 'VERIFIED') return { cell: 'border border-violet-700 bg-violet-700', text: 'text-white' };
  if (state === 'CHANGES_REQUESTED') return { cell: 'border-2 border-rose-500 bg-violet-100', text: 'text-violet-900' };
  if (state === 'REJECTED' || state === 'WITHDRAWN') return { cell: 'border border-slate-300 bg-slate-100', text: 'text-slate-500' };
  return LAYER_STYLE.listing;
}
