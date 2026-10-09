import { useProfile } from '../../hooks/useProfile';
import { useConfigStore } from '../../store/configStore';
import { useFinanceAccount } from '../../hooks/useFinanceAccount';
import { getMonthlySummary } from '../../utils/finance';
import { useFinancePrivacy } from '../../hooks/useFinancePrivacy';
import { useAgendaAccount } from '../../hooks/useAgendaAccount';

const REFRESH_TIMEOUT_MS = 15_000;

export function useHomeScreen() {
  const { name } = useProfile();
  const warning = useConfigStore((state) => state.warning);
  const refreshConfig = useConfigStore((state) => state.refresh);
  const finance = useFinanceAccount();
  const agenda = useAgendaAccount();
  const privacy = useFinancePrivacy();
  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return {
    name,
    date,
    warning,
    finance,
    agenda,
    privacy,
    summary: getMonthlySummary(finance.transactions),
    monthLabel: `Tháng ${new Date().getMonth() + 1} · ${new Date().getFullYear()}`,
    refresh: () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, REFRESH_TIMEOUT_MS);
      });
      return Promise.race([
        Promise.allSettled([
          refreshConfig(),
          finance.refresh(),
          agenda.refresh(),
        ]).then(() => undefined),
        timeout,
      ]).finally(() => clearTimeout(timer));
    },
  };
}
