import { petErrorMessage } from '../petErrors';
it('explains access, offline and expired-session errors without exposing SDK details', () => {
  for (const code of ['permission-denied', 'unauthenticated', 'unavailable']) {
    const result = petErrorMessage(
      Object.assign(new Error('[firestore/' + code + '] sensitive detail'), {
        code: 'firestore/' + code,
      }),
    );
    expect(result).not.toContain('firestore');
    expect(result).not.toContain('sensitive detail');
  }
  expect(petErrorMessage(new Error('Failed to fetch'))).not.toContain('Failed');
  expect(petErrorMessage(new Error('Thú cưng đã thay đổi.'))).toBe(
    'Thú cưng đã thay đổi.',
  );
});
