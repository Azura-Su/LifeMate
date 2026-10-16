import { useEffect, useRef, useState } from 'react';
import {
  createAccount,
  currentSessionUser,
  refreshAccountVerification,
  sendAccountVerificationEmail,
  updateAccountDisplayName,
} from '../../services/firebase/authService';
import { useAuthStore } from '../../store/authStore';
import { useConfigStore } from '../../store/configStore';
import {
  getRegistrationErrorMessage,
  validateRegistration,
} from '../../utils/auth';
import { normalizeEmail } from '../../utils/users';

type CreatedAccount = {
  uid: string;
  email: string;
  profileSaved: boolean;
  verificationSent: boolean;
  emailVerified: boolean;
};

function isCurrentRegistration(uid: string) {
  const state = useAuthStore.getState();
  return (
    state.registrationPhase === 'created' &&
    state.registrationUid === uid &&
    currentSessionUser(uid)?.uid === uid
  );
}

function syncSessionProfile(uid: string) {
  if (!isCurrentRegistration(uid)) return;
  const user = currentSessionUser(uid);
  if (user) useAuthStore.getState().setUser(user);
}

export function useRegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<
    'create' | 'profile' | 'send' | 'check' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  async function submit() {
    if (submitting.current) return;
    if (!useConfigStore.getState().registrationEnabled) {
      useAuthStore.getState().closeRegistration();
      return;
    }
    const validationError = validateRegistration(
      name,
      email,
      password,
      confirmation,
    );
    setError(validationError);
    if (validationError) return;
    submitting.current = true;
    setBusy('create');
    useAuthStore.getState().beginRegistration();
    if (useAuthStore.getState().registrationPhase !== 'creating') {
      submitting.current = false;
      setBusy(null);
      return;
    }
    try {
      let uid: string;
      try {
        uid = await createAccount(email, password);
      } catch (cause) {
        // Auth can commit the new account before a request reports failure.
        const observed = useAuthStore.getState().user;
        const code =
          cause && typeof cause === 'object' && 'code' in cause
            ? cause.code
            : null;
        if (
          (code !== 'auth/network-request-failed' &&
            code !== 'auth/internal-error') ||
          !observed ||
          normalizeEmail(observed.email ?? '') !== normalizeEmail(email) ||
          currentSessionUser(observed.uid)?.uid !== observed.uid
        ) {
          useAuthStore.getState().failRegistration();
          if (mounted.current) setError(getRegistrationErrorMessage(cause));
          return;
        }
        uid = observed.uid;
      }
      if (!useAuthStore.getState().markRegistrationCreated(uid)) {
        useAuthStore.getState().failRegistration();
        return;
      }
      if (mounted.current) {
        setPassword('');
        setConfirmation('');
      }
      if (!isCurrentRegistration(uid)) return;
      let verificationSent = false;
      try {
        await sendAccountVerificationEmail(uid);
        verificationSent = true;
      } catch {
        // The account already exists; the completion screen offers a resend.
      }
      if (!isCurrentRegistration(uid)) return;
      let profileSaved = false;
      try {
        await updateAccountDisplayName(uid, name);
        profileSaved = true;
        syncSessionProfile(uid);
      } catch {
        // The account already exists; the completion screen offers a retry.
      }
      if (mounted.current && isCurrentRegistration(uid)) {
        syncSessionProfile(uid);
        setCreated({
          uid,
          email: currentSessionUser(uid)?.email ?? normalizeEmail(email),
          profileSaved,
          verificationSent,
          emailVerified: false,
        });
        setError(null);
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  async function retryProfile() {
    if (!created || busy || !isCurrentRegistration(created.uid)) return;
    setBusy('profile');
    setError(null);
    try {
      await updateAccountDisplayName(created.uid, name);
      if (!isCurrentRegistration(created.uid)) return;
      syncSessionProfile(created.uid);
      if (mounted.current)
        setCreated((value) =>
          value ? { ...value, profileSaved: true } : value,
        );
    } catch {
      if (mounted.current)
        setError('Chưa lưu được tên hiển thị. Vui lòng thử lại.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function resendVerification() {
    if (!created || busy || !isCurrentRegistration(created.uid)) return;
    setBusy('send');
    setError(null);
    try {
      await sendAccountVerificationEmail(created.uid);
      if (mounted.current && isCurrentRegistration(created.uid))
        setCreated((value) =>
          value ? { ...value, verificationSent: true } : value,
        );
    } catch {
      if (mounted.current)
        setError('Chưa gửi được thư xác nhận. Vui lòng thử lại sau.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function checkVerification() {
    if (!created || busy || !isCurrentRegistration(created.uid)) return;
    setBusy('check');
    setError(null);
    try {
      const verified = await refreshAccountVerification(created.uid);
      if (mounted.current && isCurrentRegistration(created.uid)) {
        setCreated((value) =>
          value ? { ...value, emailVerified: verified } : value,
        );
        if (verified) {
          syncSessionProfile(created.uid);
          useAuthStore.getState().finishRegistration(created.uid);
        } else {
          setError('Email chưa được xác nhận. Hãy kiểm tra hộp thư.');
        }
      }
    } catch {
      if (mounted.current)
        setError('Chưa kiểm tra được email. Vui lòng thử lại sau.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  function continueToApp() {
    if (!created || !isCurrentRegistration(created.uid)) return;
    syncSessionProfile(created.uid);
    useAuthStore.getState().finishRegistration(created.uid);
  }

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    visible,
    toggleVisible: () => setVisible((value) => !value),
    busy,
    error,
    created,
    submit,
    retryProfile,
    resendVerification,
    checkVerification,
    continueToApp,
  };
}
