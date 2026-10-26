import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { petErrorMessage } from '../../services/pets/petErrors';
import { useAuthStore } from '../../store/authStore';
import { useScreenActive } from '../../hooks/useScreenActive';
import type { PetCache, PetRecord, PetSlot } from '../../types/pet';
import {
  commitCloudPet,
  readCloudPet,
  subscribeCloudPet,
} from '../../services/pets/petCloud';
import {
  assertPetSession,
  enqueuePetMutation,
  readPetCache,
  reconcilePetSlot,
} from '../../services/pets/petStorage';

const blank: PetCache = {
  schemaVersion: 1,
  slot: null,
  pending: null,
  draft: null,
};
export function usePet() {
  const uid = useAuthStore((s) => s.user?.uid),
    epoch = useAuthStore((s) => s.sessionEpoch),
    active = useScreenActive();
  const key = `${uid}:${epoch}`;
  const [state, setState] = useState({
    key,
    cache: blank,
    loading: true,
    syncing: false,
    error: null as string | null,
  });
  const life = useRef<{
    key: string;
    alive: boolean;
    flushing: boolean;
  } | null>(null);
  const current =
    state.key === key
      ? state
      : { key, cache: blank, loading: true, syncing: false, error: null };
  const publish = useCallback(
    (patch: Partial<Omit<typeof state, 'key'>>) => {
      if (uid && life.current?.key === key && life.current.alive) {
        assertPetSession(uid, epoch);
        setState((s) => ({ ...s, ...patch, key }));
      }
    },
    [uid, epoch, key],
  );
  const receive = useCallback(
    async (remote: PetSlot | null) => {
      if (!uid) return;
      const before = await readPetCache(uid, epoch);
      const next = await reconcilePetSlot(uid, epoch, remote);
      const lost =
        !!before.pending &&
        !next.pending &&
        next.slot?.lastOperationId !== before.pending.operationId;
      publish({
        cache: next,
        loading: false,
        ...(lost
          ? {
              error: `Thú cưng đã thay đổi trên thiết bị khác. Đã cập nhật trạng thái hiện tại.${next.draft ? ' Bản nháp mới được giữ riêng.' : ''}`,
            }
          : null),
      });
      return next;
    },
    [uid, epoch, publish],
  );
  const sync = useCallback(async () => {
    const context = life.current;
    if (
      !uid ||
      !active ||
      !context?.alive ||
      context.key !== key ||
      context.flushing
    )
      return;
    context.flushing = true;
    publish({ syncing: true });
    try {
      const cache = await readPetCache(uid, epoch);
      if (cache.pending) {
        try {
          await receive(await commitCloudPet(uid, epoch, cache.pending));
        } catch (cause) {
          // A rejected/stale intent must reconcile before the user retries;
          // uncertain failures retain the exact same durable operation.
          await receive(await readCloudPet(uid, epoch));
          throw cause;
        }
      } else await receive(await readCloudPet(uid, epoch));
      publish({ error: null });
    } catch (error) {
      if (life.current === context && context.alive)
        publish({
          error: petErrorMessage(error),
        });
    } finally {
      context.flushing = false;
      if (life.current === context && context.alive)
        publish({ syncing: false, loading: false });
    }
  }, [uid, epoch, active, key, publish, receive]);
  useEffect(() => {
    if (!uid || !active) return;
    const context = { key, alive: true, flushing: false };
    life.current = context;
    let unsubscribe: (() => void) | undefined;
    void readPetCache(uid, epoch)
      .then((cache) => {
        if (life.current !== context || !context.alive) return;
        publish({ cache, loading: false, error: null });
        unsubscribe = subscribeCloudPet(
          uid,
          epoch,
          (remote) => {
            if (context.alive)
              void receive(remote)
                .then((next) => {
                  if (next?.pending) void sync();
                })
                .catch((error) => {
                  if (context.alive) publish({ error: petErrorMessage(error) });
                });
          },
          (error) => {
            if (context.alive) publish({ error: petErrorMessage(error) });
          },
        );
        void sync();
      })
      .catch((error) => {
        if (context.alive)
          publish({ loading: false, error: petErrorMessage(error) });
      });
    const timer = setInterval(() => {
      void sync();
    }, 20000);
    return () => {
      context.alive = false;
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [uid, epoch, active, key, publish, receive, sync]);
  const mutate = async (input: Parameters<typeof enqueuePetMutation>[2]) => {
    if (!uid || !active)
      throw new Error('Hãy mở lại màn thú cưng để tiếp tục.');
    const cache = await enqueuePetMutation(uid, epoch, input);
    publish({ cache, error: null });
    void sync();
  };
  return {
    uid,
    epoch,
    active,
    ...current,
    save: (pet: PetRecord) =>
      mutate({ type: 'create', pet, operationId: randomUUID() }),
    rename: (targetPetId: string, name: string, expectedRevision: number) =>
      mutate({
        type: 'rename',
        targetPetId,
        name,
        expectedRevision,
        operationId: randomUUID(),
      }),
    remove: (targetPetId: string, expectedRevision: number) =>
      mutate({
        type: 'delete',
        targetPetId,
        expectedRevision,
        operationId: randomUUID(),
      }),
    retry: () => {
      void sync();
    },
  };
}
