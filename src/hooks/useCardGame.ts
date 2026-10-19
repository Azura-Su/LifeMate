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
import { useScreenActive } from './useScreenActive';

export function useCardGame() {
  const uid = useAuthStore((s) => s.user?.uid);
  const epoch = useAuthStore((s) => s.sessionEpoch);
  const active = useScreenActive();
  const enabled = cardGamesEnabled();
  const [value, setValue] = useState<{
    uid: string;
    epoch: number;
    state: GameSessionState;
  } | null>(null);
  const session = useMemo(
    () =>
      uid
        ? createGameSession({
            sessionId: randomUUID(),
            uuid: randomUUID,
            request: (input, signal) => gameRequest(uid, input, signal),
            subscribe: (topic, hint, status) =>
              subscribeGame(uid, topic, hint, status),
            onChange: (state) => setValue({ uid, epoch, state }),
          })
        : null,
    [uid, epoch],
  );
  useEffect(() => {
    if (!session || !active || !enabled) return;
    session.start();
    return () => session.stop();
  }, [session, active, enabled]);
  const state =
    value?.uid === uid && value?.epoch === epoch ? value.state : null;
  return { enabled, active, uid, session, state };
}
