import { db, getWeekStart } from '../db/db';
import { formatWeekRange, startOfWeek } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { Thumb } from '../ui/Thumb';

interface WeekSummary {
  start: string;
  count: number;
  names: string[];
  dishes: Array<{ name: string; emoji?: string; imageId?: string }>;
}

export function Historico() {
  const data = useLive(async () => {
    const ws = await getWeekStart();
    const current = startOfWeek(new Date(), ws);
    const weeks = new Map<string, WeekSummary>();
    for (const day of await db.days.toArray()) {
      if (day.deleted) continue;
      const dishes = [...(day.slots.almoco ?? []), ...(day.slots.jantar ?? [])];
      if (!dishes.length) continue;
      const start = startOfWeek(day.id, ws);
      const w = weeks.get(start) ?? { start, count: 0, names: [], dishes: [] };
      w.count += dishes.length;
      for (const d of dishes) {
        if (!w.names.includes(d.snapshot.name)) {
          w.names.push(d.snapshot.name);
          w.dishes.push({ name: d.snapshot.name, emoji: d.snapshot.emoji, imageId: d.snapshot.imageId });
        }
      }
      weeks.set(start, w);
    }
    return { current, weeks: [...weeks.values()].sort((a, b) => (a.start < b.start ? 1 : -1)) };
  });

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">Semanas salvas</p>
        <h1>Histórico</h1>
      </header>

      {data && data.weeks.length === 0 && (
        <div class="empty-card">
          <span class="empty-emoji">🗓️</span>
          <h3>Nenhuma semana planejada ainda</h3>
          <p class="muted">Toda semana com pelo menos um prato aparece aqui automaticamente.</p>
        </div>
      )}

      <ul class="week-list">
        {data?.weeks.map((w) => {
          const status = w.start === data.current ? 'Atual' : w.start < data.current ? 'Passada' : 'Planejada';
          return (
            <li key={w.start}>
              <button class="week-card" onClick={() => navigate('cardapio', w.start === data.current ? undefined : w.start)}>
                <span class="week-card-top">
                  <strong>{formatWeekRange(w.start)}</strong>
                  <span class={`chip status-${status.toLowerCase()}`}>{status}</span>
                </span>
                <span class="week-thumbs" aria-hidden="true">
                  {w.dishes.slice(0, 6).map((d) => <Thumb key={d.name} name={d.name} emoji={d.emoji} imageId={d.imageId} size="xs" />)}
                  {w.dishes.length > 6 && <span class="more">+{w.dishes.length - 6}</span>}
                </span>
                <span class="muted">{w.count} pratos · {w.names.slice(0, 3).join(', ')}{w.names.length > 3 ? '…' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
