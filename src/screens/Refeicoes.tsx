import { useState } from 'preact/hooks';
import { db } from '../db/db';
import type { MealType } from '../db/types';
import { collator, normalize } from '../lib/text';
import { navigate, useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { RecipeDetail } from './RecipeDetail';

type Filter = 'todas' | 'almoco' | 'jantar';
const FILTERS: Array<[Filter, string]> = [['todas', 'Todas'], ['almoco', 'Almoço'], ['jantar', 'Jantar']];
const TYPE_LABEL: Record<MealType, string> = { almoco: 'Almoço', jantar: 'Jantar', ambos: 'Almoço e jantar' };

export function Refeicoes() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [open, setOpen] = useState<string | null>(null);

  const recipes = useLive(async () => {
    const all = (await db.recipes.toArray()).filter((r) => !r.deleted);
    return all.sort((a, b) => collator.compare(a.name, b.name));
  });

  const q = normalize(query);
  const visible = (recipes ?? []).filter((r) => {
    if (filter !== 'todas' && r.mealType !== filter && r.mealType !== 'ambos') return false;
    return !q || normalize(r.name).includes(q);
  });

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">Biblioteca</p>
        <h1>Refeições</h1>
      </header>

      <label class="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Buscar receita"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </label>

      <div class="chips" role="tablist">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            class={`chip chip-toggle ${filter === id ? 'is-on' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <span class="muted chips-count">{visible.length} de {recipes?.length ?? 0}</span>
      </div>

      {recipes && recipes.length === 0 && (
        <div class="empty-card">
          <Icon name="book" size={28} />
          <h3>Nenhuma receita ainda</h3>
          <p class="muted">O cadastro de receitas chega na próxima etapa. Por enquanto, dá para carregar o cardápio de exemplo.</p>
          <button class="btn" onClick={() => navigate('cardapio')}>Ir para o cardápio</button>
        </div>
      )}
      {recipes && recipes.length > 0 && visible.length === 0 && (
        <p class="muted center pad">Nada encontrado para “{query}”.</p>
      )}

      <div class="recipe-grid">
        {visible.map((r) => (
          <button class="recipe-card" key={r.id} onClick={() => setOpen(r.id)}>
            <Thumb name={r.name} imageId={r.imageId} size="lg" />
            <span class="recipe-card-body">
              <strong>{r.name}</strong>
              <span class="muted">
                {r.items.length} ingrediente{r.items.length === 1 ? '' : 's'} · {TYPE_LABEL[r.mealType]}
              </span>
            </span>
          </button>
        ))}
      </div>

      {open && <RecipeDetail recipeId={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
