import { getWeekStart } from '../db/db';
import { addDays, formatWeekRange, isDateKey, startOfWeek, todayKey, weekDates } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';

export type WeekMode = 'cardapio' | 'montar';

/** Semana exibida: a do parâmetro da rota ou a atual, respeitando o dia de início escolhido. */
export function useWeek(weekParam?: string) {
  const ws = useLive(() => getWeekStart()) ?? 1;
  const today = todayKey();
  const current = startOfWeek(today, ws);
  const start = isDateKey(weekParam) ? startOfWeek(weekParam, ws) : current;
  return { ws, today, current, start, dates: weekDates(start) };
}

export function goWeek(mode: WeekMode, start: string, current: string) {
  navigate(mode, start === current ? undefined : start);
}

/** Título, abas "Semana | Montar semana" e navegação entre semanas. */
export function WeekHeader({ mode, start, current, planned }: {
  mode: WeekMode;
  start: string;
  current: string;
  planned: number;
}) {
  const go = (s: string, m: WeekMode = mode) => goWeek(m, s, current);
  return (
    <>
      <header class="screen-head">
        <p class="eyebrow">{start === current ? 'Esta semana' : start < current ? 'Semana anterior' : 'Semana seguinte'}</p>
        <h1>Cardápio</h1>
      </header>

      <div class="tabs" role="tablist" aria-label="Modo do cardápio">
        <button role="tab" aria-selected={mode === 'cardapio'} class={`tab ${mode === 'cardapio' ? 'is-on' : ''}`} onClick={() => go(start, 'cardapio')}>
          <Icon name="calendar" size={18} /> Semana
        </button>
        <button role="tab" aria-selected={mode === 'montar'} class={`tab ${mode === 'montar' ? 'is-on' : ''}`} onClick={() => go(start, 'montar')}>
          <Icon name="sparkles" size={18} /> Montar semana
        </button>
      </div>

      <div class="week-nav">
        <button class="icon-btn" onClick={() => go(addDays(start, -7))} aria-label="Semana anterior">
          <Icon name="left" />
        </button>
        <div class="week-nav-label">
          <strong>{formatWeekRange(start)}</strong>
          <span>{planned ? `${planned} refeiç${planned === 1 ? 'ão planejada' : 'ões planejadas'} de 14` : 'nenhuma refeição planejada'}</span>
        </div>
        <button class="icon-btn" onClick={() => go(addDays(start, 7))} aria-label="Próxima semana">
          <Icon name="right" />
        </button>
      </div>
      {start !== current && <button class="link-btn" onClick={() => go(current)}>← Voltar para esta semana</button>}
    </>
  );
}
