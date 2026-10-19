import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { refreshAccountVerification } from '../../firebase/authService';
import {
  getMemoryShareState,
  unshareMemory,
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

it.each(['timeout', 'logout', 'relogin'] as const)(
  'bounds stalled sharing token retrieval on %s',
  async (reason) => {
    jest.useFakeTimers();
    let release!: (value: string) => void;
    jest.mocked(getIdToken).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    mockFetch.mockResolvedValue(response(200, state));
    const operation = getMemoryShareState('u1', 'Asher').catch(
      (error: Error) => error.message,
    );
    try {
      await jest.advanceTimersByTimeAsync(0);
      if (reason === 'timeout') await jest.advanceTimersByTimeAsync(20001);
      else {
        useAuthStore.getState().setUser(null);
        if (reason === 'relogin')
          useAuthStore
            .getState()
            .setUser({ uid: 'u1', email: null, displayName: null });
        await jest.advanceTimersByTimeAsync(0);
      }
      expect(
        await Promise.race([operation, Promise.resolve('still pending')]),
      ).not.toBe('still pending');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      release('late-token');
      await jest.advanceTimersByTimeAsync(0);
      await operation;
      jest.useRealTimers();
    }
    expect(mockFetch).not.toHaveBeenCalled();
  },
);

it('includes verification refresh and its retry in the original sharing deadline', async () => {
  jest.useFakeTimers();
  let release!: (value: boolean) => void;
  jest.mocked(refreshAccountVerification).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  mockFetch
    .mockResolvedValueOnce(response(403, { code: 'email-not-verified' }))
    .mockResolvedValue(response(200, state));
  const operation = getMemoryShareState('u1', 'Asher').catch(
    (error: Error) => error.message,
  );
  try {
    await jest.advanceTimersByTimeAsync(19000);
    expect(refreshAccountVerification).toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1001);
    expect(
      await Promise.race([operation, Promise.resolve('still pending')]),
    ).not.toBe('still pending');
  } finally {
    release(true);
    await jest.advanceTimersByTimeAsync(0);
    await operation;
    jest.useRealTimers();
  }
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('does not restart an old sharing read after logout and login with the same UID', async () => {
  jest.useFakeTimers();
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    })
    .mockResolvedValue(response(200, state));
  const operation = getMemoryShareState('u1', 'Asher').catch(
    (error: Error) => error.message,
  );
  try {
    await jest.advanceTimersByTimeAsync(0);
    useAuthStore.getState().setUser(null);
    useAuthStore
      .getState()
      .setUser({ uid: 'u1', email: null, displayName: null });
    await jest.advanceTimersByTimeAsync(0);
    expect(await operation).toMatch(/thay đổi/i);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('explains a busy migration instead of reporting that the memory is already shared', async () => {
  mockFetch.mockResolvedValue(response(409, { code: 'memory-migrating' }));
  await expect(unshareMemory('u1', 'Asher', 'one')).rejects.toThrow(
    'Đang chuyển ảnh',
  );
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

it('reports empty successful JSON explicitly without treating it as private state', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected end of input');
    },
  });
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'Phản hồi chia sẻ chưa đầy đủ',
  );
});
it('keeps a body-read abort recognizable as a timeout', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    },
  });
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'Kết nối chia sẻ quá lâu',
  );
});
it('rejects array responses and malformed shared IDs rather than assuming private visibility', async () => {
  mockFetch.mockResolvedValueOnce(response(200, []));
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'Phản hồi chia sẻ không hợp lệ',
  );
  mockFetch.mockResolvedValueOnce(
    response(200, { ...state, sharedIds: ['valid', '../invalid'] }),
  );
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'Chưa đọc được danh sách chia sẻ',
  );
});
it('still handles an unauthorized response when its error body is unreadable', async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => {
      throw new SyntaxError('Invalid JSON');
    },
  });
  const error = await getMemoryShareState('u1', 'Asher').catch(
    (cause) => cause,
  );
  expect(memoryPublishDefinitelyNotStarted(error)).toBe(true);
  expect(refreshAccountVerification).not.toHaveBeenCalled();
});

it('recovers once from an unreadable successful state response using a fresh request', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected end');
      },
    })
    .mockResolvedValueOnce(response(200, state));
  await expect(getMemoryShareState('u1', 'Asher')).resolves.toMatchObject({
    email: state.email,
  });
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFetch.mock.calls[0][1].signal).not.toBe(
    mockFetch.mock.calls[1][1].signal,
  );
});

it('stops after one response retry and never turns unreadable state into private state', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected end');
    },
  });
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow(
    'chưa đầy đủ',
  );
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('does not resend a mutation when its successful response is unreadable', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected end');
    },
  });
  const error = await unshareMemory('u1', 'Asher', 'one').catch(
    (cause) => cause,
  );
  expect(error.message).toContain('chưa đầy đủ');
  expect(memoryPublishDefinitelyNotStarted(error)).toBe(false);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it.each(['fetch', 'body'])(
  'bounds a stalled %s even if native abort does not reject it',
  async (stage) => {
    jest.useFakeTimers();
    try {
      if (stage === 'fetch') mockFetch.mockReturnValue(new Promise(() => {}));
      else
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () => new Promise(() => {}),
        });
      const result = getMemoryShareState('u1', 'Asher').catch((cause) => cause);
      await jest.advanceTimersByTimeAsync(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(20000);
      expect((await result).message).toContain('quá lâu');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  },
);

it('keeps the original time budget across the response retry', async () => {
  jest.useFakeTimers();
  try {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new SyntaxError('Unexpected end')), 5000),
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => new Promise(() => {}),
      });
    const result = getMemoryShareState('u1', 'Asher').catch((cause) => cause);
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(15000);
    expect((await result).message).toContain('quá lâu');
  } finally {
    jest.useRealTimers();
  }
});

it('does not retry a response for an account that has changed', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      useAuthStore.setState({
        user: { uid: 'other', email: 'other@example.com', displayName: null },
      });
      throw new SyntaxError('Unexpected end');
    },
  });
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow('Phiên');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
