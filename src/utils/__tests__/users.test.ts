import { parseUsers, resolveUserName } from '../users';

describe('Remote Config users', () => {
  it('normalizes email and trims names from the supplied format', () => {
    expect(
      parseUsers('[{"mail":" Su.Azura99@Gmail.com ","name":" Asher "}]'),
    ).toEqual([{ mail: 'su.azura99@gmail.com', name: 'Asher' }]);
  });

  it.each([
    'invalid',
    '{}',
    'null',
    '[{"mail":"x","name":42}]',
    '[null]',
    '[{"mail":"a@b.co","name":" "}]',
  ])(
    'rejects malformed data without pretending it is an empty list: %s',
    (raw) => {
      expect(parseUsers(raw)).toBeNull();
    },
  );

  it('accepts an intentionally empty directory and keeps the first duplicate', () => {
    expect(parseUsers('[]')).toEqual([]);
    expect(
      parseUsers('[{"mail":"a@b.co","name":"A"},{"mail":"A@B.CO","name":"B"}]'),
    ).toEqual([{ mail: 'a@b.co', name: 'A' }]);
  });

  it('resolves the current account without accidentally showing another account name', () => {
    const users = [{ mail: 'su.azura99@gmail.com', name: 'Asher' }];
    expect(
      resolveUserName(
        { email: 'SU.AZURA99@gmail.com', displayName: null },
        users,
      ),
    ).toBe('Asher');
    expect(
      resolveUserName({ email: 'other@b.co', displayName: 'Other' }, users),
    ).toBe('Other');
    expect(
      resolveUserName({ email: 'other@b.co', displayName: null }, users),
    ).toBe('other');
    expect(resolveUserName(null, users)).toBe('Bạn');
  });
});
