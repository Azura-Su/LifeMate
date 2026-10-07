import { loadRemoteUsers } from '../remoteConfigService';

const mockConfig = { defaultConfig: {}, settings: {} };
const mockFetch = jest.fn();
const mockString = jest.fn();
jest.mock('@react-native-firebase/remote-config', () => ({
  getRemoteConfig: () => mockConfig,
  ensureInitialized: jest.fn().mockResolvedValue(undefined),
  fetchAndActivate: (...args: unknown[]) => mockFetch(...args),
  getString: (...args: unknown[]) => mockString(...args),
}));

const previous = [{ mail: 'old@b.co', name: 'Saved' }];

describe('Remote Config resilience', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockString.mockReset();
  });
  it('loads activated cache even when the network fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    mockString.mockReturnValue('[{"mail":"cached@b.co","name":"Cached"}]');
    const result = await loadRemoteUsers(previous);
    expect(result.users[0].name).toBe('Cached');
    expect(result.warning).toBeTruthy();
  });
  it('keeps the last valid list when the server publishes invalid JSON', async () => {
    mockFetch.mockResolvedValue(true);
    mockString.mockReturnValue('{broken');
    expect((await loadRemoteUsers(previous)).users).toEqual(previous);
  });
  it('allows an explicitly empty published list', async () => {
    mockFetch.mockResolvedValue(true);
    mockString.mockReturnValue('[]');
    expect((await loadRemoteUsers(previous)).users).toEqual([]);
  });
});
