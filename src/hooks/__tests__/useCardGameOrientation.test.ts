import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCardGameOrientation } from '../useCardGameOrientation';

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: {
    DEFAULT: 0,
    ALL: 1,
    PORTRAIT_UP: 3,
  },
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  jest.mocked(ScreenOrientation.lockAsync).mockReset();
  jest
    .mocked(ScreenOrientation.lockAsync)
    .mockImplementation(async (orientation) => {
      if (
        Platform.OS === 'ios' &&
        orientation === ScreenOrientation.OrientationLock.ALL
      ) {
        throw new Error('Unsupported orientation lock on notched iPhone');
      }
    });
  jest.mocked(ScreenOrientation.unlockAsync).mockClear();
});

afterEach(() => jest.restoreAllMocks());

it.each(['ios', 'android'] as const)(
  'allows portrait and landscape rotation on %s while a room is active',
  async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    const { rerender } = renderHook<
      void,
      { playing: boolean; active: boolean }
    >(({ playing, active }) => useCardGameOrientation(playing, active), {
      initialProps: { playing: false, active: true },
    });

    await waitFor(() =>
      expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ),
    );

    rerender({ playing: true, active: true });
    await waitFor(() =>
      expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
        Platform.OS === 'ios'
          ? ScreenOrientation.OrientationLock.DEFAULT
          : ScreenOrientation.OrientationLock.ALL,
      ),
    );

    rerender({ playing: true, active: false });
    await waitFor(() =>
      expect(ScreenOrientation.unlockAsync).toHaveBeenCalled(),
    );
  },
);

it('unlocks orientation when the game screen loses focus or unmounts', async () => {
  const { unmount, rerender } = renderHook<
    void,
    { playing: boolean; active: boolean }
  >(({ playing, active }) => useCardGameOrientation(playing, active), {
    initialProps: { playing: true, active: true },
  });

  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      Platform.OS === 'ios'
        ? ScreenOrientation.OrientationLock.DEFAULT
        : ScreenOrientation.OrientationLock.ALL,
    ),
  );
  rerender({ playing: true, active: false });
  await waitFor(() => expect(ScreenOrientation.unlockAsync).toHaveBeenCalled());
  jest.mocked(ScreenOrientation.unlockAsync).mockClear();
  rerender({ playing: false, active: true });
  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ),
  );
  unmount();
  await waitFor(() => expect(ScreenOrientation.unlockAsync).toHaveBeenCalled());
});
