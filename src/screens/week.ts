import { getWeekStart } from '../db/db';
import { isDateKey, startOfWeek, todayKey, weekDates } from '../lib/dates';
import { useLive } from '../lib/hooks';

/** Semana exibida: a do parâmetro da rota ou a atual, respeitando o dia de início escolhido. */
export function useWeek(weekParam?: string) {
  const ws = useLive(() => getWeekStart()) ?? 1;
  const today = todayKey();
  const current = startOfWeek(today, ws);
  const start = isDateKey(weekParam) ? startOfWeek(weekParam, ws) : current;
  return { ws, today, current, start, dates: weekDates(start) };
}

export function weekLabel(start: string, current: string): string {
  if (start === current) return 'Esta semana';
  const diff = Math.round((new Date(start + 'T12:00').getTime() - new Date(current + 'T12:00').getTime()) / (7 * 86400000));
  if (diff === 1) return 'Próxima semana';
  if (diff === -1) return 'Semana passada';
  return diff > 0 ? `Daqui a ${diff} semanas` : `Há ${-diff} semanas`;
}
