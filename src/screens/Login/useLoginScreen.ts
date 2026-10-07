import { useRef, useState } from 'react';
import { login } from '../../services/firebase/authService';
import { getAuthErrorMessage, validateLogin } from '../../utils/auth';

export function useLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    const validationError = validateLogin(email, password);
    setError(validationError);
    if (validationError) return;
    submitting.current = true;
    setLoading(true);
    try {
      await login(email, password);
      setPassword('');
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    visible,
    toggleVisible: () => setVisible((v) => !v),
    loading,
    error,
    submit,
  };
}
