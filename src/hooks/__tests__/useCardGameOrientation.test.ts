import { renderHook, waitFor } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCardGameOrientation } from '../useCardGameOrientation';

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: {
    LANDSCAPE: 5,
    PORTRAIT_UP: 3,
  },
  lockAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => jest.mocked(ScreenOrientation.lockAsync).mockClear());

it('uses landscape only while the active card game is playing', async () => {
  const { rerender } = renderHook<
    void,
    { playing: boolean; active: boolean }
  >(
    ({ playing, active }) => useCardGameOrientation(playing, active),
    { initialProps: { playing: false, active: true } },
  );

  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ),
  );

  rerender({ playing: true, active: true });
  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    ),
  );

  rerender({ playing: true, active: false });
  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ),
  );
});

it('restores portrait when the game screen unmounts', async () => {
  const { unmount } = renderHook(() => useCardGameOrientation(true, true));

  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    ),
  );
  unmount();
  await waitFor(() =>
    expect(ScreenOrientation.lockAsync).toHaveBeenLastCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ),
  );
});
