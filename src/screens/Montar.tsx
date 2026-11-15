import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { MEALS } from '../db/plan';
import type { Cost, DayPlan } from '../db/types';
import { navigate, useLive } from '../lib/hooks';
import { collator, normalize } from '../lib/text';
import { CostTag } from '../ui/CostTag';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { AssignSheet } from './AssignSheet';

type Filter = 'todas' | 'baratas' | 'almoco' | 'jantar';
const FILTERS: Array<[Filter, string]> = [['todas', 'Todas'], ['baratas', '$ Econômicas'], ['almoco', 'Almoço'], ['jantar', 'Jantar']];
const COST_ORDER: Record<Cost, number> = { baixo: 0, medio: 1, alto: 2 };

/**
 * Montar a semana pelo catálogo: toque numa receita e marque os dias.
 * (O calendário da semana fica na outra aba.)
 */
export function MontarBody({ start, today, dates }: { start: string; today: string; dates: string[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [assigning, setAssigning] = useState<string | null>(null);

  const data = useLive(async () => ({
    days: await db.days.bulkGet(dates),
    recipes: (await db.recipes.toArray()).filter((r) => !r.deleted).sort((a, b) => collator.compare(a.name, b.name)),
  }), [start]);

  const uses = new Map<string, number>();
  (data?.days ?? []).forEach((d?: DayPlan) => {
    if (!d || d.deleted) return;
    for (const m of MEALS) for (const dish of d.slots[m] ?? []) uses.set(dish.recipeId, (uses.get(dish.recipeId) ?? 0) + 1);
  });

  const q = normalize(query);
  const recipes = (data?.recipes ?? [])
    .filter((r) => {
      if (filter === 'baratas' && r.cost !== 'baixo') return false;
      if ((filter === 'almoco' || filter === 'jantar') && r.mealType !== filter && r.mealType !== 'ambos') return false;
      return !q || normalize(r.name).includes(q);
    })
    .sort((a, b) => (filter === 'todas' ? 0 : COST_ORDER[a.cost ?? 'medio'] - COST_ORDER[b.cost ?? 'medio']));

  return (
    <>
      <div class="build-head">
        <p class="muted">Toque num prato e marque em quais dias ele entra. Tudo salva na hora.</p>
      </div>

      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Buscar prato" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      </label>
      <div class="chips chips-scroll" role="tablist">
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
                <CostTag cost={r.cost} />
              </span>
            </button>
          );
        })}
        <button class="recipe-card recipe-card-new" onClick={() => navigate('receita', 'nova')}>
          <span class="recipe-card-new-icon"><Icon name="plus" size={28} /></span>
          <strong>Nova receita</strong>
        </button>
        {data && recipes.length === 0 && <p class="muted pad">Nenhum prato encontrado.</p>}
      </div>

      {assigning && <AssignSheet recipeId={assigning} start={start} today={today} onClose={() => setAssigning(null)} />}
    </>
  );
}
