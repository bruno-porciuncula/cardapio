import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { MEALS, MEAL_LABEL, toggleRecipeInSlot } from '../db/plan';
import type { DayPlan, Meal } from '../db/types';
import { addDays, formatDayMonth, formatWeekRange, weekDates, weekdayShort } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Thumb } from '../ui/Thumb';

/**
 * Escolher em quais dias e refeições uma receita entra.
 * Cada toque salva na hora: marca = adiciona, desmarca = tira.
 */
export function AssignSheet({ recipeId, start: initialStart, today, onClose }: {
  recipeId: string;
  start: string;
  today: string;
  onClose: () => void;
}) {
  const [start, setStart] = useState(initialStart);
  const [busy, setBusy] = useState<string | null>(null);
  const dates = weekDates(start);

  const data = useLive(async () => ({
    recipe: await db.recipes.get(recipeId),
    days: await db.days.bulkGet(dates),
  }), [recipeId, start]);

  const byDate = new Map<string, DayPlan>();
  data?.days.forEach((d) => d && !d.deleted && byDate.set(d.id, d));
  const recipe = data?.recipe;
  const count = [...byDate.values()].reduce(
    (n, d) => n + MEALS.filter((m) => d.slots[m]?.some((x) => x.recipeId === recipeId)).length, 0,
  );

  async function toggle(date: string, meal: Meal) {
    const key = `${date}-${meal}`;
    if (busy) return;
    setBusy(key);
    try {
      await toggleRecipeInSlot(db, date, meal, recipeId);
    } finally {
      setBusy(null);
    }
  }

  if (data && !recipe) return null;

  return (
    <Sheet title="Adicionar à semana" onClose={onClose}>
      {recipe && (
        <div class="assign">
          <div class="assign-recipe">
            <Thumb name={recipe.name} emoji={recipe.emoji} imageId={recipe.imageId} size="md" />
            <div>
              <strong>{recipe.name}</strong>
              <span class="muted">{count ? `em ${count} refeiç${count === 1 ? 'ão' : 'ões'} desta semana` : 'toque nos espaços para adicionar'}</span>
            </div>
          </div>

          <div class="assign-week">
            <button class="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior"><Icon name="left" size={20} /></button>
            <strong>{formatWeekRange(start)}</strong>
            <button class="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Próxima semana"><Icon name="right" size={20} /></button>
          </div>

          <div class="assign-grid" role="grid">
            <span />
            {MEALS.map((meal) => (
              <span key={meal} class={`assign-col meal-pill meal-pill-${meal}`}>
                <Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={14} /> {MEAL_LABEL[meal]}
              </span>
            ))}
            {dates.map((date) => (
              <Fragment key={date}>
                <span class={`assign-day ${date === today ? 'is-today' : ''} ${date < today ? 'is-past' : ''}`}>
                  <strong>{weekdayShort(date)}</strong>
                  <small>{formatDayMonth(date)}</small>
                </span>
                {MEALS.map((meal) => {
                  const dishes = byDate.get(date)?.slots[meal] ?? [];
                  const mine = dishes.find((d) => d.recipeId === recipeId);
                  const others = dishes.filter((d) => d.recipeId !== recipeId);
                  return (
                    <button
                      key={`${date}-${meal}`}
                      class={`assign-cell ${mine ? 'is-on' : ''} ${mine?.leftover ? 'is-leftover' : ''} ${date < today ? 'is-past' : ''}`}
                      aria-pressed={!!mine}
                      aria-label={`${weekdayShort(date)} ${MEAL_LABEL[meal]}`}
                      disabled={busy === `${date}-${meal}`}
                      onClick={() => toggle(date, meal)}
                    >
                      {mine ? (
                        <span class="assign-check">
                          <Icon name={mine.leftover ? 'repeat' : 'check'} size={18} />
                          {mine.leftover ? 'sobra' : 'cozinhar'}
                        </span>
                      ) : (
                        <Icon name="plus" size={18} class="assign-plus" />
                      )}
                      {others.length > 0 && (
                        <span class="assign-others">
                          {others.slice(0, 2).map((d) => (
                            <Thumb key={d.uid} name={d.snapshot.name} emoji={d.snapshot.emoji} imageId={d.snapshot.imageId} size="xxs" />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <p class="fine">
            Se o prato já estiver na refeição anterior, ele entra como <strong>sobra</strong> e não vai para a lista de compras.
            Dá para mudar tocando no prato no cardápio.
          </p>
          <button class="btn btn-primary btn-block" onClick={onClose}>Pronto</button>
        </div>
      )}
    </Sheet>
  );
}
