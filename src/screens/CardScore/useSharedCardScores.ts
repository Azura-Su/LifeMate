import { sharedScorePatch } from '../../utils/sharedScorePatch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useAuthStore } from '../../store/authStore';
import { gameRequest } from '../../services/cardGames/gameApi';
import { getGameDeviceSessionId } from '../../services/cardGames/gameDeviceSession';
import { cacheSharedCardScoreMatches } from '../../services/cardScore/cardScoreStorage';
import type { CardScoreMatch } from '../../types/cardScore';

type Navigation = {
  addListener: (event: 'focus' | 'blur', listener: () => void) => () => void;
  isFocused?: () => boolean;
};
export function useSharedCardScores(
  uid: string | undefined,
  epoch: number,
  reloadKey: number,
  navigation: Navigation,
  onMatches: (matches: CardScoreMatch[]) => void,
  enabled = true,
) {
  const [access, setAccess] = useState<{
    uid: string;
    epoch: number;
    grants: Record<string, boolean>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accessRef = useRef(access);
  accessRef.current = access;
  const lastRead = useRef<string | null>(null);
  const generation = useRef(0);
  const reading = useRef<AbortController | null>(null);
  const readCompletion = useRef<Promise<void> | null>(null);
  const writing = useRef<AbortController | null>(null);
  const refresh = useRef<() => Promise<void>>(() => Promise.resolve());
  const live = useCallback(() => {
    const state = useAuthStore.getState();
    return state.user?.uid === uid && state.sessionEpoch === epoch;
  }, [uid, epoch]);
  useEffect(() => {
    if (!uid || !enabled) return;
    let disposed = false,
      focused = navigation.isFocused?.() ?? true;
    let foreground =
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const active = () => !disposed && focused && foreground && live();
    const stop = () => {
      clearTimeout(timer);
      reading.current?.abort();
      writing.current?.abort();
      reading.current = null;
      readCompletion.current = null;
      writing.current = null;
      generation.current++;
      accessRef.current = null;
      setAccess(null);
    };
    const load = (): Promise<void> => {
      clearTimeout(timer);
      if (!active() || writing.current) return Promise.resolve();
      if (reading.current) return readCompletion.current ?? Promise.resolve();
      const controller = new AbortController(),
        revision = generation.current;
      reading.current = controller;
      const task = (async () => {
        try {
          const sessionId = await getGameDeviceSessionId();
          if (!active() || controller.signal.aborted) return;
          const result = await gameRequest(
            uid,
            { type: 'score-list', sessionId },
            controller.signal,
          );
          if (
            !active() ||
            controller.signal.aborted ||
            revision !== generation.current
          )
            return;
          const signature = JSON.stringify([
            uid,
            epoch,
            result.tables.map(({ match }) => [match.id, match.sharedVersion]),
          ]);
          if (lastRead.current !== signature) {
            const matches = await cacheSharedCardScoreMatches(
              uid,
              result.tables.map(({ match }) => match),
              true,
            );
            if (
              !active() ||
              controller.signal.aborted ||
              revision !== generation.current
            )
              return;
            lastRead.current = signature;
            onMatches(matches);
          }
          setAccess({
            uid,
            epoch,
            grants: Object.fromEntries(
              result.tables.map(({ match, canEdit }) => [match.id, canEdit]),
            ),
          });
          setError(null);
        } catch (cause) {
          if (
            active() &&
            !controller.signal.aborted &&
            revision === generation.current
          ) {
            setAccess(null);
            setError(
              (cause as Error).message || 'Chưa đồng bộ được bảng điểm phòng.',
            );
          }
        } finally {
          if (reading.current === controller) {
            reading.current = null;
            readCompletion.current = null;
            if (active()) timer = setTimeout(() => void load(), 10000);
          }
        }
      })();
      readCompletion.current = task;
      return task;
    };
    refresh.current = load;
    const offFocus = navigation.addListener('focus', () => {
      focused = true;
      void load();
    });
    const offBlur = navigation.addListener('blur', () => {
      focused = false;
      stop();
    });
    const app = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (foreground) void load();
      else stop();
    });
    void load();
    return () => {
      disposed = true;
      stop();
      offFocus();
      offBlur();
      app.remove();
    };
  }, [uid, epoch, reloadKey, navigation, onMatches, live, enabled]);
  const canEdit = (match: CardScoreMatch) => {
    if (!match.sharedVersion)
      return (
        !match.onlineRoomId || (live() && match.localScoreEditable === true)
      );
    const current = accessRef.current;
    return (
      enabled &&
      live() &&
      current !== null &&
      current.uid === uid &&
      current.epoch === epoch &&
      current.grants[match.id] === true
    );
  };
  async function mutate(
    match: CardScoreMatch,
    operation: 'save' | 'delete' = 'save',
    base?: CardScoreMatch,
  ) {
    if (match.deletedAt)
      throw new Error('Bảng điểm đã xóa không thể khôi phục.');
    if (
      !uid ||
      !live() ||
      !match.sharedVersion ||
      !canEdit(match) ||
      writing.current
    )
      throw new Error('Chỉ chủ phòng đang kết nối mới được sửa/xóa bảng điểm.');
    if (operation === 'save' && !base)
      throw new Error(
        'Thiếu bản gốc của bảng điểm. Đóng và mở lại hộp sửa; bản nháp chưa được lưu.',
      );
    const document =
      operation === 'save' ? sharedScorePatch(base!, match) : null;
    generation.current++;
    lastRead.current = null;
    reading.current?.abort();
    reading.current = null;
    readCompletion.current = null;
    const controller = new AbortController(),
      revision = generation.current;
    writing.current = controller;
    try {
      const sessionId = await getGameDeviceSessionId();
      if (!live() || controller.signal.aborted)
        throw new Error('Phiên bảng điểm đã thay đổi.');
      const result = await gameRequest(
        uid,
        {
          type: 'score-write',
          sessionId,
          tableId: match.id,
          actionId: randomUUID(),
          expectedVersion: match.sharedVersion,
          operation: operation === 'save' ? 'patch' : 'delete',
          document,
        },
        controller.signal,
      );
      if (
        !live() ||
        controller.signal.aborted ||
        revision !== generation.current
      )
        throw new Error('Phiên bảng điểm đã thay đổi.');
      const matches = await cacheSharedCardScoreMatches(uid, [result.match]);
      if (
        !live() ||
        controller.signal.aborted ||
        revision !== generation.current
      )
        throw new Error('Phiên bảng điểm đã thay đổi.');
      onMatches(matches);
      setAccess((current) => ({
        uid,
        epoch,
        grants: {
          ...(current?.uid === uid && current.epoch === epoch
            ? current.grants
            : {}),
          [result.match.id]: result.canEdit,
        },
      }));
      return result.match;
    } catch (cause) {
      const conflict =
        cause &&
        typeof cause === 'object' &&
        'code' in cause &&
        cause.code === 'version-conflict';
      const error = conflict
        ? new Error(
            'Bảng điểm vừa thay đổi. Đóng và mở lại hộp sửa để cập nhật; bản nháp chưa được lưu.',
          )
        : cause;
      if (live()) {
        setAccess(null);
        setError((error as Error).message);
      }
      throw error;
    } finally {
      if (writing.current === controller) writing.current = null;
      void refresh.current();
    }
  }
  return {
    canEdit,
    mutate,
    error: enabled ? error : null,
    retry: () => refresh.current(),
  };
}
