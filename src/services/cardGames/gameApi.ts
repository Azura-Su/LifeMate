import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { useAuthStore } from '../../store/authStore';
import type { GameRequest } from '../../types/cardGame';
import { assertAccountWritable } from '../security/accountLifecycle';
import { parseGameSnapshot } from './gameProtocol';

const messages: Record<string, string> = {
  'invalid-session': 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  'game-unavailable': 'Phòng online chưa sẵn sàng. Hãy thử lại sau.',
  'room-not-found': 'Mã phòng không đúng hoặc phòng đã hết hạn.',
  'room-full': 'Phòng đã đủ 4 người.',
  'room-playing': 'Phòng đang chơi, hãy đợi ván tiếp.',
  'already-in-room': 'Bạn đang ở một phòng khác. Hãy mở lại phòng hiện tại.',
  'session-replaced': 'Bàn chơi đang được điều khiển trên thiết bị khác.',
  'version-conflict': 'Bàn vừa thay đổi. Đã yêu cầu cập nhật lại.',
  'match-conflict': 'Ván cũ đã kết thúc. Hãy đợi bàn cập nhật.',
  'room-conflict': 'Phòng cũ đã đóng. Hãy đợi phòng hiện tại cập nhật.',
  'turn-expired': 'Lượt đã hết thời gian. Đang cập nhật bàn.',
  'not-ready': 'Cần ít nhất 2 người và mọi người đều sẵn sàng.',
  'wrong-turn': 'Chưa đến lượt của bạn.',
  'cannot-beat': 'Bộ đã chọn chưa chặn được bộ trên bàn.',
  'invalid-combination': 'Các lá đã chọn chưa thành một bộ hợp lệ.',
  'opening-card': 'Bộ mở ván phải chứa lá nhỏ nhất đã chia.',
  'cannot-pass': 'Bạn đang mở vòng mới, hãy chọn bài để đánh.',
  'card-ownership': 'Bài trên tay vừa thay đổi. Hãy chọn lại sau khi cập nhật.',
  'rate-limited': 'Bạn thao tác hơi nhanh. Hãy đợi một lát.',
  'not-member': 'Bạn không còn ở phòng này.',
};
export class GameApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(
      messages[code] ??
        'Chưa xác nhận được thao tác. Hãy kiểm tra lại kết nối.',
    );
  }
}

export async function gameRequest(
  uid: string,
  input: GameRequest,
  signal: AbortSignal,
) {
  const epoch = useAuthStore.getState().sessionEpoch;
  const assertSession = () => {
    assertAccountWritable(uid);
    if (
      signal.aborted ||
      useAuthStore.getState().user?.uid !== uid ||
      useAuthStore.getState().sessionEpoch !== epoch ||
      getAuth().currentUser?.uid !== uid
    )
      throw new Error('Phiên bàn chơi đã thay đổi.');
  };
  assertSession();
  const origin = audioCloudUrl(),
    apiKey = audioCloudApiKey();
  if (!origin || !apiKey) throw new GameApiError('game-unavailable', 503);
  const controller = new AbortController();
  let rejectWait!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectWait = reject;
  });
  const cancel = () => {
    controller.abort();
    rejectWait(
      new Error('Chưa xác nhận được thao tác. Hãy kiểm tra lại kết nối.'),
    );
  };
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 15000);
  const off = useAuthStore.subscribe(() => {
    if (
      useAuthStore.getState().user?.uid !== uid ||
      useAuthStore.getState().sessionEpoch !== epoch
    )
      cancel();
  });
  try {
    return await Promise.race([
      (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          assertSession();
          const user = getAuth().currentUser!;
          const token = await getIdToken(user, attempt === 1);
          assertSession();
          const response = await fetch(`${origin}/functions/v1/game-access`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
          });
          const result: unknown = await response.json().catch(() => {
            throw new GameApiError('game-unavailable', 503);
          });
          assertSession();
          if (response.status === 401 && attempt === 0) continue;
          if (!response.ok) {
            const code =
              result &&
              typeof result === 'object' &&
              'error' in result &&
              typeof result.error === 'string'
                ? result.error
                : 'game-unavailable';
            throw new GameApiError(code, response.status);
          }
          const parsed = parseGameSnapshot(result, uid);
          if (parsed.refreshToken) {
            await getIdToken(user, true);
            assertSession();
          }
          return parsed;
        }
        throw new GameApiError('invalid-session', 401);
      })(),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    off();
  }
}
