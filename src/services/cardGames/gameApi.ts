import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { useAuthStore } from '../../store/authStore';
import type {
  GameRequest,
  GameRoomStatus,
  GameSnapshot,
} from '../../types/cardGame';
import { assertAccountWritable } from '../security/accountLifecycle';
import { parseGameRoomStatus, parseGameSnapshot } from './gameProtocol';
import { configuredSouth } from './tienLenConfig';
import type {
  CardScoreHistory,
  SharedCardScore,
  SharedCardScoreList,
} from '../../types/cardScore';
import {
  parseCardScoreHistory,
  parseSharedCardScore,
  parseSharedCardScoreList,
} from '../cardScore/sharedScoreProtocol';

const messages: Record<string, string> = {
  'auth-unavailable':
    'Không kết nối được máy chủ xác thực. Kiểm tra mạng rồi thử lại.',
  'invalid-session': 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  'game-unavailable': 'Phòng online chưa sẵn sàng. Hãy thử lại sau.',
  'room-not-found': 'Mã phòng không đúng hoặc phòng đã hết hạn.',
  'room-deleted': 'Phòng này đã bị chủ phòng xóa.',
  'room-expired': 'Phòng đã hết hạn. Chủ phòng cần tạo lại phòng trước.',
  'room-not-expired': 'Phòng vẫn còn hạn, không cần mở lại.',
  'room-not-finished': 'Chỉ có thể xóa phòng sau khi ván chơi kết thúc.',
  'not-owner': 'Chỉ chủ phòng hiện tại mới có thể thực hiện thao tác này.',
  'room-full': 'Phòng đã đủ người chơi, vui lòng chọn phòng khác.',
  'room-playing': 'Phòng đang chơi, hãy đợi ván tiếp.',
  'already-in-room': 'Bạn đang ở một phòng khác. Hãy mở lại phòng hiện tại.',
  'session-replaced': 'Bàn chơi đang được điều khiển trên thiết bị khác.',
  'version-conflict': 'Bàn vừa thay đổi. Đã yêu cầu cập nhật lại.',
  'match-conflict': 'Ván cũ đã kết thúc. Hãy đợi bàn cập nhật.',
  'room-conflict': 'Phòng cũ đã đóng. Hãy đợi phòng hiện tại cập nhật.',
  'turn-expired': 'Lượt đã hết thời gian. Đang cập nhật bàn.',
  'not-ready': 'Cần ít nhất 2 người trong phòng để bắt đầu.',
  'wrong-turn': 'Chưa đến lượt của bạn.',
  'cannot-beat': 'Bộ đã chọn chưa chặn được bộ trên bàn.',
  'invalid-combination': 'Các lá đã chọn chưa thành một bộ hợp lệ.',
  'opening-card': 'Bộ mở ván phải chứa lá nhỏ nhất đã chia.',
  'cannot-pass': 'Bạn đang mở vòng mới, hãy chọn bài để đánh.',
  'invalid-action': 'Thao tác chưa phù hợp với bước hiện tại của lượt.',
  'not-turn': 'Chưa đến lượt của bạn.',
  'game-update-required': 'Hãy cập nhật ứng dụng để dùng luật của phòng này.',
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

function normalizeTokenError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;
  const code = 'code' in error ? error.code : null;
  const message = 'message' in error ? String(error.message) : '';
  const secureTokenConnectionFailed =
    code === 'auth/unknown' &&
    /securetoken\.googleapis\.com/i.test(message) &&
    /(failed to connect|network|timed out|unreachable)/i.test(message);
  if (code === 'auth/network-request-failed' || secureTokenConnectionFailed)
    return new GameApiError('auth-unavailable', 503);
  return error;
}

export function gameRequest(
  uid: string,
  input: GameRequest & { type: 'score-list' },
  signal: AbortSignal,
): Promise<SharedCardScoreList>;
export function gameRequest(
  uid: string,
  input: GameRequest & { type: 'score-write' },
  signal: AbortSignal,
): Promise<SharedCardScore>;
export function gameRequest(
  uid: string,
  input: GameRequest & { type: 'score-history' },
  signal: AbortSignal,
): Promise<CardScoreHistory>;
export function gameRequest(
  uid: string,
  input: GameRequest & { type: 'room-status' },
  signal: AbortSignal,
): Promise<GameRoomStatus>;
export function gameRequest(
  uid: string,
  input: GameRequest,
  signal: AbortSignal,
): Promise<GameSnapshot>;
export async function gameRequest(
  uid: string,
  input: GameRequest,
  signal: AbortSignal,
): Promise<
  | GameSnapshot
  | GameRoomStatus
  | SharedCardScoreList
  | SharedCardScore
  | CardScoreHistory
> {
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
  let protocolVersion: 7 | 6 | 5 | 4 | 3 | 2 | undefined = 7;
  const minimumVersion =
    input.requiredClientVersion ??
    (input.phomConfig?.options
      ? 7
      : input.type === 'set-phom-rules'
        ? 6
        : input.type === 'set-south-rules'
          ? 5
          : configuredSouth(input.southConfig)
            ? 4
            : input.game === 'phom' || input.phomAction !== undefined
              ? 3
              : 1);
  const requestInput = { ...input };
  delete requestInput.requiredClientVersion;
  if (input.game === 'south' && !configuredSouth(input.southConfig))
    delete requestInput.southConfig;
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
          let token: string;
          try {
            token = await getIdToken(user, attempt === 1);
          } catch (error) {
            throw normalizeTokenError(error);
          }
          assertSession();
          const response = await fetch(`${origin}/functions/v1/game-access`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              protocolVersion === undefined
                ? requestInput
                : { ...requestInput, clientVersion: protocolVersion },
            ),
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
            if (
              code === 'invalid-input' &&
              response.status === 400 &&
              protocolVersion !== undefined
            ) {
              if (protocolVersion <= minimumVersion)
                throw new GameApiError('game-update-required', 409);
              protocolVersion =
                protocolVersion === 7
                  ? 6
                  : protocolVersion === 6
                    ? 5
                    : protocolVersion === 5
                      ? 4
                      : protocolVersion === 4
                        ? 3
                        : protocolVersion === 3
                          ? 2
                          : undefined;
              attempt -= 1;
              continue;
            }
            throw new GameApiError(code, response.status);
          }
          if (input.type === 'room-status')
            return parseGameRoomStatus(result, input.roomId!);
          if (input.type === 'score-list')
            return parseSharedCardScoreList(result);
          if (input.type === 'score-write') return parseSharedCardScore(result);
          if (input.type === 'score-history')
            return parseCardScoreHistory(result);
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
