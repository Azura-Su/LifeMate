export const MAX_CLOUD_AUDIO_BYTES = 50 * 1024 * 1024;

// Build-time config only: never send a Firebase token to a Remote Config URL.
export function audioCloudUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  return value && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value)
    ? value
    : null;
}

export function audioCloudApiKey(): string | null {
  const value = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return value && value.length <= 256 ? value : null;
}

export function audioBackupUnavailable(sizeBytes: number): string | null {
  if (sizeBytes > MAX_CLOUD_AUDIO_BYTES)
    return 'File trên 50 MB được giữ trên máy; kho miễn phí chỉ nhận tối đa 50 MB/file.';
  if (!audioCloudUrl() || !audioCloudApiKey())
    return 'Kho sao lưu miễn phí chưa được kết nối. Bạn vẫn có thể nghe, đổi tên, cắt và ghép trên máy.';
  return null;
}
