import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { BrandAvatar } from './BrandAvatar';
export function UserAvatar({ size = 56 }: { size?: number }) {
  const uid = useAuthStore((state) => state.user?.uid);
  const url = useProfileStore((state) =>
    state.uid === uid ? state.avatarUrl : null,
  );
  const revision = useProfileStore((state) => state.revision);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url, revision, uid]);
  return url && !failed ? (
    <Image
      key={`${uid}-${revision}`}
      accessibilityLabel="Ảnh đại diện của bạn"
      source={{ uri: `${url}&v=${revision}`, cache: 'reload' }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: size / 3 }}
    />
  ) : (
    <BrandAvatar size={size} />
  );
}
