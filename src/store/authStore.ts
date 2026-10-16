import { create } from 'zustand';
import type { SessionUser } from '../types/models';

type AuthState = {
  user: SessionUser | null;
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
  initializing: true,
  authView: 'login',
  registrationPhase: 'idle',
  registrationUid: null,
  setUser: (user) =>
    set((state) => {
      if (!user)
        return {
          user: null,
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
          initializing: false,
          registrationUid: user.uid,
        };
      return {
        user,
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
