import {
  getAuthErrorMessage,
  getRegistrationErrorMessage,
  validateLogin,
  validateRegistration,
} from '../auth';

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

describe('registration boundary', () => {
  it('validates name, email, password and exact confirmation', () => {
    expect(
      validateRegistration('', 'a@b.co', 'abcdefgh', 'abcdefgh'),
    ).toBeTruthy();
    expect(
      validateRegistration('A\nB', 'a@b.co', 'abcdefgh', 'abcdefgh'),
    ).toBeTruthy();
    expect(
      validateRegistration('Asher', 'bad', 'abcdefgh', 'abcdefgh'),
    ).toBeTruthy();
    expect(
      validateRegistration('Asher', 'a@b.co', 'short', 'short'),
    ).toBeTruthy();
    expect(
      validateRegistration('Asher', 'a@b.co', 'abcdefgh', 'abcdefgh '),
    ).toBeTruthy();
    expect(
      validateRegistration(' Asher ', ' A@B.Co ', 'abcdefgh', 'abcdefgh'),
    ).toBeNull();
  });

  it('maps provider errors without exposing raw details', () => {
    expect(
      getRegistrationErrorMessage({ code: 'auth/email-already-in-use' }),
    ).toContain('email');
    expect(
      getRegistrationErrorMessage({ code: 'auth/weak-password' }),
    ).toContain('Mật khẩu');
    expect(
      getRegistrationErrorMessage({ code: 'auth/network-request-failed' }),
    ).toContain('kết nối');
    expect(
      getRegistrationErrorMessage(new Error('secret internal detail')),
    ).not.toContain('secret');
  });
});
