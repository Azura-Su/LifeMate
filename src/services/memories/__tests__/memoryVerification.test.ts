import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '../../../store/authStore';
import { refreshAccountVerification } from '../../firebase/authService';
import {
  getMemoryShareState,
  unshareMemory,
  memoryEmailVerificationNeeded,
  memoryPublishDefinitelyNotStarted,
  refreshMemoryVerification,
  publishMemory,
} from '../memorySharing';
import * as FileSystem from 'expo-file-system/legacy';
import { prepareSharedMemoryPhoto } from '../memorySharedPhoto';
import { memoryPhotoUri } from '../memoryStorage';

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
jest.mock('expo-file-system/legacy', () => ({
  createUploadTask: jest.fn(),
  deleteAsync: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  FileSystemSessionType: { FOREGROUND: 0 },
}));
jest.mock('../memorySharedPhoto', () => ({
  prepareSharedMemoryPhoto: jest.fn(),
}));
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

it('coalesces concurrent state reads without retaining a completed permissions snapshot', async () => {
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  mockFetch.mockReturnValue(pending);
  const both = Promise.all([
    getMemoryShareState('u1', 'Asher'),
    getMemoryShareState('u1', 'Asher'),
  ]);
  for (let i = 0; i < 15; i++) await Promise.resolve();
  const concurrentRequests = mockFetch.mock.calls.length;
  finish(response(200, state));
  const [first, second] = await both;
  first.sharedIds.push('only-first-caller');
  expect(second.sharedIds).toEqual([]);
  mockFetch.mockResolvedValue(response(200, state));
  await getMemoryShareState('u1', 'Asher');
  expect(concurrentRequests).toBe(1);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it.each([200, 503])(
  'refreshes state after a mutation settles with HTTP %s',
  async (status) => {
    let finishMutation!: (value: unknown) => void;
    let finishState!: (value: unknown) => void;
    mockFetch.mockImplementation((_url, request) => {
      const action = JSON.parse(request.body).action;
      return new Promise((resolve) => {
        if (action === 'unshare') finishMutation = resolve;
        else finishState = resolve;
      });
    });
    const mutation = unshareMemory('u1', 'Asher', 'one').catch(() => undefined);
    const during = getMemoryShareState('u1', 'Asher');
    for (let i = 0; i < 15; i++) await Promise.resolve();
    finishMutation(response(status, { shared: false }));
    await mutation;
    const oldState = finishState;
    mockFetch.mockResolvedValue(
      response(200, { ...state, sharedIds: ['fresh'] }),
    );
    const after = getMemoryShareState('u1', 'Asher');
    for (let i = 0; i < 15; i++) await Promise.resolve();
    oldState(response(200, state));
    await during;
    expect((await after).sharedIds).toEqual(['fresh']);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  },
);

it('does not reuse a failed state response or a response for another display name', async () => {
  mockFetch.mockResolvedValueOnce(response(503, {}));
  await expect(getMemoryShareState('u1', 'Asher')).rejects.toThrow();
  mockFetch.mockResolvedValue(response(200, state));
  await Promise.all([
    getMemoryShareState('u1', 'Asher'),
    getMemoryShareState('u1', 'Tên mới'),
  ]);
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

it('reads new state after refreshing verification instead of joining a request with the old token', async () => {
  let finishOld!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finishOld = resolve;
    }),
  );
  const old = getMemoryShareState('u1', 'Asher');
  for (let i = 0; i < 15; i++) await Promise.resolve();
  jest.mocked(refreshAccountVerification).mockResolvedValueOnce(true);
  await refreshMemoryVerification('u1');
  mockFetch.mockResolvedValue(
    response(200, { ...state, sharedIds: ['verified-state'] }),
  );
  const fresh = getMemoryShareState('u1', 'Asher');
  for (let i = 0; i < 15; i++) await Promise.resolve();
  finishOld(response(200, state));
  await old;
  expect((await fresh).sharedIds).toEqual(['verified-state']);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('cancels all joined reads on logout and starts a fresh request after signing into the same UID', async () => {
  let finishOld!: (value: unknown) => void;
  mockFetch.mockReturnValue(
    new Promise((resolve) => {
      finishOld = resolve;
    }),
  );
  const first = getMemoryShareState('u1', 'Asher').catch(
    (error: Error) => error,
  );
  const joined = getMemoryShareState('u1', 'Asher').catch(
    (error: Error) => error,
  );
  for (let i = 0; i < 15; i++) await Promise.resolve();
  useAuthStore.getState().setUser(null);
  useAuthStore
    .getState()
    .setUser({ uid: 'u1', email: state.email, displayName: 'Asher' });
  mockFetch.mockResolvedValue(
    response(200, { ...state, sharedIds: ['new-session'] }),
  );
  const fresh = getMemoryShareState('u1', 'Asher');
  finishOld(response(200, state));
  expect(await first).toBeInstanceOf(Error);
  expect(await joined).toBeInstanceOf(Error);
  expect((await fresh).sharedIds).toEqual(['new-session']);
  expect(mockFetch).toHaveBeenCalledTimes(2);
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

it('uses transient camera dimensions for JPEG preparation but keeps them out of server requests', async () => {
  const dimensions = { width: 3000, height: 4000 };
  jest
    .mocked(memoryPhotoUri)
    .mockReturnValueOnce('file:///private-original.jpg');
  jest
    .mocked(prepareSharedMemoryPhoto)
    .mockResolvedValueOnce({ uri: 'file:///shared.jpg', sizeBytes: 12_345 });
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
  jest.mocked(FileSystem.createUploadTask).mockReturnValue({
    uploadAsync: jest.fn().mockResolvedValue({ status: 200 }),
    cancelAsync: jest.fn().mockResolvedValue(undefined),
  } as never);
  mockFetch
    .mockResolvedValueOnce(
      response(200, {
        uploadUrl:
          'https://example.test/storage/v1/object/upload/sign/lifemate-memories/shared/u1/one/photo.jpg?token=test',
      }),
    )
    .mockResolvedValueOnce(response(200, { shared: true }));
  await publishMemory(
    'u1',
    'Asher',
    {
      id: 'one',
      ownerId: 'u1',
      dateKey: '2026-10-15',
      text: 'Test',
      photoFileName: 'original.jpg',
      createdAt: 100,
      updatedAt: 100,
    },
    dimensions,
  );

  expect(prepareSharedMemoryPhoto).toHaveBeenCalledWith(
    'file:///private-original.jpg',
    dimensions,
  );
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
    action: 'publish',
    id: 'one',
    dateKey: '2026-10-15',
    text: 'Test',
    hasPhoto: true,
    sizeBytes: 12_345,
    displayName: 'Asher',
  });
  expect(JSON.parse(mockFetch.mock.calls[1][1].body).action).toBe('confirm');
});
