import { parseGameUsers, parseUsers, resolveUserName } from '../users';

it.each(['{}', 'null', '[null]', '[42]', '["invalid"]', '{broken'])(
  'rejects malformed usergame %s',
  (raw) => {
    expect(parseGameUsers(raw)).toBeNull();
  },
);
it('normalizes and deduplicates usergame emails', () => {
  expect(parseGameUsers('[" A@Example.com ", "a@example.com"]')).toEqual([
    'a@example.com',
  ]);
  expect(parseGameUsers('[]')).toEqual([]);
});

describe('Remote Config users', () => {
  it('normalizes email and trims names from the supplied format', () => {
    expect(
      parseUsers('[{"mail":" Asher@Example.com ","name":" Asher "}]'),
    ).toEqual([{ mail: 'asher@example.com', name: 'Asher' }]);
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
    const users = [{ mail: 'asher@example.com', name: 'Asher' }];
    expect(
      resolveUserName(
        { email: 'asher@example.com', displayName: 'Tên tự đặt' },
        users,
      ),
    ).toBe('Tên tự đặt');
    expect(
      resolveUserName({ email: 'asher@example.com', displayName: null }, users),
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
