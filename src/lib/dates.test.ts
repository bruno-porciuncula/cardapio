import { describe, expect, it } from 'vitest';
import { addDays, formatWeekRange, mondayOf, todayIndex } from './dates';
import { formatQuantity } from './units';

describe('datas', () => {
  it('segunda-feira da semana', () => {
    expect(mondayOf(new Date(2026, 10, 14))).toBe('2026-11-09'); // sábado
    expect(mondayOf(new Date(2026, 10, 15))).toBe('2026-11-09'); // domingo
    expect(mondayOf(new Date(2026, 10, 16))).toBe('2026-11-16'); // segunda
  });

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('formata o intervalo da semana', () => {
    expect(formatWeekRange('2026-11-09')).toBe('9 a 15 de novembro de 2026');
    expect(formatWeekRange('2026-11-30')).toBe('30 de novembro a 6 de dezembro de 2026');
    expect(formatWeekRange('2026-12-28')).toBe('28 de dezembro de 2026 a 3 de janeiro de 2027');
  });

  it('índice de hoje', () => {
    expect(todayIndex('2026-11-09', new Date(2026, 10, 14, 23, 30))).toBe(5);
    expect(todayIndex('2026-11-16', new Date(2026, 10, 14))).toBe(-1);
  });
});

describe('quantidades', () => {
  it('formata com plural e vírgula', () => {
    expect(formatQuantity(350, 'g')).toBe('350 g');
    expect(formatQuantity(2, 'pacote')).toBe('2 pacotes');
    expect(formatQuantity(1.5, 'kg')).toBe('1,5 kg');
    expect(formatQuantity(null, null)).toBe('');
  });
});
