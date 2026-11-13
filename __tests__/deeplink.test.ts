import { notificationHref } from '@/lib/deeplink';

describe('notificationHref', () => {
  it('routes lead notifications to the lead detail', () => {
    expect(notificationHref('NEW_ASSIGNMENT', { relationship_id: 'r1', requirement_id: 'q1' })).toBe('/lead/r1?requirement=q1');
    expect(notificationHref('FOLLOW_UP_DUE', { relationship_id: 'r1' })).toBe('/lead/r1');
  });
  it('routes float offers home and leave updates to leave', () => {
    expect(notificationHref('FLOAT_OFFER', { float_id: 'f' })).toBe('/more/floats?float=f');
    expect(notificationHref(undefined, { float_id: 'g' })).toBe('/more/floats?float=g');
    expect(notificationHref('LEAVE_UPDATE', {})).toBe('/more/leave');
  });
  it('honours an explicit link and ignores junk', () => {
    expect(notificationHref('SYSTEM', { link: '/more/profile' })).toBe('/more/profile');
    expect(notificationHref('SYSTEM', null)).toBeNull();
  });
});

describe('Revision 1 notification links', () => {
  const { notificationHref, reminderHref } = require('@/lib/deeplink');
  it('OPS_REMINDER opens its record, KEY_TASK opens keys', () => {
    expect(notificationHref('OPS_REMINDER', { screen: 'listing', listing_id: 'l1' })).toBe('/listing/l1');
    expect(notificationHref('OPS_REMINDER', {})).toBe('/more/reminders');
    // R2-18: real payload shape from the live API (ids nested under data.target).
    expect(
      notificationHref('OPS_REMINDER', { label: 'Rahul Sharma · Sell', screen: 'requirement', target: { relationship_id: 'r1', requirement_id: 'q1', visit_id: null } }),
    ).toBe('/lead/r1?requirement=q1');
    expect(notificationHref('KEY_TASK', {})).toBe('/more/field-tasks?kind=keys');
    expect(reminderHref('visit', { visit_id: 'v1' })).toBe('/visits?visit=v1');
    expect(reminderHref('field_flag', { unit_id: 'u1' })).toBe('/field/unit/u1');
  });
});
