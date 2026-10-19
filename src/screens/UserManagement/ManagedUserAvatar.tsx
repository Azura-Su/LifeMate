import { useState } from 'react';
import { Image } from 'react-native';
import { BrandAvatar } from '../../components/BrandAvatar';
import { audioCloudUrl } from '../../config/audioCloud';

export function ManagedUserAvatar({
  uid,
  url,
  name,
}: {
  uid: string;
  url?: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const identity = `${uid}:${url ?? ''}`;
  let valid = false;
  try {
    const target = new URL(url ?? '');
    valid =
      /^[A-Za-z0-9_-]{1,128}$/.test(uid) &&
      target.origin === audioCloudUrl() &&
      target.pathname ===
        `/storage/v1/object/sign/lifemate-avatars/profiles/${uid}/avatar.jpg` &&
      !!target.searchParams.get('token') &&
      !target.username &&
      !target.password &&
      !target.hash;
  } catch {
    /* Missing avatar uses the app logo. */
  }
  return valid && failed !== identity ? (
    <Image
      key={identity}
      source={{ uri: url!, cache: 'reload' }}
      accessibilityLabel={`Ảnh đại diện của ${name || 'người dùng'}`}
      onError={() => setFailed(identity)}
      style={{ width: 40, height: 40, borderRadius: 13 }}
    />
  ) : (
    <BrandAvatar size={40} />
  );
}
