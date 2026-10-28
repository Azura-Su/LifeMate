import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { randomUUID } from 'expo-crypto';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import type { PixelPetState } from '../../types/pixelPet';
import { assertAccountWritable } from '../security/accountLifecycle';
import { pixelPetSpecies } from './pixelPetCatalog';
import { useAuthStore } from '../../store/authStore';

const messages: Record<string, string> = {
  'invalid-session': 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  'pet-unavailable': 'Chưa kết nối được linh thú. Hãy thử lại sau.',
  'all-adopted': 'Tất cả 15 linh thú đã được nhận nuôi.',
  'all-reserved':
    'Các linh thú còn lại đang được người khác lựa chọn. Bạn có thể thử lại sau.',
  'no-rolls': 'Bạn đã dùng hết 3 lượt chọn ngẫu nhiên.',
  'no-restores': 'Bạn đã dùng hết lượt giữ lại linh thú.',
  'rolls-remaining': 'Bạn vẫn còn lượt chọn ngẫu nhiên.',
  'reservation-missing': 'Lượt giữ chỗ không còn. Hãy tải lại.',
  'reservation-expired': 'Lượt giữ chỗ đã hết hạn.',
  'rate-limited': 'Bạn thao tác hơi nhanh. Hãy đợi một lát.',
  'pet-busy': 'Máy chủ đang bận. Hãy thử lại.',
  'stale-snapshot': 'Dữ liệu vừa được cập nhật ở thiết bị khác.',
};

export class PixelPetApiError extends Error {
  constructor(public code: string) {
    super(messages[code] ?? messages['pet-unavailable']);
  }
}

export type PixelPetRequest =
  | { type: 'state' | 'sync' }
  | { type: 'roll' | 'restore' | 'care'; actionId: string }
  | { type: 'confirm'; actionId: string; reservationId: string };

const isCount = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Rejects anything that is not a well-formed server state. */
export function parsePixelPetState(value: unknown): PixelPetState {
  const state = value as PixelPetState;
  if (
    !state ||
    !['none', 'reserved', 'owned'].includes(state.status) ||
    !isCount(state.rollsLeft) ||
    !isCount(state.restoresLeft) ||
    !isCount(state.now) ||
    !state.availability ||
    !isCount(state.availability.owned) ||
    (state.reservation !== null &&
      (!state.reservation ||
        !pixelPetSpecies(state.reservation.speciesId) ||
        !isCount(state.reservation.expiresAt))) ||
    (state.pet !== null &&
      (!state.pet ||
        !pixelPetSpecies(state.pet.speciesId) ||
        !isCount(state.pet.totalExp) ||
        !isCount(state.pet.level) ||
        !['hatchling', 'juvenile', 'ascended'].includes(state.pet.stage)))
  )
    throw new PixelPetApiError('pet-unavailable');
  return state;
}

type OwnedPet = PixelPetState['pet'];
const ownedPets = new Map<string, OwnedPet>();
const responseGeneration = new Map<string, number>();
const ownedPetListeners = new Set<() => void>();
function rememberOwnedPet(uid: string, pet: OwnedPet) {
  ownedPets.set(uid, pet);
  ownedPetListeners.forEach((listener) => listener());
}

/** Also fences responses already in flight when an admin revokes this owner. */
export function invalidateOwnedPixelPet(uid: string) {
  responseGeneration.set(uid, (responseGeneration.get(uid) ?? 0) + 1);
  rememberOwnedPet(uid, null);
}

/** Last pet seen in any server response; lets Home show it without a call. */
export function readOwnedPixelPet(uid: string): OwnedPet {
  return ownedPets.get(uid) ?? null;
}

export function subscribeOwnedPixelPet(listener: () => void) {
  ownedPetListeners.add(listener);
  return () => {
    ownedPetListeners.delete(listener);
  };
}

export function newPixelPetAction() {
  return randomUUID();
}

/**
 * Commands carry a stable actionId, so a timed-out request is retried with the
 * same id and the server replays the committed result instead of acting twice.
 */
export async function callPixelPet(
  uid: string,
  input: PixelPetRequest,
): Promise<PixelPetState> {
  if (input.type !== 'state' && input.type !== 'sync')
    assertAccountWritable(uid);
  const origin = audioCloudUrl();
  const apiKey = audioCloudApiKey();
  const user = getAuth().currentUser;
  if (!origin || !apiKey) throw new PixelPetApiError('pet-unavailable');
  if (!user || user.uid !== uid) throw new PixelPetApiError('invalid-session');
  const epoch = useAuthStore.getState().sessionEpoch;
  const generation = (responseGeneration.get(uid) ?? 0) + 1;
  responseGeneration.set(uid, generation);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const token = await getIdToken(user, attempt === 1);
      if (
        getAuth().currentUser?.uid !== uid ||
        useAuthStore.getState().sessionEpoch !== epoch
      )
        throw new PixelPetApiError('invalid-session');
      const response = await fetch(`${origin}/functions/v1/pet-access`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const result: unknown = await response.json().catch(() => null);
      if (
        getAuth().currentUser?.uid !== uid ||
        useAuthStore.getState().sessionEpoch !== epoch
      )
        throw new PixelPetApiError('invalid-session');
      if (response.ok) {
        const state = parsePixelPetState(result);
        if (responseGeneration.get(uid) === generation)
          rememberOwnedPet(uid, state.pet);
        return state;
      }
      const code =
        result && typeof result === 'object' && 'error' in result
          ? String(result.error)
          : 'pet-unavailable';
      if (code === 'invalid-session' && attempt === 0) continue;
      throw new PixelPetApiError(code);
    } catch (error) {
      if (error instanceof PixelPetApiError) throw error;
      lastError = error; // Network failure: retry once with the same actionId.
    }
  }
  throw lastError instanceof Error
    ? new PixelPetApiError('pet-unavailable')
    : lastError;
}

const lastBackgroundSync = new Map<string, number>();
/**
 * Recorded days only earn EXP while recent, so Home nudges a server-side
 * reconcile when it gains focus. Throttled; failures are silent and retried.
 */
export function syncPixelPetInBackground(uid: string, now = Date.now()) {
  if (now - (lastBackgroundSync.get(uid) ?? 0) < 10 * 60000) return;
  lastBackgroundSync.set(uid, now);
  void callPixelPet(uid, { type: 'sync' }).catch(() => {
    lastBackgroundSync.delete(uid);
  });
}
