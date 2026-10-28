import { act, renderHook } from '@testing-library/react-native';
import { usePixelPetRefresh } from '../usePixelPetRefresh';
import { callPixelPet } from '../../services/pixelPet/pixelPetApi';
jest.mock('../../services/pixelPet/pixelPetApi', () => ({
  callPixelPet: jest.fn(),
}));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('refreshes ownership with lightweight reads only when active, with no overlapping requests', async () => {
  let resolve!: (state: never) => void;
  jest
    .mocked(callPixelPet)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue({ pet: null } as never);
  const update = jest.fn();
  const view = renderHook<void, { active: boolean }>(
    ({ active }) => usePixelPetRefresh('u', active, update),
    { initialProps: { active: true } },
  );
  expect(callPixelPet).toHaveBeenCalledWith('u', { type: 'state' });
  await act(async () => {
    jest.advanceTimersByTime(90000);
  });
  expect(callPixelPet).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ pet: null } as never));
  expect(update).toHaveBeenCalledWith({ pet: null });
  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(callPixelPet).toHaveBeenCalledTimes(2);
  view.rerender({ active: false });
  await act(async () => {
    jest.advanceTimersByTime(90000);
  });
  expect(callPixelPet).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
  expect(callPixelPet).toHaveBeenCalledTimes(2);
});
