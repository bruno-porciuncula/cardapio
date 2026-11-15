import { db } from '../db/db';
import { countDishes } from '../db/weeks';
import { formatWeekRange, mondayOf } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';

export function Historico() {
  const current = mondayOf();
  const weeks = useLive(async () => {
    const all = (await db.weeks.toArray()).filter((w) => !w.deleted && countDishes(w) > 0);
    return all.sort((a, b) => (a.id < b.id ? 1 : -1));
  });

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">Semanas salvas</p>
        <h1>Histórico</h1>
      </header>

      {weeks && weeks.length === 0 && (
        <div class="empty-card">
          <Icon name="history" size={28} />
          <h3>Nenhuma semana planejada ainda</h3>
          <p class="muted">Toda semana com pelo menos um prato aparece aqui automaticamente.</p>
        </div>
      )}

      <ul class="week-list">
        {weeks?.map((w) => {
          const names = [...new Set(Object.values(w.slots).flatMap((d) => d ?? []).map((d) => d.snapshot.name))];
          const status = w.id === current ? 'Atual' : w.id < current ? 'Passada' : 'Planejada';
          return (
            <li key={w.id}>
              <button class="week-card" onClick={() => navigate('cardapio', w.id === current ? undefined : w.id)}>
                <span class="week-card-top">
                  <strong>{formatWeekRange(w.id)}</strong>
                  <span class={`chip ${status === 'Atual' ? 'chip-accent' : ''}`}>{status}</span>
                </span>
                <span class="muted">{countDishes(w)} pratos · {names.slice(0, 3).join(', ')}{names.length > 3 ? '…' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
