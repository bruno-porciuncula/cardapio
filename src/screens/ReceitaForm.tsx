import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/db';
import { COST_INFO, deleteRecipe, draftFromRecipe, guessCategory, saveRecipe, type DraftItem, type RecipeDraft } from '../db/recipes';
import type { Cost, MealType } from '../db/types';
import { navigate, useLive } from '../lib/hooks';
import { dishEmoji } from '../lib/emoji';
import { normalize } from '../lib/text';
import { UNITS } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Thumb } from '../ui/Thumb';

const EMOJIS = [
  '🍝', '🍛', '🍲', '🥘', '🍚', '🍜', '🥗', '🍳', '🥞', '🍗', '🥩', '🍔', '🍕', '🌯', '🌮', '🥪', '🌭', '🫓',
  '🥧', '🍆', '🥔', '🥕', '🥦', '🌽', '🍅', '🎃', '🍄', '🫘', '🐟', '🍤', '🥟', '🍱', '🥢', '🧀', '🥖', '🍽️',
];
const MEAL_TYPES: Array<[MealType, string]> = [['ambos', 'Almoço e jantar'], ['almoco', 'Almoço'], ['jantar', 'Jantar']];
const COSTS: Cost[] = ['baixo', 'medio', 'alto'];
const emptyItem = (): DraftItem => ({ name: '', quantity: null, unit: null });

