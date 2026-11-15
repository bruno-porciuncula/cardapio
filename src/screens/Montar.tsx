import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { MEALS, MEAL_LABEL, countPlannedSlots } from '../db/plan';
import type { DayPlan, Dish, Meal } from '../db/types';
import { formatDayMonth, weekdayShort } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { collator, normalize } from '../lib/text';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { AssignSheet } from './AssignSheet';
import { DishSheet } from './Cardapio';
import { PickRecipe } from './PickRecipe';
import { WeekHeader, useWeek } from './WeekHeader';

type Filter = 'todas' | 'almoco' | 'jantar';
const FILTERS: Array<[Filter, string]> = [['todas', 'Todas'], ['almoco', 'Almoço'], ['jantar', 'Jantar']];

/**
 * Montar a semana a partir do catálogo: escolha a receita e marque os dias.
 * O quadro no topo mostra a semana se formando e também aceita toques.
 */
export function Montar({ weekParam }: { weekParam?: string }) {
  const { today, current, start, dates } = useWeek(weekParam);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ date: string; meal: Meal; replaceUid?: string } | null>(null);
  const [openDish, setOpenDish] = useState<{ date: string; meal: Meal; dish: Dish } | null>(null);

  const data = useLive(async () => ({
    days: await db.days.bulkGet(dates),
    recipes: (await db.recipes.toArray()).filter((r) => !r.deleted).sort((a, b) => collator.compare(a.name, b.name)),
  }), [start]);

  const byDate = new Map<string, DayPlan>();
  data?.days.forEach((d) => d && !d.deleted && byDate.set(d.id, d));
  const planned = countPlannedSlots(data?.days ?? []);

  // Quantas vezes cada receita aparece nesta semana.
  const uses = new Map<string, number>();
  for (const d of byDate.values()) for (const m of MEALS) for (const dish of d.slots[m] ?? []) uses.set(dish.recipeId, (uses.get(dish.recipeId) ?? 0) + 1);

  const q = normalize(query);
  const recipes = (data?.recipes ?? []).filter((r) =>
    (filter === 'todas' || r.mealType === filter || r.mealType === 'ambos') && (!q || normalize(r.name).includes(q)));

  const liveOpen = openDish && byDate.get(openDish.date)?.slots[openDish.meal]?.find((d) => d.uid === openDish.dish.uid);

  return (
    <section class="screen">
      <WeekHeader mode="montar" start={start} current={current} planned={planned} />

      {/* Quadro da semana */}
      <div class="board" role="grid" aria-label="Semana">
        <span />
        {dates.map((date) => (
          <span key={date} class={`board-day ${date === today ? 'is-today' : ''}`}>
            <strong>{weekdayShort(date)}</strong>
            <small>{formatDayMonth(date)}</small>
          </span>
        ))}
        {MEALS.map((meal) => (
          <Fragment key={meal}>
            <span class={`board-meal board-meal-${meal}`} title={MEAL_LABEL[meal]}>
              <Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={16} />
            </span>
            {dates.map((date) => {
              const dishes = byDate.get(date)?.slots[meal] ?? [];
              const first = dishes[0];
              return (
                <button
                  key={date}
                  class={`board-cell ${first ? 'is-filled' : ''} ${first?.leftover ? 'is-leftover' : ''} ${date < today ? 'is-past' : ''}`}
                  aria-label={`${weekdayShort(date)} ${MEAL_LABEL[meal]}${first ? `: ${dishes.map((d) => d.snapshot.name).join(', ')}` : ', vazio'}`}
                  onClick={() => (first ? setOpenDish({ date, meal, dish: first }) : setPicking({ date, meal }))}
                >
                  {first ? (
                    <Thumb name={first.snapshot.name} emoji={first.snapshot.emoji} imageId={first.snapshot.imageId} size="fill" />
                  ) : (
                    <Icon name="plus" size={16} />
                  )}
                  {first?.leftover && <span class="board-badge" title="sobra"><Icon name="repeat" size={11} /></span>}
                  {dishes.length > 1 && <span class="board-more">+{dishes.length - 1}</span>}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div class="build-head">
        <h2 class="section-title">Escolha os pratos</h2>
        <p class="muted">Toque numa receita e marque os dias. Tudo salva na hora.</p>
      </div>

      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Buscar receita" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      </label>
      <div class="chips" role="tablist">
        {FILTERS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} class={`chip chip-toggle ${filter === id ? 'is-on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div class="recipe-grid recipe-grid-build">
        {recipes.map((r) => {
          const n = uses.get(r.id) ?? 0;
          return (
            <button class={`recipe-card ${n ? 'is-used' : ''}`} key={r.id} onClick={() => setAssigning(r.id)}>
              <span class="recipe-card-media">
                <Thumb name={r.name} emoji={r.emoji} imageId={r.imageId} size="lg" />
                <span class="recipe-card-add" aria-hidden="true"><Icon name={n ? 'check' : 'plus'} size={20} /></span>
                {n > 0 && <span class="recipe-card-uses">{n}× na semana</span>}
              </span>
              <span class="recipe-card-body">
                <strong>{r.name}</strong>
              </span>
            </button>
          );
        })}
        {data && recipes.length === 0 && <p class="muted pad">Nenhuma receita encontrada.</p>}
      </div>

      {planned > 0 && start === current && (
        <div class="build-footer">
          <button class="btn btn-primary" onClick={() => navigate('lista')}>
            <Icon name="cart" size={18} /> Ver lista de compras
          </button>
        </div>
      )}

      {assigning && <AssignSheet recipeId={assigning} start={start} today={today} onClose={() => setAssigning(null)} />}
      {picking && <PickRecipe {...picking} onClose={() => setPicking(null)} />}
      {openDish && liveOpen && (
        <DishSheet
          {...openDish}
          dish={liveOpen}
          onClose={() => setOpenDish(null)}
          onReplace={() => {
            setOpenDish(null);
            setPicking({ date: openDish.date, meal: openDish.meal, replaceUid: openDish.dish.uid });
          }}
        />
      )}
    </section>
  );
}
