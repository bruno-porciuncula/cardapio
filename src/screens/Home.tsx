import { db } from '../db/db';
import { bankPending } from '../db/bank';
import { MEALS, MEAL_LABEL, countPlannedSlots } from '../db/plan';
import type { DayPlan, Dish } from '../db/types';
import { addDays, formatDayMonth, formatWeekRange, startOfWeek, weekDates, weekdayName, weekdayShort } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { useWeek, weekLabel } from './week';

interface WeekCard {
  start: string;
  planned: number;
  days: Array<DayPlan | undefined>;
}

function firstDish(day?: DayPlan): Dish | undefined {
  return day?.slots.almoco?.[0] ?? day?.slots.jantar?.[0];
}

/** Tela inicial: hoje, esta semana e as outras semanas para abrir. */
export function Home() {
  const { ws, today, current } = useWeek();

  const data = useLive(async () => {
    const load = async (start: string): Promise<WeekCard> => {
      const days = await db.days.bulkGet(weekDates(start));
      return { start, days, planned: countPlannedSlots(days) };
    };
    const next = await Promise.all([1, 2, 3].map((i) => load(addDays(current, 7 * i))));
    // Semanas anteriores com algo planejado (mais recentes primeiro).
    const pastStarts = new Set<string>();
    for (const d of await db.days.where('id').below(current).toArray()) {
      if (!d.deleted && (d.slots.almoco?.length || d.slots.jantar?.length)) pastStarts.add(startOfWeek(d.id, ws));
    }
    const past = await Promise.all([...pastStarts].sort().reverse().slice(0, 8).map(load));
    return {
      thisWeek: await load(current),
      today: await db.days.get(today),
      next,
      past,
      recipes: await db.recipes.filter((r) => !r.deleted).count(),
      pending: await bankPending(db),
    };
  }, [current, ws, today]);

  if (!data) return <section class="screen" />;
  const tw = data.thisWeek;

  return (
    <section class="screen">
      <header class="screen-head home-head">
        <img class="home-logo" src="icon-192.png" alt="" aria-hidden="true" />
        <div>
          <p class="eyebrow">{weekdayName(today)}, {formatDayMonth(today)}</p>
          <h1>Refeição dos porcis</h1>
        </div>
      </header>

      {/* Esta semana */}
      <button class="week-hero" onClick={() => navigate('semana', current)}>
        <span class="week-hero-top">
          <span>
            <span class="week-hero-kicker">Esta semana</span>
            <strong>{formatWeekRange(current)}</strong>
          </span>
          <span class="week-hero-go"><Icon name="right" size={22} /></span>
        </span>
        <span class="week-strip">
          {weekDates(current).map((date, i) => {
            const dish = firstDish(tw.days[i] ?? undefined);
            return (
              <span key={date} class={`week-strip-day ${date === today ? 'is-today' : ''}`}>
                <small>{weekdayShort(date)}</small>
                {dish
                  ? <Thumb name={dish.snapshot.name} emoji={dish.snapshot.emoji} imageId={dish.snapshot.imageId} size="xs" />
                  : <span class="week-strip-empty" />}
              </span>
            );
          })}
        </span>
        <span class="week-hero-progress">
          <span class="bar"><span style={{ width: `${(tw.planned / 14) * 100}%` }} /></span>
          {tw.planned} de 14 refeições planejadas
        </span>
      </button>

      <div class="quick-actions">
        <button class="quick" onClick={() => navigate('semana', current, 'montar')}>
          <span class="quick-icon">🗓️</span><span>Montar a semana</span>
        </button>
        <button class="quick" onClick={() => navigate('lista', current)}>
          <span class="quick-icon">🛒</span><span>Lista de compras</span>
        </button>
        <button class="quick" onClick={() => navigate('receita', 'nova')}>
          <span class="quick-icon">✍️</span><span>Nova receita</span>
        </button>
      </div>

      {/* Hoje */}
      <h2 class="section-title">Hoje</h2>
      <div class="today-list">
        {MEALS.map((meal) => {
          const dishes = data.today && !data.today.deleted ? data.today.slots[meal] ?? [] : [];
          return (
            <button key={meal} class="today-row" onClick={() => navigate('semana', current)}>
              <span class={`meal-pill meal-pill-${meal}`}><Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={14} /> {MEAL_LABEL[meal]}</span>
              {dishes.length ? (
                <span class="today-row-dishes">
                  {dishes.map((d) => (
                    <span key={d.uid} class="today-row-dish">
                      <Thumb name={d.snapshot.name} emoji={d.snapshot.emoji} imageId={d.snapshot.imageId} size="sm" />
                      <span>{d.snapshot.name}{d.leftover && <em> · sobra</em>}</span>
                    </span>
                  ))}
                </span>
              ) : (
                <span class="muted">Nada planejado</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Próximas semanas */}
      <h2 class="section-title">Próximas semanas</h2>
      <div class="week-cards">
        {data.next.map((w) => <WeekRow key={w.start} week={w} current={current} />)}
      </div>

      {data.past.length > 0 && (
        <>
          <h2 class="section-title">Semanas anteriores</h2>
          <div class="week-cards">
            {data.past.map((w) => <WeekRow key={w.start} week={w} current={current} />)}
          </div>
        </>
      )}

      {data.pending > 0 && (
        <button class="bank-banner" onClick={() => navigate('cardapio')}>
          <span>📚</span>
          <span><strong>{data.pending} receitas sugeridas</strong> esperando no Cardápio</span>
          <Icon name="right" size={18} />
        </button>
      )}
    </section>
  );
}

function WeekRow({ week, current }: { week: WeekCard; current: string }) {
  const empty = week.planned === 0;
  const thumbs = week.days.flatMap((d) => (d && !d.deleted ? [...(d.slots.almoco ?? []), ...(d.slots.jantar ?? [])] : []))
    .filter((d, i, arr) => arr.findIndex((x) => x.recipeId === d.recipeId) === i)
    .slice(0, 5);
  return (
    <button class={`week-row ${empty ? 'is-empty' : ''}`} onClick={() => navigate('semana', week.start, empty ? 'montar' : undefined)}>
      <span class="week-row-text">
        <small>{weekLabel(week.start, current)}</small>
        <strong>{formatWeekRange(week.start)}</strong>
        <span class="muted">{empty ? 'Ainda não planejada' : `${week.planned} de 14 refeições`}</span>
      </span>
      {empty ? (
        <span class="week-row-cta"><Icon name="plus" size={16} /> Planejar</span>
      ) : (
        <span class="week-row-thumbs">
          {thumbs.map((d) => <Thumb key={d.uid} name={d.snapshot.name} emoji={d.snapshot.emoji} imageId={d.snapshot.imageId} size="xxs" />)}
        </span>
      )}
    </button>
  );
}
