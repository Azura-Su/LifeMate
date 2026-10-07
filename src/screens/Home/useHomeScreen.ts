import { useProfile } from '../../hooks/useProfile';
import { useConfigStore } from '../../store/configStore';

export function useHomeScreen() {
  const { name } = useProfile();
  const loading = useConfigStore((state) => state.loading);
  const warning = useConfigStore((state) => state.warning);
  const refresh = useConfigStore((state) => state.refresh);
  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return { name, loading, warning, refresh, date };
}
