import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { loadExample } from '../db/example';
import { MEALS, MEAL_LABEL, countPlannedSlots, dishCount, removeDish, setLeftover } from '../db/plan';
import type { DayPlan, Dish, Meal } from '../db/types';
import { formatDayMonth, weekdayName } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { PickRecipe } from './PickRecipe';
import { RecipeDetail } from './RecipeDetail';
import { WeekHeader, goWeek, useWeek } from './WeekHeader';

type Target = { date: string; meal: Meal };

export function Cardapio({ weekParam }: { weekParam?: string }) {
  const { today, current, start, dates } = useWeek(weekParam);

  const [picking, setPicking] = useState<(Target & { replaceUid?: string }) | null>(null);
  const [openDish, setOpenDish] = useState<(Target & { dish: Dish }) | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(false);

  const data = useLive(async () => ({
    days: await db.days.bulkGet(dates),
    recipeCount: await db.recipes.filter((r) => !r.deleted).count(),
  }), [start]);

  const byDate = new Map<string, DayPlan>();
  data?.days.forEach((d) => d && !d.deleted && byDate.set(d.id, d));
  const total = dishCount(data?.days ?? []);
  const planned = countPlannedSlots(data?.days ?? []);
  const isCurrent = start === current;
  const pastDates = isCurrent ? dates.filter((d) => d < today) : [];
  const visibleDates = showPast ? dates : dates.filter((d) => !pastDates.includes(d));

  // Mantém o prato aberto em sincronia com o banco (ex.: depois de marcar como sobra).
  const liveOpen = openDish && byDate.get(openDish.date)?.slots[openDish.meal]?.find((d) => d.uid === openDish.dish.uid);

  async function onLoadExample() {
    setLoading(true);
    try {
      await loadExample(db, start);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section class="screen">
      <WeekHeader mode="cardapio" start={start} current={current} planned={planned} />

      {data && data.recipeCount === 0 && total === 0 && (
        <div class="empty-card">
          <span class="empty-emoji">🍳</span>
          <h3>Comece pelo cardápio de exemplo</h3>
          <p class="muted">Carrega 8 receitas e preenche os almoços desta semana. Fica salvo e você pode editar.</p>
          <button class="btn btn-primary" disabled={loading} onClick={onLoadExample}>
            {loading ? 'Carregando…' : 'Carregar exemplo'}
          </button>
        </div>
      )}

      {data && data.recipeCount > 0 && total === 0 && (
        <div class="empty-card">
          <span class="empty-emoji">🍽️</span>
          <h3>Semana em branco</h3>
          <p class="muted">Escolha os pratos no catálogo e marque os dias de uma vez.</p>
          <button class="btn btn-primary" onClick={() => goWeek('montar', start, current)}>
            <Icon name="sparkles" size={18} /> Montar semana
          </button>
        </div>
      )}

      {isCurrent && (
        <TodayCard
          date={today}
          day={byDate.get(today)}
          onOpen={(meal, dish) => setOpenDish({ date: today, meal, dish })}
          onAdd={(meal) => setPicking({ date: today, meal })}
        />
      )}

      {pastDates.length > 0 && (
        <button class="past-toggle" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
          {showPast ? 'Ocultar' : 'Mostrar'} {pastDates.length} dia{pastDates.length === 1 ? '' : 's'} anterior{pastDates.length === 1 ? '' : 'es'}
          <Icon name="down" size={18} class={showPast ? 'flip' : ''} />
        </button>
      )}

      <div class="days">
        {visibleDates.map((date) => {
          const day = byDate.get(date);
          if (date === today && isCurrent) return null; // já está no card "Hoje"
          return (
            <article class={`day ${date < today ? 'day-past' : ''}`} key={date}>
              <header class="day-head">
                <h2>{weekdayName(date)}</h2>
                <span class="day-date">{formatDayMonth(date)}</span>
              </header>
              {MEALS.map((meal) => (
                <Slot
                  key={meal}
                  meal={meal}
                  dishes={day?.slots[meal] ?? []}
                  onOpen={(dish) => setOpenDish({ date, meal, dish })}
                  onAdd={() => setPicking({ date, meal })}
                />
              ))}
            </article>
          );
        })}
      </div>

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

function TodayCard({ date, day, onOpen, onAdd }: {
  date: string;
  day?: DayPlan;
  onOpen: (meal: Meal, dish: Dish) => void;
  onAdd: (meal: Meal) => void;
}) {
  return (
    <article class="today">
      <header class="today-head">
        <span class="today-kicker">Hoje</span>
        <h2>{weekdayName(date)}, {formatDayMonth(date)}</h2>
      </header>
      <div class="today-meals">
        {MEALS.map((meal) => {
          const dishes = day?.slots[meal] ?? [];
          return (
            <div class={`today-meal meal-${meal}`} key={meal}>
              <span class={`meal-pill meal-pill-${meal}`}>
                <Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={14} /> {MEAL_LABEL[meal]}
              </span>
              {dishes.map((dish) => (
                <button class="today-dish" key={dish.uid} onClick={() => onOpen(meal, dish)}>
                  <Thumb name={dish.snapshot.name} emoji={dish.snapshot.emoji} imageId={dish.snapshot.imageId} size="md" />
                  <span class="dish-name">{dish.snapshot.name}</span>
                  {dish.leftover && <span class="chip chip-leftover">sobra</span>}
                </button>
              ))}
              <button class={dishes.length ? 'add-more' : 'add-slot add-slot-light'} onClick={() => onAdd(meal)}>
                <Icon name="plus" size={18} /> {dishes.length ? 'Adicionar prato' : `Adicionar ${MEAL_LABEL[meal].toLowerCase()}`}
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Slot({ meal, dishes, onOpen, onAdd }: {
  meal: Meal;
  dishes: Dish[];
  onOpen: (dish: Dish) => void;
  onAdd: () => void;
}) {
  return (
    <div class="slot">
      <span class={`meal-pill meal-pill-${meal}`}>
        <Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={14} /> {MEAL_LABEL[meal]}
      </span>
      <div class="slot-body">
        {dishes.map((dish) => (
          <button class={`dish ${dish.leftover ? 'dish-leftover' : ''}`} key={dish.uid} onClick={() => onOpen(dish)}>
            <Thumb name={dish.snapshot.name} emoji={dish.snapshot.emoji} imageId={dish.snapshot.imageId} size="sm" />
            <span class="dish-name">{dish.snapshot.name}</span>
            {dish.leftover && <span class="chip chip-leftover"><Icon name="repeat" size={12} /> sobra</span>}
          </button>
        ))}
        {dishes.length === 0 ? (
          <button class="add-slot" onClick={onAdd}>
            <Icon name="plus" size={18} /> Adicionar {MEAL_LABEL[meal].toLowerCase()}
          </button>
        ) : (
          <button class="add-more" onClick={onAdd}><Icon name="plus" size={16} /> prato</button>
        )}
      </div>
    </div>
  );
}

export function DishSheet({ date, meal, dish, onClose, onReplace }: Target & {
  dish: Dish;
  onClose: () => void;
  onReplace: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <RecipeDetail
      snapshot={dish.snapshot}
      onClose={onClose}
      badge={
        <span class={`meal-pill meal-pill-${meal}`}>
          {MEAL_LABEL[meal]} · {weekdayName(date).toLowerCase()} {formatDayMonth(date)}
        </span>
      }
      actions={
        <>
          <label class="toggle-row">
            <span>
              <strong>É sobra</strong>
              <small class="muted">Sobra aparece no cardápio, mas não entra na lista de compras.</small>
            </span>
            <input
              type="checkbox"
              class="switch"
              checked={!!dish.leftover}
              onChange={(e) => setLeftover(db, date, meal, dish.uid, (e.target as HTMLInputElement).checked)}
            />
          </label>
          <div class="action-row">
            <button class="btn" onClick={onReplace}><Icon name="swap" size={18} /> Trocar</button>
            {confirmRemove ? (
              <button class="btn btn-danger" onClick={async () => { await removeDish(db, date, meal, dish.uid); onClose(); }}>
                Confirmar remoção
              </button>
            ) : (
              <button class="btn btn-ghost-danger" onClick={() => setConfirmRemove(true)}><Icon name="trash" size={18} /> Remover</button>
            )}
          </div>
        </>
      }
    />
  );
}
