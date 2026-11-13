import { draftToInput, emptyDraft, validateDraft } from '@/components/leadForm/types';

const t = (k: string) => k;

describe('requirement drafts', () => {
  it('RENT_OUT sends location + expected rent + lease term, not budget', () => {
    const d = { ...emptyDraft('RENT_OUT'), configuration: 'STUDIO', societyName: 'Paras Tierea', towerName: 'T2', flatNumber: '1204', expectedRent: '25,000', leaseTermMonths: '11', budgetMin: '5' };
    expect(draftToInput(d)).toEqual({
      type: 'RENT_OUT',
      configuration: 'STUDIO',
      society_name: 'Paras Tierea',
      tower_name: 'T2',
      flat_number: '1204',
      expected_rent: 25000,
      lease_term_months: 11,
    });
  });

  it('SELL sends sector, address and the pasted pin for the server to parse (RV2-A)', () => {
    const d = { ...emptyDraft('SELL'), locality: { items: [{ id: 'loc44', name: 'Sector 44' }], other: '' }, location: { addressText: 'Villa 4, Sector 44', paste: '28.5, 77.4' } };
    expect(draftToInput(d)).toEqual({ type: 'SELL', locality_id: 'loc44', address_text: 'Villa 4, Sector 44', location_input: '28.5, 77.4' });
  });

  it('BUY sends preferred sector ids, societies and budget (R2-10)', () => {
    const d = {
      ...emptyDraft('BUY'),
      preferredLocalities: { items: [{ id: 's137', name: 'Sector 137' }, { id: 's150', name: 'Sector 150' }], other: '' },
      preferredSocieties: [{ id: 'soc1', name: 'Paras Tierea' }],
      budgetMin: '8000000',
      budgetMax: '12000000',
    };
    expect(draftToInput(d)).toEqual({ type: 'BUY', preferred_locality_ids: ['s137', 's150'], preferred_society_ids: ['soc1'], budget_min: 8000000, budget_max: 12000000 });
  });

  it('BUY open on location sends area_open only (R2-11); not-listed area goes as locality_other', () => {
    const open = { ...emptyDraft('RENT'), areaOpen: true, preferredLocalities: { items: [{ id: 's1', name: 'x' }], other: '' } };
    expect(draftToInput(open)).toEqual({ type: 'RENT', area_open: true });
    expect(draftToInput({ ...emptyDraft('BUY'), preferredLocalities: { items: [], other: 'Gaur City 2' } })).toEqual({ type: 'BUY', locality_other: 'Gaur City 2' });
  });

  it('validates location, numbers and budget order', () => {
    // R2-3: no hidden location requirement for any intent.
    for (const ty of ['BUY', 'RENT', 'SELL', 'RENT_OUT']) expect(validateDraft(emptyDraft(ty), t)).toEqual({});
    expect(validateDraft({ ...emptyDraft('BUY'), budgetMin: '9', budgetMax: '5' }, t)).toHaveProperty('budgetMax');
    expect(validateDraft({ ...emptyDraft('RENT'), expectedRent: 'abc' }, t)).toHaveProperty('expectedRent');
    expect(validateDraft({ ...emptyDraft('RENT'), leaseTermMonths: '500' }, t)).toHaveProperty('leaseTermMonths');
  });
});
