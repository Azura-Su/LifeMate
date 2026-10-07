import { useAuthStore } from '../../store/authStore';

export function audioCancelled() {
  return Object.assign(new Error('Đã hủy thao tác.'), {
    code: 'AUDIO_CANCELLED',
  });
}
export function assertAudioSession(uid: string, signal?: AbortSignal) {
  if (signal?.aborted || useAuthStore.getState().user?.uid !== uid)
    throw audioCancelled();
}
export async function abortable<T>(
  promise: PromiseLike<T>,
  signal: AbortSignal,
  timeoutMs = 30000,
): Promise<T> {
  if (signal.aborted) throw audioCancelled();
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      clean();
      reject(audioCancelled());
    };
    const timer = setTimeout(() => {
      clean();
      reject(
        Object.assign(
          new Error('Kết nối quá lâu. Hãy thử lại khi mạng ổn định.'),
          { code: 'audio/timeout' },
        ),
      );
    }, timeoutMs);
    function clean() {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
    signal.addEventListener('abort', abort);
    Promise.resolve(promise).then(
      (value) => {
        clean();
        resolve(value);
      },
      (error) => {
        clean();
        reject(error);
      },
    );
  });
}
