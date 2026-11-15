import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { MEALS, MEAL_LABEL, countPlannedSlots } from '../db/plan';
import type { Cost, DayPlan, Dish, Meal } from '../db/types';
import { addDays, formatDayMonth, formatWeekRange, fromKey, weekdayName, weekdayShort } from '../lib/dates';
import { navigate, useLive } from '../lib/hooks';
import { COST_INFO } from '../db/recipes';
import { CostTag } from '../ui/CostTag';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { DishSheet } from './DishSheet';
import { MontarBody } from './Montar';
import { PickRecipe } from './PickRecipe';
import { useWeek, weekLabel } from './week';

type Target = { date: string; meal: Meal };

/** Uma semana: calendário de 7 dias (ver a programação) e Montar (escolher os pratos). */
export function Semana({ weekParam, tab }: { weekParam?: string; tab?: string }) {
  const { today, current, start, dates } = useWeek(weekParam);
  const mode = tab === 'montar' ? 'montar' : 'calendario';
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState<(Target & { replaceUid?: string }) | null>(null);
  const [openDish, setOpenDish] = useState<(Target & { dish: Dish }) | null>(null);

  const data = useLive(async () => ({ days: await db.days.bulkGet(dates) }), [start]);
  const byDate = new Map<string, DayPlan>();
  data?.days.forEach((d) => d && !d.deleted && byDate.set(d.id, d));
  const planned = countPlannedSlots(data?.days ?? []);

  const day = selected && dates.includes(selected) ? selected : dates.includes(today) ? today : dates[0];
  const go = (s: string, m = mode) => navigate('semana', s, m === 'montar' ? 'montar' : undefined);
  const liveOpen = openDish && byDate.get(openDish.date)?.slots[openDish.meal]?.find((d) => d.uid === openDish.dish.uid);

  // Resumo de custo dos pratos que serão cozinhados.
  const costCount: Record<Cost, number> = { baixo: 0, medio: 0, alto: 0 };
  for (const d of byDate.values()) for (const m of MEALS) for (const dish of d.slots[m] ?? []) {
    if (!dish.leftover && dish.snapshot.cost) costCount[dish.snapshot.cost]++;
  }

  return (
    <section class="screen">
      <div class="topbar">
        <button class="back" onClick={() => navigate('inicio')}><Icon name="left" size={20} /> Início</button>
      </div>
      <header class="screen-head">
        <p class="eyebrow">{weekLabel(start, current)}</p>
        <h1>Semana</h1>
      </header>

      <div class="week-nav">
        <button class="icon-btn" onClick={() => go(addDays(start, -7))} aria-label="Semana anterior"><Icon name="left" /></button>
        <div class="week-nav-label">
          <strong>{formatWeekRange(start)}</strong>
          <span>{planned} de 14 refeições planejadas</span>
        </div>
        <button class="icon-btn" onClick={() => go(addDays(start, 7))} aria-label="Próxima semana"><Icon name="right" /></button>
      </div>

      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'calendario'} class={`tab ${mode === 'calendario' ? 'is-on' : ''}`} onClick={() => go(start, 'calendario')}>
          <Icon name="calendar" size={18} /> Calendário
        </button>
        <button role="tab" aria-selected={mode === 'montar'} class={`tab ${mode === 'montar' ? 'is-on' : ''}`} onClick={() => go(start, 'montar')}>
          <Icon name="sparkles" size={18} /> Montar
        </button>
      </div>

      {mode === 'calendario' ? (
        <>
          {/* Calendário de 7 dias */}
          <div class="cal" role="grid" aria-label="Calendário da semana">
            <span class="cal-corner" />
            {dates.map((date) => (
              <button key={date} class={`cal-day ${date === day ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`} onClick={() => setSelected(date)}>
                <small>{weekdayShort(date)}</small>
                <strong>{fromKey(date).getDate()}</strong>
              </button>
            ))}
            {MEALS.map((meal) => (
              <Fragment key={meal}>
                <span class={`cal-meal cal-meal-${meal}`} title={MEAL_LABEL[meal]}><Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={16} /></span>
                {dates.map((date) => {
                  const dishes = byDate.get(date)?.slots[meal] ?? [];
                  const first = dishes[0];
                  return (
                    <button
                      key={date}
                      class={`cal-cell ${first ? 'is-filled' : ''} ${first?.leftover ? 'is-leftover' : ''} ${date === day ? 'is-selected' : ''} ${date < today ? 'is-past' : ''}`}
                      aria-label={`${weekdayName(date)} ${MEAL_LABEL[meal]}: ${first ? dishes.map((d) => d.snapshot.name).join(', ') : 'vazio'}`}
                      onClick={() => (first ? (setSelected(date), setOpenDish({ date, meal, dish: first })) : (setSelected(date), setPicking({ date, meal })))}
                    >
                      {first ? (
                        <>
                          <Thumb name={first.snapshot.name} emoji={first.snapshot.emoji} imageId={first.snapshot.imageId} size="fill" />
                          <span class="cal-name">{first.snapshot.name}</span>
                        </>
                      ) : <Icon name="plus" size={16} />}
                      {first?.leftover && <span class="board-badge" title="sobra"><Icon name="repeat" size={11} /></span>}
                      {dishes.length > 1 && <span class="board-more">+{dishes.length - 1}</span>}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>

          {/* Dia selecionado */}
          <div class="day-panel">
            <h2>{weekdayName(day)}, {formatDayMonth(day)}{day === today && <span class="chip chip-accent">hoje</span>}</h2>
            {MEALS.map((meal) => {
              const dishes = byDate.get(day)?.slots[meal] ?? [];
              return (
                <div class="day-meal" key={meal}>
                  <span class={`meal-pill meal-pill-${meal}`}><Icon name={meal === 'almoco' ? 'sun' : 'moon'} size={14} /> {MEAL_LABEL[meal]}</span>
                  {dishes.map((dish) => (
                    <button key={dish.uid} class={`dish ${dish.leftover ? 'dish-leftover' : ''}`} onClick={() => setOpenDish({ date: day, meal, dish })}>
                      <Thumb name={dish.snapshot.name} emoji={dish.snapshot.emoji} imageId={dish.snapshot.imageId} size="sm" />
                      <span class="dish-name">{dish.snapshot.name}</span>
                      {dish.leftover ? <span class="chip chip-leftover"><Icon name="repeat" size={12} /> sobra</span> : <CostTag cost={dish.snapshot.cost} compact />}
                    </button>
                  ))}
                  <button class={dishes.length ? 'add-more' : 'add-slot'} onClick={() => setPicking({ date: day, meal })}>
                    <Icon name="plus" size={dishes.length ? 16 : 18} /> {dishes.length ? 'outro prato' : `Escolher ${MEAL_LABEL[meal].toLowerCase()}`}
                  </button>
                </div>
              );
            })}
          </div>

          {(costCount.baixo + costCount.medio + costCount.alto) > 0 && (
            <div class="cost-summary">
              <span class="muted">Custo da semana:</span>
              {(['baixo', 'medio', 'alto'] as Cost[]).filter((c) => costCount[c]).map((c) => (
                <span key={c} class={`cost cost-${c}`}><b>{COST_INFO[c].short}</b><span>{costCount[c]} {COST_INFO[c].label.toLowerCase()}{costCount[c] > 1 ? 's' : ''}</span></span>
              ))}
            </div>
          )}

          <button class="btn btn-primary btn-block" onClick={() => navigate('lista', start)}>
            <Icon name="cart" size={18} /> Lista de compras desta semana
          </button>
        </>
      ) : (
        <MontarBody start={start} today={today} dates={dates} />
      )}

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
