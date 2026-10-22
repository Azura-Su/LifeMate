import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { cardGamesEnabled } from '../config/cardGames';
import { useAuthStore } from '../store/authStore';
import { gameRequest } from '../services/cardGames/gameApi';
import { subscribeGame } from '../services/cardGames/gameRealtime';
import {
  createGameSession,
  type GameSessionState,
} from '../services/cardGames/gameSession';
import { getGameDeviceSessionId } from '../services/cardGames/gameDeviceSession';
import { useScreenActive } from './useScreenActive';

export function useCardGame(connect = true) {
  const uid = useAuthStore((s) => s.user?.uid);
  const epoch = useAuthStore((s) => s.sessionEpoch);
  const active = useScreenActive();
  const enabled = cardGamesEnabled();
  const [deviceSession, setDeviceSession] = useState<{
    uid: string;
    epoch: number;
    id: string;
  } | null>(null);
  const [sessionInitializationError, setSessionInitializationError] = useState<
    string | null
  >(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [value, setValue] = useState<{
    uid: string;
    epoch: number;
    sessionId: string;
    state: GameSessionState;
  } | null>(null);

  useEffect(() => {
    if (!uid || !connect) return;
    let current = true;
    setSessionInitializationError(null);
    void getGameDeviceSessionId()
      .then((id) => {
        if (current) setDeviceSession({ uid, epoch, id });
      })
      .catch(() => {
        if (current)
          setSessionInitializationError(
            'Chưa khôi phục được phiên chơi trên thiết bị này. Hãy thử lại.',
          );
      });
    return () => {
      current = false;
    };
  }, [uid, epoch, connect, initializationAttempt]);

  const sessionId =
    deviceSession && deviceSession.uid === uid && deviceSession.epoch === epoch
      ? deviceSession.id
      : null;
  const session = useMemo(
    () =>
      uid && connect && sessionId
        ? createGameSession({
            sessionId,
            uuid: randomUUID,
            request: (input, signal) => gameRequest(uid, input, signal),
            subscribe: (topic, hint, status) =>
              subscribeGame(uid, topic, hint, status),
            onChange: (state) => setValue({ uid, epoch, sessionId, state }),
          })
        : null,
    [uid, epoch, connect, sessionId],
  );
  useEffect(() => {
    if (!session || !active || !enabled) return;
    session.start();
    return () => session.stop();
  }, [session, active, enabled]);
  const state =
    value?.uid === uid &&
    value?.epoch === epoch &&
    value.sessionId === sessionId
      ? value.state
      : null;
  return {
    enabled,
    active,
    uid,
    session,
    state,
    sessionInitializationError,
    retrySessionInitialization: () => {
      setSessionInitializationError(null);
      setInitializationAttempt((attempt) => attempt + 1);
    },
  };
}
