import { getAuthErrorMessage, validateLogin } from '../auth';

describe('login boundary', () => {
  it('validates email and nonempty password without imposing signup password rules', () => {
    expect(validateLogin('invalid', 'secret')).toBeTruthy();
    expect(validateLogin('a@b.co', '')).toBeTruthy();
    expect(validateLogin(' a@b.co ', '123')).toBeNull();
  });

  it('does not expose account existence or raw server errors', () => {
    expect(getAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(
      getAuthErrorMessage({ code: 'auth/wrong-password' }),
    );
    expect(
      getAuthErrorMessage(new Error('secret internal detail')),
    ).not.toContain('secret');
    expect(
      getAuthErrorMessage({ code: 'auth/network-request-failed' }),
    ).toContain('kết nối');
  });
});
