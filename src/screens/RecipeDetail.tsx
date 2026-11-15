import { Sheet } from '../ui/Sheet';
import { Thumb } from '../ui/Thumb';
import { db } from '../db/db';
import type { Category, RecipeSnapshot } from '../db/types';
import { useLive } from '../lib/hooks';
import { formatQuantity } from '../lib/units';

const MEAL_TYPE_LABEL = { almoco: 'Almoço', jantar: 'Jantar', ambos: 'Almoço e jantar' };

/**
 * Detalhes de uma receita. Recebe um snapshot (versão congelada do cardápio)
 * ou o id de uma receita da biblioteca.
 */
export function RecipeDetail({ recipeId, snapshot, onClose }: {
  recipeId?: string;
  snapshot?: RecipeSnapshot;
  onClose: () => void;
}) {
  const data = useLive(async () => {
    const categories = new Map<string, Category>((await db.categories.toArray()).map((c) => [c.id, c]));
    if (snapshot) return { categories, recipe: null, view: snapshot };
    const recipe = recipeId ? await db.recipes.get(recipeId) : undefined;
    if (!recipe) return { categories, recipe: null, view: null };
    const ings = await db.ingredients.bulkGet(recipe.items.map((i) => i.ingredientId));
    const view: RecipeSnapshot = {
      name: recipe.name,
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
          <div class="recipe-detail-hero">
            <Thumb name={view.name} imageId={view.imageId} size="lg" />
            <div>
              {data.recipe && <span class="chip">{MEAL_TYPE_LABEL[data.recipe.mealType]}</span>}
              <p class="muted">{view.items.length} ingrediente{view.items.length === 1 ? '' : 's'}</p>
              {data.recipe?.description && <p>{data.recipe.description}</p>}
            </div>
          </div>
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
          {data.recipe?.notes && <p class="muted">{data.recipe.notes}</p>}
          {snapshot && (
            <p class="fine">Versão salva quando o prato entrou no cardápio.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
