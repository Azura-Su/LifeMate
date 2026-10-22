import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { gameRequest } from '../../services/cardGames/gameApi';
import { getGameDeviceSessionId } from '../../services/cardGames/gameDeviceSession';
import type { CardScoreMatch } from '../../types/cardScore';
import type { GameRoomStatus } from '../../types/cardGame';
import { useAuthStore } from '../../store/authStore';

export function useScoreRoomStatuses(
  uid: string | undefined,
  epoch: number,
  reloadKey: number,
  matches: CardScoreMatch[],
  navigation: {
    addListener: (event: 'focus' | 'blur', listener: () => void) => () => void;
    isFocused?: () => boolean;
  },
) {
  const key = [
    ...new Set(
      matches
        .map((match) => match.onlineRoomId)
        .filter((id): id is string => !!id),
    ),
  ]
    .sort()
    .join(',');
  const [state, setState] = useState<{
    key: string;
    uid?: string;
    epoch: number;
    statuses: Record<string, GameRoomStatus>;
    failedRooms: Record<string, boolean>;
  }>({ key: '', epoch: -1, statuses: {}, failedRooms: {} });
  const [retryKey, retry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const owners = useRef<Record<string, boolean>>({});
  const focused = useRef(navigation.isFocused?.() ?? true);
  const foreground = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  useEffect(() => {
    const clear = () => {
      owners.current = {};
      request.current?.abort();
      setState({ key: '', epoch: -1, statuses: {}, failedRooms: {} });
    };
    const offFocus = navigation.addListener('focus', () => {
      clear();
      focused.current = true;
      retry((value) => value + 1);
    });
    const offBlur = navigation.addListener('blur', () => {
      focused.current = false;
      clear();
    });
    const app = AppState.addEventListener('change', (value) => {
      clear();
      foreground.current = value === 'active';
      if (foreground.current) retry((value) => value + 1);
    });
    return () => {
      owners.current = {};
      request.current?.abort();
      offFocus();
      offBlur();
      app.remove();
    };
  }, [navigation]);
  useEffect(() => {
    owners.current = {};
    if (!uid || !key || !focused.current || !foreground.current) return;
    const controller = new AbortController();
    request.current = controller;
    const rooms = key.split(',');
    setState({ key, uid, epoch, statuses: {}, failedRooms: {} });
    const failure = (roomIds: string[]) => {
      if (!controller.signal.aborted)
        setState((current) => ({
          ...current,
          failedRooms: {
            ...current.failedRooms,
            ...Object.fromEntries(roomIds.map((id) => [id, true])),
          },
        }));
    };
    void getGameDeviceSessionId()
      .then(async (sessionId) => {
        // Publish each completed room independently; at most two lookups in flight.
        const worker = async () => {
          for (let roomId = rooms.shift(); roomId; roomId = rooms.shift()) {
            if (controller.signal.aborted) return;
            try {
              const status = await gameRequest(
                uid,
                { type: 'room-status', roomId, sessionId },
                controller.signal,
              );
              if (!controller.signal.aborted) {
                owners.current[roomId] = status.owner;
                setState((current) => ({
                  ...current,
                  statuses: { ...current.statuses, [roomId]: status },
                }));
              }
            } catch {
              failure([roomId]);
            }
          }
        };
        await Promise.all([worker(), worker()]);
      })
      .catch(() => failure(key.split(',')));
    return () => {
      controller.abort();
      owners.current = {};
    };
  }, [uid, epoch, key, reloadKey, retryKey, navigation]);
  const current =
    focused.current &&
    foreground.current &&
    state.uid === uid &&
    state.epoch === epoch &&
    state.key === key;
  return {
    statuses: current ? state.statuses : {},
    failedRooms: current ? state.failedRooms : {},
    retry: () => retry((value) => value + 1),
    invalidate: (roomId: string) => {
      owners.current[roomId] = false;
      setState((current) => {
        const statuses = { ...current.statuses };
        delete statuses[roomId];
        return {
          ...current,
          statuses,
          failedRooms: { ...current.failedRooms, [roomId]: true },
        };
      });
    },
    isOwner: (roomId: string) =>
      current &&
      useAuthStore.getState().user?.uid === uid &&
      useAuthStore.getState().sessionEpoch === epoch &&
      owners.current[roomId] === true,
  };
}
