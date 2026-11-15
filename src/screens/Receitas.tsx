import { useState } from 'preact/hooks';
import { db } from '../db/db';
import { bankPending, loadBank } from '../db/bank';
import type { Cost } from '../db/types';
import { navigate, useLive } from '../lib/hooks';
import { collator, normalize } from '../lib/text';
import { CostTag } from '../ui/CostTag';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';
import { AssignSheet } from './AssignSheet';
import { RecipeDetail } from './RecipeDetail';
import { useWeek } from './week';

type Filter = 'todas' | Cost | 'almoco' | 'jantar';
const FILTERS: Array<[Filter, string]> = [
  ['todas', 'Todas'], ['baixo', '$ Econômicas'], ['medio', '$$ Médias'], ['alto', '$$$ Mais caras'], ['almoco', 'Almoço'], ['jantar', 'Jantar'],
];

/** Cardápio: todas as receitas da casa, com busca, filtros e o botão de criar. */
export function Receitas() {
  const { today, current } = useWeek();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [open, setOpen] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const data = useLive(async () => ({
    recipes: (await db.recipes.toArray()).filter((r) => !r.deleted).sort((a, b) => collator.compare(a.name, b.name)),
    pending: await bankPending(db),
  }));

  const q = normalize(query);
  const visible = (data?.recipes ?? []).filter((r) => {
    if (filter === 'baixo' || filter === 'medio' || filter === 'alto') { if (r.cost !== filter) return false; }
    else if (filter !== 'todas' && r.mealType !== filter && r.mealType !== 'ambos') return false;
    return !q || normalize(r.name).includes(q);
  });

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">{data ? `${data.recipes.length} receitas` : 'Receitas'}</p>
        <h1>Cardápio</h1>
      </header>

      <button class="btn btn-primary btn-new" onClick={() => navigate('receita', 'nova')}>
        <Icon name="plus" size={20} /> Nova receita
      </button>

      {data && data.pending > 0 && (
        <div class="bank-card">
          <span class="empty-emoji">📚</span>
          <div>
            <strong>{data.pending} receitas sugeridas</strong>
            <p class="muted">Pratos no estilo dos seus cardápios, já com a tag de custo. Você edita ou apaga depois.</p>
          </div>
          <button class="btn" disabled={loading} onClick={async () => { setLoading(true); await loadBank(db); setLoading(false); }}>
            {loading ? 'Adicionando…' : 'Adicionar'}
          </button>
        </div>
      )}

      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Buscar receita" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      </label>
      <div class="chips chips-scroll" role="tablist">
        {FILTERS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} class={`chip chip-toggle ${filter === id ? 'is-on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {data && visible.length === 0 && <p class="muted center pad">Nada encontrado.</p>}

      <div class="recipe-grid">
        {visible.map((r) => (
          <div class="recipe-card" key={r.id} role="button" tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(r.id)}>
            <span class="recipe-card-media">
              <Thumb name={r.name} emoji={r.emoji} imageId={r.imageId} size="lg" />
              <button class="recipe-card-add" aria-label={`Adicionar ${r.name} à semana`} onClick={(e) => { e.stopPropagation(); setAssigning(r.id); }}>
                <Icon name="plus" size={20} />
              </button>
            </span>
            <span class="recipe-card-body">
              <strong>{r.name}</strong>
              <span class="recipe-card-meta">
                <CostTag cost={r.cost} />
                <span class="muted">{r.items.length} ingr.</span>
              </span>
            </span>
          </div>
        ))}
      </div>

      {open && (
        <RecipeDetail
          recipeId={open}
          onClose={() => setOpen(null)}
          actions={
            <div class="action-row">
              <button class="btn" onClick={() => { const id = open; setOpen(null); navigate('receita', id); }}>
                <Icon name="edit" size={18} /> Editar
              </button>
              <button class="btn btn-primary" onClick={() => { const id = open; setOpen(null); setAssigning(id); }}>
                <Icon name="plus" size={18} /> Pôr na semana
              </button>
            </div>
          }
        />
      )}
      {assigning && <AssignSheet recipeId={assigning} start={current} today={today} onClose={() => setAssigning(null)} />}
    </section>
  );
}
