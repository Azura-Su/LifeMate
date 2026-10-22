import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';
import { useCardGame } from '../useCardGame';
import { createGameSession } from '../../services/cardGames/gameSession';
import { getGameDeviceSessionId } from '../../services/cardGames/gameDeviceSession';

jest.mock('../../config/cardGames', () => ({ cardGamesEnabled: () => true }));
jest.mock('../../hooks/useScreenActive', () => ({
  useScreenActive: () => true,
}));
jest.mock('../../services/cardGames/gameSession', () => ({
  createGameSession: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
}));
jest.mock('../../services/cardGames/gameApi', () => ({
  gameRequest: jest.fn(),
}));
jest.mock('../../services/cardGames/gameRealtime', () => ({
  subscribeGame: jest.fn(),
}));
jest.mock('../../services/cardGames/gameDeviceSession', () => ({
  getGameDeviceSessionId: jest.fn(),
}));

it('waits for the persisted device ID and ignores it if the account changes', async () => {
  let resolveSessionId!: (id: string) => void;
  jest.mocked(getGameDeviceSessionId).mockReturnValue(
    new Promise((resolve) => {
      resolveSessionId = resolve;
    }),
  );
  useAuthStore
    .getState()
    .setUser({
      uid: 'first',
      email: 'first@example.test',
      displayName: 'First',
    });

  const { rerender, unmount } = renderHook(
    ({ connect }: { connect: boolean }) => useCardGame(connect),
    { initialProps: { connect: false } },
  );
  expect(createGameSession).not.toHaveBeenCalled();

  rerender({ connect: true });
  await waitFor(() => expect(getGameDeviceSessionId).toHaveBeenCalled());
  expect(createGameSession).not.toHaveBeenCalled();

  act(() => {
    useAuthStore.getState().setUser({
      uid: 'second',
      email: 'second@example.test',
      displayName: 'Second',
    });
  });
  await act(async () =>
    resolveSessionId('11111111-1111-4111-8111-111111111111'),
  );

  await waitFor(() => expect(createGameSession).toHaveBeenCalledTimes(1));
  expect(createGameSession).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: '11111111-1111-4111-8111-111111111111',
    }),
  );
  unmount();
});
