/**
 * Datas sempre em horário local, como texto "AAAA-MM-DD".
 * Nunca usamos toISOString() aqui: no Brasil ela pode trocar o dia (UTC).
 */

export const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
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

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Segunda-feira da semana que contém `date`. */
export function mondayOf(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const offset = (d.getDay() + 6) % 7; // seg=0 … dom=6
  d.setDate(d.getDate() - offset);
  return toKey(d);
}

/** Índice 0-6 (seg-dom) de hoje dentro da semana `weekId`, ou -1. */
export function todayIndex(weekId: string, now: Date = new Date()): number {
  const today = toKey(now);
  for (let i = 0; i < 7; i++) if (addDays(weekId, i) === today) return i;
  return -1;
}

/** "9 a 15 de novembro de 2026" · "30 de novembro a 6 de dezembro de 2026" · com troca de ano também. */
export function formatWeekRange(weekId: string): string {
  const a = fromKey(weekId);
  const b = fromKey(addDays(weekId, 6));
  const sameYear = a.getFullYear() === b.getFullYear();
  if (a.getMonth() === b.getMonth() && sameYear) {
    return `${a.getDate()} a ${b.getDate()} de ${MONTHS[b.getMonth()]} de ${b.getFullYear()}`;
  }
  const left = `${a.getDate()} de ${MONTHS[a.getMonth()]}${sameYear ? '' : ` de ${a.getFullYear()}`}`;
  return `${left} a ${b.getDate()} de ${MONTHS[b.getMonth()]} de ${b.getFullYear()}`;
}

/** "12/11" */
export function formatDayMonth(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}
