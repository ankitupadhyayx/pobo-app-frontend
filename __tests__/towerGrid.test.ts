import { buildRows, unitLayer } from '@/components/survey/towerGrid';

const unit = (over: object) => ({ id: 'u', number: '101', floor_id: 'f1', survey_level: 'NONE', has_history: false, open_listing_status: null, open_opportunity_type: null, keys_held: false, needs_revisit: false, updated_at: '', ...over }) as never;

describe('DEC-01 unit layers', () => {
  it('listing > opportunity > surveyed > mapped', () => {
    expect(unitLayer(unit({}))).toBe('mapped');
    expect(unitLayer(unit({ survey_level: 'BASIC' }))).toBe('surveyed');
    expect(unitLayer(unit({ survey_level: 'BASIC', open_opportunity_type: 'SELL' }))).toBe('opportunity');
    expect(unitLayer(unit({ survey_level: 'BASIC', open_opportunity_type: 'SELL', open_listing_status: 'DRAFT' }))).toBe('listing');
  });

  it('orders floors top-down and units naturally; marks local pending/conflict', () => {
    const tower = {
      floors: [{ id: 'f1', number: 1, label: '1' }, { id: 'f2', number: 2, label: '2' }],
      units: [unit({ id: 'a', number: '110', floor_id: 'f1' }), unit({ id: 'b', number: '102', floor_id: 'f1' }), unit({ id: 'c', number: '201', floor_id: 'f2' })],
    } as never;
    const rows = buildRows(tower, { 'unit:b': 'pending', 'unit:c': 'conflict' });
    expect(rows.map((r) => r.floor)).toEqual(['2', '1']);
    expect(rows[1].units.map((u) => u.label)).toEqual(['102', '110']);
    expect(rows[1].units[0].pending).toBe(true);
    expect(rows[0].units[0].conflict).toBe(true);
  });
});
