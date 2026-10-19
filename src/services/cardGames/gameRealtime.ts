import { createClient } from '@supabase/supabase-js';
import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { audioCloudApiKey, audioCloudUrl } from '../../config/audioCloud';
import { useAuthStore } from '../../store/authStore';

export function subscribeGame(
  uid: string,
  topic: string,
  onChange: () => void,
  onStatus: (connected: boolean) => void,
) {
  const origin = audioCloudUrl(),
    apiKey = audioCloudApiKey();
  if (!origin || !apiKey) throw new Error('Chưa kết nối được phòng online.');
  let alive = true;
  const epoch = useAuthStore.getState().sessionEpoch;
  const client = createClient(origin, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => {
      const user = getAuth().currentUser;
      if (
        !alive ||
        !user ||
        user.uid !== uid ||
        useAuthStore.getState().sessionEpoch !== epoch
      )
        return null;
      const token = await getIdToken(user);
      return alive &&
        useAuthStore.getState().user?.uid === uid &&
        useAuthStore.getState().sessionEpoch === epoch
        ? token
        : null;
    },
    realtime: { heartbeatIntervalMs: 25000 },
  });
  const channel = client
    .channel(topic, { config: { private: true } })
    .on('broadcast', { event: '*' }, () => {
      if (alive) onChange();
    })
    .subscribe((status) => {
      if (alive) onStatus(status === 'SUBSCRIBED');
    });
  return () => {
    alive = false;
    void client.removeChannel(channel).catch(() => undefined);
    client.realtime.disconnect();
  };
}
