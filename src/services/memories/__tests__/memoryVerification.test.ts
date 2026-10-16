import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { refreshAccountVerification } from '../../firebase/authService';
import {
  getMemoryShareState,
  memoryEmailVerificationNeeded,
  memoryPublishDefinitelyNotStarted,
} from '../memorySharing';

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('../../../config/audioCloud', () => ({
  audioCloudUrl: () => 'https://example.test',
  audioCloudApiKey: () => 'test-publishable-key',
}));
jest.mock('../../firebase/authService', () => ({
  refreshAccountVerification: jest.fn(),
  sendAccountVerificationEmail: jest.fn(),
}));
jest.mock('../memoryStorage', () => ({ memoryPhotoUri: jest.fn() }));

const originalFetch = global.fetch;
const mockFetch = jest.fn();
const state = {
  email: 'a@example.com',
  friends: [],
  incoming: [],
  outgoing: [],
  sharedIds: [],
  legacyIds: [],
};
const response = (status: number, data: unknown) => ({
  ok: status === 200,
  status,
  json: async () => data,
});

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'u1', email: state.email, displayName: 'Asher' },
  });
  jest.mocked(getAuth).mockReturnValue({ currentUser: { uid: 'u1' } } as never);
  jest.mocked(getIdToken).mockReset().mockResolvedValue('cached-token');
  jest.mocked(refreshAccountVerification).mockReset().mockResolvedValue(false);
  global.fetch = mockFetch;
  mockFetch.mockReset();
});

afterAll(() => {
  global.fetch = originalFetch;
});

it('refreshes a stale unverified token and reloads sharing with the new token', async () => {
  mockFetch
    .mockResolvedValueOnce(response(403, { code: 'email-not-verified' }))
    .mockResolvedValueOnce(response(200, state));
  jest.mocked(refreshAccountVerification).mockResolvedValueOnce(true);
  jest
    .mocked(getIdToken)
    .mockResolvedValueOnce('cached-token')
    .mockResolvedValueOnce('fresh-token');

  await expect(getMemoryShareState('u1', 'Asher')).resolves.toEqual(state);
  expect(refreshAccountVerification).toHaveBeenCalledWith('u1');
  expect(
    mockFetch.mock.calls.map(([, options]) => options.headers.Authorization),
  ).toEqual(['Bearer cached-token', 'Bearer fresh-token']);
});

it('keeps the verification warning if Firebase still reports an unverified email', async () => {
  mockFetch.mockResolvedValue(response(403, { code: 'email-not-verified' }));
  const error = await getMemoryShareState('u1', 'Asher').catch(
    (cause) => cause,
  );
  expect(memoryEmailVerificationNeeded(error)).toBe(true);
  expect(refreshAccountVerification).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('stops after one retry if the server still rejects the verified token', async () => {
  mockFetch.mockResolvedValue(response(403, { code: 'email-not-verified' }));
  jest.mocked(refreshAccountVerification).mockResolvedValueOnce(true);
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'chưa được xác nhận',
  );
  expect(refreshAccountVerification).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('does not retry with another account after the session changes during refresh', async () => {
  mockFetch.mockResolvedValue(response(403, { code: 'email-not-verified' }));
  jest.mocked(refreshAccountVerification).mockImplementationOnce(async () => {
    useAuthStore.setState({
      user: { uid: 'other', email: 'other@example.com', displayName: null },
    });
    return true;
  });
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('does not retry other authorization errors', async () => {
  mockFetch.mockResolvedValue(response(403, { code: 'unauthenticated' }));
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'Phiên đăng nhập',
  );
  expect(refreshAccountVerification).not.toHaveBeenCalled();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('preserves a definite pre-mutation rejection if verification refresh fails', async () => {
  mockFetch.mockResolvedValue(response(403, { code: 'email-not-verified' }));
  jest
    .mocked(refreshAccountVerification)
    .mockRejectedValueOnce(new Error('offline'));
  const error = await getMemoryShareState('u1', 'Asher').catch(
    (cause) => cause,
  );
  expect(memoryPublishDefinitelyNotStarted(error)).toBe(true);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('keeps a network failure ambiguous after the retry is sent', async () => {
  mockFetch
    .mockResolvedValueOnce(response(403, { code: 'email-not-verified' }))
    .mockRejectedValueOnce(new Error('offline'));
  jest.mocked(refreshAccountVerification).mockResolvedValueOnce(true);
  const error = await getMemoryShareState('u1', 'Asher').catch(
    (cause) => cause,
  );
  expect(error.message).toBe('offline');
  expect(memoryPublishDefinitelyNotStarted(error)).toBe(false);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
