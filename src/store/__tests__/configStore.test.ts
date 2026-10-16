import { useConfigStore } from '../configStore';
import {
  loadRemoteConfig,
  readActivatedRemoteConfig,
} from '../../services/firebase/remoteConfigService';

jest.mock('../../services/firebase/remoteConfigService', () => ({
  loadRemoteConfig: jest.fn(),
  readActivatedRemoteConfig: jest.fn(),
}));

describe('Remote Config state', () => {
  beforeEach(() => {
    useConfigStore.setState({
      users: [],
      registrationEnabled: false,
      loading: false,
      warning: null,
    });
    jest.mocked(loadRemoteConfig).mockReset();
    jest.mocked(readActivatedRemoteConfig).mockReset();
  });

  it('keeps a realtime change when a prior refresh finishes later', async () => {
    let finish!: (value: {
      users: [];
      registrationEnabled: boolean;
      warning: null;
    }) => void;
    jest
      .mocked(loadRemoteConfig)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve)),
      );
    jest.mocked(readActivatedRemoteConfig).mockReturnValue({
      users: [],
      registrationEnabled: true,
    });

    const refresh = useConfigStore.getState().refresh();
    useConfigStore.getState().applyActivated();
    finish({ users: [], registrationEnabled: false, warning: null });
    await refresh;

    expect(useConfigStore.getState().registrationEnabled).toBe(true);
    expect(useConfigStore.getState().loading).toBe(false);
  });
});
