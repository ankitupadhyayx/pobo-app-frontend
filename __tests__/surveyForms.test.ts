import { detailsPayload, emptyDetails, emptySurvey, surveyPayload, validateSurvey } from '@/components/survey/forms';

const t = (k: string) => k;

describe('survey drafts', () => {
  it('requires occupancy and valid contact phones', () => {
    const d = emptySurvey();
    d.contacts.TENANT.phone = '12345';
    expect(validateSurvey(d, t)).toEqual({ occupancy: 'errors.required', 'TENANT.phone': 'errors.phone' });
  });

  it('sends only filled contact slots, E.164 phones, tenancy only when tenant occupied', () => {
    const d = emptySurvey();
    d.occupancy = 'TENANT_OCCUPIED';
    d.contacts.OWNER = { ...d.contacts.OWNER, name: 'Owner A', phone: '9876543210', call_allowed: true };
    d.contacts.TENANT = { ...d.contacts.TENANT, name: 'Tenant B' };
    d.lease_end = '2026-11-30';
    d.monthly_rent = '38000';
    const p = surveyPayload(d);
    expect(p.contacts.map((c) => c.slot)).toEqual(['OWNER', 'TENANT']);
    expect(p.contacts[0].phone).toBe('+919876543210');
    expect(p.tenancy).toEqual({ lease_end: '2026-11-30', monthly_rent: 38000 });
    d.occupancy = 'VACANT';
    expect(surveyPayload(d).tenancy).toBeNull();
  });

  it('converts numeric details and blanks', () => {
    const d = { ...emptyDetails(), balcony_count: '2', carpet_area_sqft: '' };
    expect(detailsPayload(d)).toMatchObject({ balcony_count: 2, carpet_area_sqft: null, facing: '' });
  });
});
