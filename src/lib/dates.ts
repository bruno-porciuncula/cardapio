/**
 * Datas sempre em horário local, como texto "AAAA-MM-DD".
 * Nunca usamos toISOString() aqui: no Brasil ela pode trocar o dia (UTC).
 */

/** Indexado pelo padrão do JS: 0 = domingo … 6 = sábado. */
export const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // meio-dia evita problemas de horário de verão
}

export function isDateKey(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function todayKey(now: Date = new Date()): string {
  return toKey(now);
}

/** Primeiro dia da semana que contém `date`, para uma semana que começa em `startDow` (0=dom … 6=sáb). */
export function startOfWeek(date: Date | string = new Date(), startDow = 1): string {
  const d = typeof date === 'string' ? fromKey(date) : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const offset = (d.getDay() - startDow + 7) % 7;
  d.setDate(d.getDate() - offset);
  return toKey(d);
}

/** Atalho para semanas de segunda a domingo. */
export function mondayOf(date: Date = new Date()): string {
  return startOfWeek(date, 1);
}

/** As 7 datas da semana que começa em `startKey`. */
export function weekDates(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
}

export function weekdayName(key: string): string {
  return WEEKDAY_NAMES[fromKey(key).getDay()];
}

export function weekdayShort(key: string): string {
  return WEEKDAY_SHORT[fromKey(key).getDay()];
}

/** Índice 0-6 de hoje dentro da semana que começa em `startKey`, ou -1. */
export function todayIndex(startKey: string, now: Date = new Date()): number {
  return weekDates(startKey).indexOf(toKey(now));
}

/** "9 a 15 de novembro de 2026" · "30 de novembro a 6 de dezembro de 2026" · com troca de ano também. */
export function formatWeekRange(startKey: string): string {
  const a = fromKey(startKey);
  const b = fromKey(addDays(startKey, 6));
  const sameYear = a.getFullYear() === b.getFullYear();
  if (a.getMonth() === b.getMonth() && sameYear) {
    return `${a.getDate()} a ${b.getDate()} de ${MONTHS[b.getMonth()]} de ${b.getFullYear()}`;
  }
  const left = `${a.getDate()} de ${MONTHS[a.getMonth()]}${sameYear ? '' : ` de ${a.getFullYear()}`}`;
  return `${left} a ${b.getDate()} de ${MONTHS[b.getMonth()]} de ${b.getFullYear()}`;
}

/** "14/11" */
export function formatDayMonth(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}
