import { listingPayload, submitBlockers } from '@/components/listings/listingForm';

const base = { title: ' 3BHK park facing ', configuration: '3BHK', expected_price: '13500000', expected_rent: '40000', security_deposit: '80000', super_area_sqft: '1650', carpet_area_sqft: '', furnishing: null, parking: 'COVERED', facing: null, availability: null, available_from: null, description: '' };

describe('listing draft', () => {
  it('sends only the price that fits the listing type', () => {
    expect(listingPayload(base, 'SELL')).toMatchObject({ title: '3BHK park facing', expected_price: 13500000, expected_rent: null, security_deposit: null, carpet_area_sqft: null });
    expect(listingPayload(base, 'RENT_OUT')).toMatchObject({ expected_price: null, expected_rent: 40000, security_deposit: 80000 });
  });
  it('lists what blocks submission', () => {
    const t = (k: string) => k;
    expect(submitBlockers({ ...base, configuration: null, expected_price: '' }, 'SELL', 0, t)).toEqual(['listings.needConfig', 'listings.needPrice', 'listings.needPhoto']);
    expect(submitBlockers(base, 'SELL', 1, t)).toEqual([]);
  });
});
