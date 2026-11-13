import { toApiError, fieldError } from '@/api/errors';

describe('toApiError', () => {
  it('maps the backend envelope to inline field errors', () => {
    const err = toApiError(400, {
      error: { code: 'validation_error', message: 'Some fields are invalid.', fields: { phone: ['Enter a valid mobile'], 'contacts.0.name': ['Required'] } },
    });
    expect(err.code).toBe('validation_error');
    expect(fieldError(err, 'phone')).toBe('Enter a valid mobile');
    expect(err.fields['contacts.0.name']).toBe('Required');
    expect(err.hasFieldErrors()).toBe(true);
  });

  it('falls back to a human message for non-envelope bodies', () => {
    expect(toApiError(502, '<html>').message).toMatch(/trouble/);
    expect(toApiError(502, null).code).toBe('server_error');
    expect(toApiError(409, {}).message).toMatch(/changed this first/);
  });
});
