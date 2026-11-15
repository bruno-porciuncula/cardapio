import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { loadExample } from '../db/example';
import type { Dish } from '../db/types';
import { MEALS, MEAL_LABEL, countDishes, slotKey } from '../db/weeks';
import { DAY_NAMES, addDays, formatDayMonth, formatWeekRange, mondayOf, todayIndex } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { RecipeDetail } from './RecipeDetail';

export function Cardapio({ weekParam }: { weekParam?: string }) {
  const current = mondayOf();
  const weekId = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? mondayOf(new Date(weekParam + 'T12:00')) : current;
  const [open, setOpen] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(false);

  const data = useLive(async () => ({
    week: await db.weeks.get(weekId),
    recipeCount: await db.recipes.filter((r) => !r.deleted).count(),
  }), [weekId]);

  const week = data?.week?.deleted ? undefined : data?.week;
  const today = todayIndex(weekId);
  const total = countDishes(week);
  const go = (id: string) => navigate('cardapio', id === current ? undefined : id);

  async function onLoadExample() {
    setLoading(true);
    try {
      await loadExample(db, weekId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">{weekId === current ? 'Esta semana' : weekId < current ? 'Semana passada' : 'Próxima semana'}</p>
        <h1>Cardápio</h1>
      </header>

      <div class="week-nav">
        <button class="icon-btn" onClick={() => go(addDays(weekId, -7))} aria-label="Semana anterior">
          <Icon name="left" />
        </button>
        <div class="week-nav-label">
          <strong>{formatWeekRange(weekId)}</strong>
          <span class="muted">{total ? `${total} prato${total === 1 ? '' : 's'} planejado${total === 1 ? '' : 's'}` : 'nenhum prato ainda'}</span>
        </div>
        <button class="icon-btn" onClick={() => go(addDays(weekId, 7))} aria-label="Próxima semana">
          <Icon name="right" />
        </button>
      </div>
      {weekId !== current && (
        <button class="link-btn center" onClick={() => go(current)}>Voltar para esta semana</button>
      )}

      {data && data.recipeCount === 0 && total === 0 && (
        <div class="empty-card">
          <Icon name="sparkles" size={28} />
          <h3>Comece pelo seu cardápio de exemplo</h3>
          <p class="muted">
            Carrega as 8 receitas do briefing e preenche os almoços desta semana. Fica salvo no aparelho e você
            pode editar depois.
          </p>
          <button class="btn btn-primary" disabled={loading} onClick={onLoadExample}>
            {loading ? 'Carregando…' : 'Carregar cardápio de exemplo'}
          </button>
        </div>
      )}

      <div class="days">
        {DAY_NAMES.map((dayName, day) => (
          <article class={`day ${day === today ? 'day-today' : ''}`} key={day}>
            <header class="day-head">
              <h2>{dayName}</h2>
              <span class="muted">{formatDayMonth(addDays(weekId, day))}</span>
              {day === today && <span class="chip chip-accent">hoje</span>}
            </header>
            {MEALS.map((meal) => {
              const dishes = week?.slots[slotKey(day, meal)] ?? [];
              return (
                <div class="slot" key={meal}>
                  <span class="slot-label">
                    <Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={15} />
                    {MEAL_LABEL[meal]}
                  </span>
                  {dishes.length === 0 ? (
                    <div class="slot-empty">Vazio</div>
                  ) : (
                    <ul class="dishes">
                      {dishes.map((dish) => (
                        <li key={dish.uid}>
                          <button class="dish" onClick={() => setOpen(dish)}>
                            <Thumb name={dish.snapshot.name} imageId={dish.snapshot.imageId} size="sm" />
                            <span class="dish-name">{dish.snapshot.name}</span>
                            {dish.leftover && (
                              <span class="chip chip-soft"><Icon name="repeat" size={13} /> sobra</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </article>
        ))}
      </div>

      {open && <RecipeDetail snapshot={open.snapshot} onClose={() => setOpen(null)} />}
    </section>
  );
}
