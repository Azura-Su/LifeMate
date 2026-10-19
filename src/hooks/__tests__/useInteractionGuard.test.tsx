import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { useInteractionGuard } from '../useInteractionGuard';

it('invalidates old confirmations permanently after hiding, reopening or changing owners', () => {
  const view = renderHook(
    ({ active, owner }: { active: boolean; owner: string }) =>
      useInteractionGuard(active, owner),
    { initialProps: { active: true, owner: 'alice' } },
  );
  const original = view.result.current;
  expect(original()).toBe(true);
  view.rerender({ active: false, owner: 'alice' });
  expect(original()).toBe(false);
  view.rerender({ active: true, owner: 'alice' });
  expect(original()).toBe(false);
  const reopened = view.result.current;
  expect(reopened()).toBe(true);
  view.rerender({ active: true, owner: 'bob' });
  expect(reopened()).toBe(false);
  const current = view.result.current;
  expect(current()).toBe(true);
  view.unmount();
  expect(current()).toBe(false);
});

it('permits current StrictMode interactions and rejects an absent owner', () => {
  const view = renderHook(
    ({ owner }: { owner: string | null }) => useInteractionGuard(true, owner),
    {
      initialProps: { owner: 'alice' as string | null },
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    },
  );
  expect(view.result.current()).toBe(true);
  view.rerender({ owner: null });
  expect(view.result.current()).toBe(false);
});
