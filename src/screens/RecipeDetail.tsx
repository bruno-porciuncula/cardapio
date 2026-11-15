import type { ComponentChildren } from 'preact';
import { Sheet } from '../ui/Sheet';
import { Thumb } from '../ui/Thumb';
import { db } from '../db/db';
import type { Category, Recipe, RecipeSnapshot } from '../db/types';
import { useLive } from '../lib/hooks';
import { formatQuantity } from '../lib/units';
import { Icon } from '../ui/Icon';
import { CostTag } from '../ui/CostTag';

const MEAL_TYPE_LABEL = { almoco: 'Almoço', jantar: 'Jantar', ambos: 'Almoço e jantar' };

/**
 * Detalhes de uma receita: recebe um snapshot (versão congelada do cardápio)
 * ou o id de uma receita da biblioteca. `actions` aparece no rodapé.
 */
export function RecipeDetail({ recipeId, snapshot, badge, actions, onClose }: {
  recipeId?: string;
  snapshot?: RecipeSnapshot;
  badge?: ComponentChildren;
  actions?: ComponentChildren;
  onClose: () => void;
}) {
  const data = useLive(async () => {
    const categories = new Map<string, Category>((await db.categories.toArray()).map((c) => [c.id, c]));
    if (snapshot) return { categories, recipe: null as Recipe | null, view: snapshot };
    const recipe = recipeId ? await db.recipes.get(recipeId) : undefined;
    if (!recipe) return { categories, recipe: null, view: null };
    const ings = await db.ingredients.bulkGet(recipe.items.map((i) => i.ingredientId));
    const view: RecipeSnapshot = {
      name: recipe.name,
      emoji: recipe.emoji,
      cost: recipe.cost,
      servings: recipe.servings,
      link: recipe.link,
      imageId: recipe.imageId,
      items: recipe.items.map((item, i) => ({
        ...item,
        ingredientName: ings[i]?.name ?? '(ingrediente removido)',
        categoryId: ings[i]?.categoryId ?? 'outros',
      })),
    };
    return { categories, recipe, view };
  }, [recipeId, snapshot]);

  const view = data?.view;
  return (
    <Sheet title={view?.name ?? 'Receita'} onClose={onClose}>
      {data && !view && <p class="muted">Esta receita não existe mais na biblioteca.</p>}
      {view && (
        <div class="recipe-detail">
          <Thumb name={view.name} emoji={view.emoji} imageId={view.imageId} size="hero" />
          <div class="recipe-meta">
            {badge}
            {data.recipe && <span class="chip">{MEAL_TYPE_LABEL[data.recipe.mealType]}</span>}
            <span class="chip">{view.items.length} ingrediente{view.items.length === 1 ? '' : 's'}</span>
            {view.servings && <span class="chip">🍽️ rende {view.servings} pratos</span>}
            {!badge && <CostTag cost={view.cost} />}
          </div>
          {view.link && (
            <a class="btn recipe-link" href={view.link} target="_blank" rel="noopener noreferrer">
              📖 Ver modo de preparo <Icon name="right" size={16} />
            </a>
          )}
          {data.recipe?.description && <p>{data.recipe.description}</p>}
          {view.items.length === 0 ? (
            <p class="note-box">Nenhum ingrediente cadastrado. Complete quando o cadastro de receitas chegar (Etapa 3).</p>
          ) : (
            <ul class="ing-list">
              {view.items.map((item, i) => {
                const cat = data.categories.get(item.categoryId);
                const qty = formatQuantity(item.quantity, item.unit);
                return (
                  <li key={i}>
                    <span class="dot" style={{ background: cat?.color }} title={cat?.name} />
                    <span class="ing-name">
                      {item.ingredientName}
                      {item.note && <small> · {item.note}</small>}
                    </span>
                    <span class={qty ? 'ing-qty' : 'ing-qty ing-qty-empty'}>{qty || 'sem quantidade'}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {data.recipe?.notes && <p class="muted">{data.recipe.notes}</p>}
          {actions && <div class="sheet-actions">{actions}</div>}
          {snapshot && <p class="fine">Versão salva quando o prato entrou no cardápio.</p>}
        </div>
      )}
    </Sheet>
  );
}