/** Criar ou editar uma receita: emoji, nome, refeição, custo e ingredientes. */
export function ReceitaForm({ id }: { id?: string }) {
  const isNew = !id || id === 'nova';
  const [draft, setDraft] = useState<RecipeDraft | null>(isNew ? { name: '', mealType: 'ambos', servings: 6, items: [emptyItem(), emptyItem(), emptyItem()] } : null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isNew) return;
    draftFromRecipe(db, id!).then((d) => (d ? setDraft({ ...d, items: [...d.items, emptyItem()] }) : setError('Receita não encontrada.')));
  }, [id]);

  const ingredients = useLive(async () => (await db.ingredients.toArray()).filter((i) => !i.deleted));
  const categories = useLive(async () => (await db.categories.toArray()).filter((c) => !c.deleted).sort((a, b) => a.order - b.order));
  const known = new Set<string>();
  for (const i of ingredients ?? []) { known.add(normalize(i.name)); i.aliases.forEach((a) => known.add(normalize(a))); }

  if (!draft) return <section class="screen"><p class="muted pad">{error || 'Carregando…'}</p></section>;

  const set = (patch: Partial<RecipeDraft>) => setDraft({ ...draft, ...patch });
  const setItem = (i: number, patch: Partial<DraftItem>) => {
    const items = draft.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    // Sempre deixa uma linha vazia no fim, pronta para o próximo ingrediente.
    if (items[items.length - 1].name.trim()) items.push(emptyItem());
    set({ items });
  };
  const removeItem = (i: number) => set({ items: draft.items.length > 1 ? draft.items.filter((_, j) => j !== i) : [emptyItem()] });
  const emoji = draft.emoji ?? dishEmoji(draft.name || '?');
  const usingPhoto = !!draft.imageId;

  async function save() {
    setError('');
    if (!draft!.name.trim()) return setError('Dê um nome para a receita.');
    setSaving(true);
    try {
      await saveRecipe(db, { ...draft!, emoji });
      navigate('cardapio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section class="screen form-screen">
      <div class="topbar">
        <button class="back" onClick={() => history.back()}><Icon name="left" size={20} /> Voltar</button>
      </div>
      <header class="screen-head">
        <p class="eyebrow">Cardápio</p>
        <h1>{isNew ? 'Nova receita' : 'Editar receita'}</h1>
      </header>

      {/* Imagem (emoji) */}
      <div class="form-card">
        <span class="form-label">Imagem</span>
        <div class="emoji-hero">
          {usingPhoto ? <Thumb name={draft.name} imageId={draft.imageId ?? undefined} size="md" /> : <span class="emoji-big">{emoji}</span>}
          <span class="muted">
            {usingPhoto ? 'Esta receita tem foto.' : 'Escolha o emoji que aparece no card.'}
            {usingPhoto && <button class="link-btn" onClick={() => set({ imageId: null })}>Usar emoji no lugar da foto</button>}
          </span>
        </div>
        {!usingPhoto && (
          <div class="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} class={`emoji-opt ${e === emoji ? 'is-on' : ''}`} onClick={() => set({ emoji: e })} aria-label={`Emoji ${e}`}>{e}</button>
            ))}
          </div>
        )}
      </div>

      {/* Título */}
      <div class="form-card">
        <label class="field">
          <span class="form-label">Nome da receita</span>
          <input type="text" placeholder="Ex.: Frango xadrez" value={draft.name} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
        </label>

        <span class="form-label">Serve para</span>
        <div class="chips">
          {MEAL_TYPES.map(([v, label]) => (
            <button key={v} class={`chip chip-toggle ${draft.mealType === v ? 'is-on' : ''}`} onClick={() => set({ mealType: v })}>{label}</button>
          ))}
        </div>

        <div class="form-row">
          <label class="field field-small">
            <span class="form-label">Rende</span>
            <span class="input-suffix">
              <input type="number" inputMode="numeric" min="1" max="30" value={draft.servings ?? 6}
                onInput={(e) => set({ servings: Number((e.target as HTMLInputElement).value) || undefined })} />
              <span>pratos</span>
            </span>
          </label>
          <label class="field">
            <span class="form-label">Link do modo de preparo (opcional)</span>
            <input type="url" inputMode="url" placeholder="https://…" value={draft.link ?? ''}
              onInput={(e) => set({ link: (e.target as HTMLInputElement).value })} />
          </label>
        </div>

        <span class="form-label">Custo</span>
        <div class="cost-pick">
          {COSTS.map((c) => (
            <button key={c} class={`cost-opt cost-${c} ${draft.cost === c ? 'is-on' : ''}`} onClick={() => set({ cost: draft.cost === c ? undefined : c })}>
              <b>{COST_INFO[c].short}</b>
              <span>{COST_INFO[c].label}</span>
              <small>{COST_INFO[c].hint}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Ingredientes */}
      <div class="form-card">
        <span class="form-label">Ingredientes</span>
        <p class="fine">Quantidades para {draft.servings ?? 6} pratos. Ingredientes com o mesmo nome se juntam na lista de compras.</p>
        <datalist id="ingredientes">
          {(ingredients ?? []).map((i) => <option key={i.id} value={i.name} />)}
        </datalist>
        <div class="ing-rows">
          {draft.items.map((it, i) => {
            const isNewIng = it.name.trim() && !known.has(normalize(it.name));
            return (
              <div class="ing-row" key={i}>
                <input class="ing-row-name" type="text" list="ingredientes" placeholder={i === draft.items.length - 1 ? '+ Adicionar ingrediente' : 'Ingrediente'}
                  value={it.name} onInput={(e) => setItem(i, { name: (e.target as HTMLInputElement).value })} />
                {it.name.trim() && (
                  <>
                    <input class="ing-row-qty" type="number" inputMode="decimal" min="0" step="any" placeholder="qtd"
                      value={it.quantity ?? ''} onInput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        setItem(i, { quantity: v === '' ? null : Number(v), unit: it.unit ?? 'un' });
                      }} />
                    <select class="ing-row-unit" value={it.unit ?? 'un'} disabled={it.quantity == null}
                      onChange={(e) => setItem(i, { unit: (e.target as HTMLSelectElement).value })}>
                      {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </select>
                    <button class="icon-btn ing-row-del" onClick={() => removeItem(i)} aria-label="Tirar ingrediente"><Icon name="close" size={18} /></button>
                  </>
                )}
                {isNewIng && (
                  <label class="ing-row-new">
                    <span>Novo ingrediente · seção:</span>
                    <select value={it.categoryId ?? guessCategory(it.name)} onChange={(e) => setItem(i, { categoryId: (e.target as HTMLSelectElement).value })}>
                      {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p class="fine error">{error}</p>}

      <div class="form-actions">
        <button class="btn btn-primary btn-block" disabled={saving} onClick={save}>
          <Icon name="check" size={18} /> {saving ? 'Salvando…' : isNew ? 'Criar receita' : 'Salvar alterações'}
        </button>
        {!isNew && (confirmDelete ? (
          <button class="btn btn-danger btn-block" onClick={async () => { await deleteRecipe(db, draft.id!); navigate('cardapio'); }}>
            Sim, apagar esta receita
          </button>
        ) : (
          <button class="btn btn-ghost-danger btn-block" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={18} /> Apagar receita
          </button>
        ))}
        {!isNew && confirmDelete && <p class="fine center">Os cardápios já montados continuam mostrando o prato.</p>}
      </div>
    </section>
  );
}
