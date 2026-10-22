import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useScoreRoomStatuses } from '../useScoreRoomStatuses';
import { useAuthStore } from '../../../store/authStore';
import { gameRequest } from '../../../services/cardGames/gameApi';
import type { CardScoreMatch } from '../../../types/cardScore';

jest.mock('../../../services/cardGames/gameApi', () => ({
  gameRequest: jest.fn(),
}));
jest.mock('../../../services/cardGames/gameDeviceSession', () => ({
  getGameDeviceSessionId: jest
    .fn()
    .mockResolvedValue('11111111-1111-4111-8111-111111111111'),
}));
const uid = 'legacy-owner-test';
const match = { id: 'legacy', onlineRoomId: 'legacy-room' } as CardScoreMatch;
beforeEach(() => {
  useAuthStore.getState().setUser({ uid, email: 'owner@example.com' } as never);
  jest
    .mocked(gameRequest)
    .mockReset()
    .mockResolvedValue({ roomId: match.onlineRoomId, owner: true } as never);
});
afterEach(() => jest.restoreAllMocks());
it('clears legacy ownership on blur/background and requires a fresh successful lookup on return', async () => {
  let appListener!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      appListener = listener;
      return { remove: jest.fn() };
    });
  const listeners: Record<string, () => void> = {};
  const navigation = {
    addListener: (event: string, listener: () => void) => {
      listeners[event] = listener;
      return jest.fn();
    },
  };
  const epoch = useAuthStore.getState().sessionEpoch;
  const hook = renderHook(() =>
    useScoreRoomStatuses(uid, epoch, 0, [match, match], navigation),
  );
  await waitFor(() =>
    expect(hook.result.current.isOwner(match.onlineRoomId!)).toBe(true),
  );
  expect(gameRequest).toHaveBeenCalledTimes(1);
  const stalePermission = hook.result.current.isOwner;
  act(() => listeners.blur());
  expect(stalePermission(match.onlineRoomId!)).toBe(false);
  expect(hook.result.current.statuses).toEqual({});
  jest.mocked(gameRequest).mockRejectedValue(new Error('offline'));
  act(() => listeners.focus());
  await waitFor(() =>
    expect(hook.result.current.failedRooms[match.onlineRoomId!]).toBe(true),
  );
  expect(hook.result.current.isOwner(match.onlineRoomId!)).toBe(false);
  jest
    .mocked(gameRequest)
    .mockResolvedValue({ roomId: match.onlineRoomId, owner: true } as never);
  act(() => hook.result.current.retry());
  await waitFor(() =>
    expect(hook.result.current.isOwner(match.onlineRoomId!)).toBe(true),
  );
  act(() => appListener('background'));
  expect(hook.result.current.isOwner(match.onlineRoomId!)).toBe(false);
  jest
    .mocked(gameRequest)
    .mockResolvedValue({ roomId: match.onlineRoomId, owner: false } as never);
  act(() => appListener('active'));
  await waitFor(() =>
    expect(hook.result.current.statuses[match.onlineRoomId!]?.owner).toBe(
      false,
    ),
  );
  expect(hook.result.current.isOwner(match.onlineRoomId!)).toBe(false);
});
