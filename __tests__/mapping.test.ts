import { findDuplicateNames, floorLabels, previewUnits, unitNumber } from '@/lib/mapping';

describe('mapping preview', () => {
  it('builds LG/UG/G and numbered floors, skipping 13 renamed 12A', () => {
    expect(floorLabels({ lowerGround: true, upperGround: true, ground: true, topFloor: 14, skip: [13], rename: { 13: '12A' } })).toEqual([
      'LG', 'UG', 'G', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '12A', '14',
    ]);
    expect(floorLabels({ lowerGround: false, upperGround: false, ground: false, topFloor: 3, skip: [2], rename: {} })).toEqual(['1', '3']);
  });

  it('numbers units with a pattern', () => {
    expect(unitNumber('{floor}{unit:02d}', 'T2', '12', 4)).toBe('1204');
    expect(unitNumber('{floor}{letter}', 'T2', '3', 2)).toBe('3B');
    expect(unitNumber('{tower}-{floor}{unit:02d}', 'A', 'G', 1)).toBe('A-G01');
    expect(previewUnits(['1', '2'], 2, '{floor}0{unit}', 'T1')).toEqual([
      { floor: '1', units: ['101', '102'] },
      { floor: '2', units: ['201', '202'] },
    ]);
  });

  it('flags probable duplicate tower names', () => {
    expect(findDuplicateNames(['Tower 2', 'T-2', 'Tower 3', 't2 '])).toEqual([['Tower 2', 'T-2', 't2 ']]);
  });
});
