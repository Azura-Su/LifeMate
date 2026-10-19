import { act, renderHook } from '@testing-library/react-native';
import { AppState, Keyboard, Platform, type AppStateStatus } from 'react-native';
import { setVisibilityAsync } from 'expo-navigation-bar';
import { useAndroidNavigationBar } from '../useAndroidNavigationBar';

jest.mock('expo-navigation-bar', () => ({
  setVisibilityAsync: jest.fn().mockResolvedValue(undefined),
}));

let change: (state: AppStateStatus) => void;
let focus: () => void;
let keyboardHidden: () => void;
let removers: (jest.Mock | jest.SpyInstance)[];

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  AppState.currentState = 'active';
  removers = [];
  jest.mocked(setVisibilityAsync).mockReset().mockResolvedValue(undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') change = listener;
    if (event === 'focus') focus = () => listener('active');
    const remove = jest.fn();
    removers.push(remove);
    return { remove };
  });
  const addKeyboardListener = Keyboard.addListener.bind(Keyboard);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    if (event === 'keyboardDidHide') keyboardHidden = () => listener({} as never);
    const subscription = addKeyboardListener(event, listener);
    const remove = jest.spyOn(subscription, 'remove');
    removers.push(remove);
    return subscription;
  });
});

afterEach(() => jest.restoreAllMocks());

it('hides Android navigation on entry, return, focus and keyboard dismissal, then removes listeners', async () => {
  const { unmount } = renderHook(useAndroidNavigationBar);
  expect(setVisibilityAsync).toHaveBeenCalledWith('hidden');
  await act(async () => change('background'));
  expect(setVisibilityAsync).toHaveBeenCalledTimes(1);
  await act(async () => change('active'));
  await act(async () => focus());
  await act(async () => keyboardHidden());
  expect(setVisibilityAsync).toHaveBeenCalledTimes(4);
  unmount();
  expect(removers).toHaveLength(3);
  removers.forEach((remove) => expect(remove).toHaveBeenCalledTimes(1));
});

it('waits for foreground and ignores focus or keyboard events while backgrounded', async () => {
  AppState.currentState = 'background';
  renderHook(useAndroidNavigationBar);
  await act(async () => focus());
  await act(async () => keyboardHidden());
  expect(setVisibilityAsync).not.toHaveBeenCalled();
  AppState.currentState = 'active';
  await act(async () => change('active'));
  expect(setVisibilityAsync).toHaveBeenCalledTimes(1);
});

it('does not change system bars or attach listeners on iOS', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  renderHook(useAndroidNavigationBar);
  expect(setVisibilityAsync).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(Keyboard.addListener).not.toHaveBeenCalled();
});

it('handles native failures without an unhandled rejection and can retry on return', async () => {
  jest.mocked(setVisibilityAsync).mockRejectedValueOnce(new Error('No activity'));
  renderHook(useAndroidNavigationBar);
  await act(async () => change('active'));
  expect(setVisibilityAsync).toHaveBeenCalledTimes(2);
});
