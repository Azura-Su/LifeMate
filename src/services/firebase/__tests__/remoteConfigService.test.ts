import { loadRemoteConfig, observeRemoteConfig } from '../remoteConfigService';

const mockConfig = { defaultConfig: {}, settings: {} };
const mockFetch = jest.fn();
const mockString = jest.fn();
const mockBoolean = jest.fn();
const mockActivate = jest.fn();
const mockUnsubscribe = jest.fn();
const mockOnConfigUpdate = jest.fn();
jest.mock('@react-native-firebase/remote-config', () => ({
  getRemoteConfig: () => mockConfig,
  ensureInitialized: jest.fn().mockResolvedValue(undefined),
  fetchAndActivate: (...args: unknown[]) => mockFetch(...args),
  getString: (...args: unknown[]) => mockString(...args),
  getBoolean: (...args: unknown[]) => mockBoolean(...args),
  activate: (...args: unknown[]) => mockActivate(...args),
  onConfigUpdate: (...args: unknown[]) => mockOnConfigUpdate(...args),
}));

const previous = [{ mail: 'old@b.co', name: 'Saved' }];

describe('Remote Config resilience', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockString.mockReset();
    mockBoolean.mockReset().mockReturnValue(false);
    mockActivate.mockReset().mockResolvedValue(true);
    mockUnsubscribe.mockReset();
    mockOnConfigUpdate.mockReset().mockReturnValue(mockUnsubscribe);
  });
  it('loads activated cache even when the network fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    mockString.mockReturnValue('[{"mail":"cached@b.co","name":"Cached"}]');
    mockBoolean.mockReturnValue(true);
    const result = await loadRemoteConfig(previous);
    expect(result.users[0].name).toBe('Cached');
    expect(result.registrationEnabled).toBe(true);
    expect(result.warning).toBeTruthy();
  });
  it('keeps the last valid list when the server publishes invalid JSON', async () => {
    mockFetch.mockResolvedValue(true);
    mockString.mockReturnValue('{broken');
    expect((await loadRemoteConfig(previous)).users).toEqual(previous);
  });
  it('allows an explicitly empty published list', async () => {
    mockFetch.mockResolvedValue(true);
    mockString.mockReturnValue('[]');
    expect((await loadRemoteConfig(previous)).users).toEqual([]);
  });
  it('keeps registration hidden before a remote value is activated', async () => {
    mockFetch.mockResolvedValue(false);
    mockString.mockReturnValue('[]');
    const result = await loadRemoteConfig(previous);
    expect(result.registrationEnabled).toBe(false);
    expect(mockConfig.defaultConfig).toMatchObject({
      registration_enabled: false,
    });
  });
  it('activates realtime updates and ignores a late result after unsubscribe', async () => {
    const changed = jest.fn();
    const failed = jest.fn();
    let finish!: (value: boolean) => void;
    mockActivate.mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const unsubscribe = observeRemoteConfig(changed, failed);
    const observer = mockOnConfigUpdate.mock.calls[0][1];
    observer.next({ updatedKeys: new Set(['registration_enabled']) });
    unsubscribe();
    finish(true);
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
  });
  it('reports realtime activation and listener errors', async () => {
    const changed = jest.fn();
    const failed = jest.fn();
    mockActivate.mockRejectedValueOnce(new Error('offline'));
    const unsubscribe = observeRemoteConfig(changed, failed);
    const observer = mockOnConfigUpdate.mock.calls[0][1];
    observer.next({ updatedKeys: new Set(['registration_enabled']) });
    await Promise.resolve();
    await Promise.resolve();
    observer.error(new Error('listener closed'));
    expect(failed).toHaveBeenCalledTimes(2);
    expect(changed).not.toHaveBeenCalled();
    unsubscribe();
  });
});
