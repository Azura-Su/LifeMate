import { getAuth } from '@react-native-firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  runTransaction,
} from '@react-native-firebase/firestore';
import type { PetMutation, PetSlot } from '../../types/pet';
import { applyPetMutation, parsePetSlot } from './petSlot';
import { assertPetSession, parsePetMutation } from './petStorage';
import { decodePetSlot, encodePetSlot } from './petWire';

function assertCloud(uid: string, epoch: number) {
  assertPetSession(uid, epoch);
  if (getAuth().currentUser?.uid !== uid)
    throw new Error('Phiên đăng nhập đã thay đổi.');
}
const document = (uid: string) =>
  doc(getFirestore(), 'petAccounts', uid, 'state', 'current');
export async function readCloudPet(uid: string, epoch: number) {
  assertCloud(uid, epoch);
  const snapshot = await getDocFromServer(document(uid));
  assertCloud(uid, epoch);
  return decodePetSlot(snapshot.exists() ? snapshot.data() : null, uid);
}
export async function commitCloudPet(
  uid: string,
  epoch: number,
  input: PetMutation,
): Promise<PetSlot> {
  assertCloud(uid, epoch);
  const mutation = parsePetMutation(input, uid);
  const result = await runTransaction(getFirestore(), async (transaction) => {
    assertCloud(uid, epoch);
    const ref = document(uid),
      snapshot = await transaction.get(ref);
    assertCloud(uid, epoch);
    const current = decodePetSlot(
      snapshot.exists() ? snapshot.data() : null,
      uid,
    );
    const next = applyPetMutation(uid, current, mutation, Date.now());
    if (next !== current) transaction.set(ref, encodePetSlot(next));
    return next;
  });
  assertCloud(uid, epoch);
  return parsePetSlot(result, uid)!;
}
export function subscribeCloudPet(
  uid: string,
  epoch: number,
  onValue: (slot: PetSlot | null) => void,
  onError: (error: Error) => void,
) {
  assertCloud(uid, epoch);
  return onSnapshot(
    document(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      try {
        assertCloud(uid, epoch);
        // A cached empty document is not proof that this account's slot is free.
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
          return;
        onValue(decodePetSlot(snapshot.exists() ? snapshot.data() : null, uid));
      } catch (error) {
        onError(
          error instanceof Error ? error : new Error('Chưa đọc được thú cưng.'),
        );
      }
    },
    onError,
  );
}
