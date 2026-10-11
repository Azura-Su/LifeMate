import { useProfile } from '../../hooks/useProfile';
import { useConfigStore } from '../../store/configStore';
import { useFinancePrivacy } from '../../hooks/useFinancePrivacy';
import { useAgendaAccount } from '../../hooks/useAgendaAccount';
import { useFinanceAccount } from '../../hooks/useFinanceAccount';
import { useNotesAccount } from '../../hooks/useNotesAccount';
import { formatLunarDate, solarToLunar } from '../../utils/vietnameseCalendar';

const REFRESH_TIMEOUT_MS = 15_000;

export function useHomeScreen() {
  const { name } = useProfile();
  const warning = useConfigStore((state) => state.warning);
  const refreshConfig = useConfigStore((state) => state.refresh);
  const agenda = useAgendaAccount();
  const finance = useFinanceAccount();
  const notes = useNotesAccount();
  const privacy = useFinancePrivacy();
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);
  const lunarDate = solarToLunar(
    today.getDate(),
    today.getMonth() + 1,
    today.getFullYear(),
  );
  const date = `${dateLabel} · Âm ${formatLunarDate(lunarDate)}`;
  return {
    name,
    date,
    warning,
    agenda,
    finance,
    notes,
    privacy,
    refresh: () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, REFRESH_TIMEOUT_MS);
      });
      return Promise.race([
        Promise.allSettled([
          refreshConfig(),
          agenda.refresh(),
          finance.refresh(),
          notes.refresh(),
        ]).then(() => undefined),
        timeout,
      ]).finally(() => clearTimeout(timer));
    },
  };
}
