import { create } from 'zustand';
import type { SessionUser } from '../types/models';

type AuthState = {
  user: SessionUser | null;
  /** Changes only across account boundaries, not profile metadata refreshes. */
  sessionEpoch: number;
  initializing: boolean;
  authView: 'login' | 'register';
  registrationPhase: 'idle' | 'creating' | 'created';
  registrationUid: string | null;
  setUser: (user: SessionUser | null) => void;
  openRegistration: () => void;
  closeRegistration: () => void;
  beginRegistration: () => void;
  markRegistrationCreated: (uid: string) => boolean;
  failRegistration: () => void;
  finishRegistration: (uid: string) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  sessionEpoch: 0,
  initializing: true,
  authView: 'login',
  registrationPhase: 'idle',
  registrationUid: null,
  setUser: (user) =>
    set((state) => {
      const sessionEpoch =
        state.sessionEpoch + (state.user?.uid !== user?.uid ? 1 : 0);
      if (!user)
        return {
          user: null,
          sessionEpoch,
          initializing: false,
          authView: 'login',
          registrationPhase: 'idle',
          registrationUid: null,
        };
      if (
        state.registrationPhase !== 'idle' &&
        (!state.registrationUid || state.registrationUid === user.uid)
      )
        return {
          user,
          sessionEpoch,
          initializing: false,
          registrationUid: user.uid,
        };
      return {
        user,
        sessionEpoch,
        initializing: false,
        authView: 'login',
        registrationPhase: 'idle',
        registrationUid: null,
      };
    }),
  openRegistration: () =>
    set((state) =>
      !state.user && state.registrationPhase === 'idle'
        ? { authView: 'register' }
        : state,
    ),
  closeRegistration: () =>
    set((state) =>
      state.registrationPhase === 'idle' ? { authView: 'login' } : state,
    ),
  beginRegistration: () =>
    set((state) =>
      state.authView === 'register' &&
      !state.user &&
      state.registrationPhase === 'idle'
        ? { registrationPhase: 'creating', registrationUid: null }
        : state,
    ),
  markRegistrationCreated: (uid) => {
    let accepted = false;
    set((state) => {
      if (
        state.registrationPhase !== 'creating' ||
        (state.registrationUid && state.registrationUid !== uid) ||
        (state.user && state.user.uid !== uid)
      )
        return state;
      accepted = true;
      return { registrationPhase: 'created', registrationUid: uid };
    });
    return accepted;
  },
  failRegistration: () =>
    set((state) =>
      state.registrationPhase === 'creating'
        ? {
            authView: state.user ? 'login' : 'register',
            registrationPhase: 'idle',
            registrationUid: null,
          }
        : state,
    ),
  finishRegistration: (uid) =>
    set((state) =>
      state.registrationPhase === 'created' &&
      state.registrationUid === uid &&
      state.user?.uid === uid
        ? {
            authView: 'login',
            registrationPhase: 'idle',
            registrationUid: null,
          }
        : state,
    ),
}));
