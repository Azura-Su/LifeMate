import { useAuthStore } from '../authStore';

const user = { uid: 'u1', email: 'a@b.co', displayName: null };

describe('registration session state', () => {
  beforeEach(() =>
    useAuthStore.setState({
      user: null,
      initializing: false,
      authView: 'login',
      registrationPhase: 'idle',
      registrationUid: null,
    }),
  );

  it('keeps registration active when Firebase signs in before setup finishes', () => {
    useAuthStore.getState().openRegistration();
    useAuthStore.getState().beginRegistration();
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState()).toMatchObject({
      authView: 'register',
      registrationPhase: 'creating',
      registrationUid: 'u1',
    });
    expect(useAuthStore.getState().markRegistrationCreated('u1')).toBe(true);
    expect(useAuthStore.getState().registrationPhase).toBe('created');
    useAuthStore.getState().finishRegistration('u1');
    expect(useAuthStore.getState()).toMatchObject({
      user,
      authView: 'login',
      registrationPhase: 'idle',
    });
  });

  it('drops stale setup when the session signs out or switches UID', () => {
    useAuthStore.getState().openRegistration();
    useAuthStore.getState().beginRegistration();
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().markRegistrationCreated('u1')).toBe(false);
    expect(useAuthStore.getState().authView).toBe('login');

    useAuthStore.getState().openRegistration();
    useAuthStore.getState().beginRegistration();
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setUser({ ...user, uid: 'u2' });
    expect(useAuthStore.getState().registrationPhase).toBe('idle');
    expect(useAuthStore.getState().user?.uid).toBe('u2');
  });

  it('releases the registration gate when creation fails after an auth event', () => {
    useAuthStore.getState().openRegistration();
    useAuthStore.getState().beginRegistration();
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().failRegistration();
    expect(useAuthStore.getState()).toMatchObject({
      user,
      authView: 'login',
      registrationPhase: 'idle',
      registrationUid: null,
    });
  });
});
