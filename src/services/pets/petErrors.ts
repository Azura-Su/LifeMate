// Keep Firebase SDK details out of the pet experience.
export function petErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code).replace(/^firestore\//, '')
      : '';
  if (code === 'permission-denied')
    return 'Chưa truy cập được thú cưng trên tài khoản. Hãy thử đồng bộ lại sau ít phút. Bản lưu trên thiết bị vẫn được giữ.';
  if (code === 'unauthenticated')
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để đồng bộ thú cưng.';
  if (
    ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(
      code,
    )
  )
    return 'Chưa kết nối được. Thú cưng trên thiết bị vẫn được giữ và sẽ đồng bộ khi có mạng.';
  if (
    error instanceof Error &&
    !code &&
    /[^\u0000-\u007f]/u.test(error.message) &&
    !error.message.includes('[firestore/')
  )
    return error.message;
  return 'Chưa đồng bộ được thú cưng. Bản lưu trên thiết bị vẫn được giữ. Hãy thử lại.';
}
