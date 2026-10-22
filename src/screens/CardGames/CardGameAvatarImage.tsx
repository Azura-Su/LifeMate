import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';

export function CardGameAvatarImage({
  uid,
  url,
  name,
  size,
}: {
  uid: string;
  url?: string | null;
  name: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const isSelf = useAuthStore((state) => state.user?.uid === uid);
  const profileUrl = useProfileStore((state) =>
    isSelf && state.uid === uid ? state.avatarUrl : null,
  );
  const [useProfileUrl, setUseProfileUrl] = useState(false);
  useEffect(() => {
    setFailed(false);
    setUseProfileUrl(false);
  }, [profileUrl, url]);
  useEffect(() => {
    if (isSelf) void useProfileStore.getState().load(uid);
  }, [isSelf, uid]);
  const imageUrl = useProfileUrl ? profileUrl : (url ?? profileUrl);
  if (!imageUrl || failed) return null;
  return (
    <Image
      testID={`player-avatar-image-${uid}`}
      accessibilityLabel={`Ảnh đại diện của ${name}`}
      source={{ uri: imageUrl, cache: 'reload' }}
      onError={() => {
        if (!useProfileUrl && url && profileUrl && url !== profileUrl)
          setUseProfileUrl(true);
        else setFailed(true);
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
    />
  );
}
