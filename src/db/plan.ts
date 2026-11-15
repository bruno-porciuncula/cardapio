/**
 * Operações do cardápio. Toda alteração grava na hora (salvamento automático)
 * e atualiza `updatedAt` do dia, para a sincronização saber o que mudou.
 */
import type { MesaDB } from './db';
import type { DayPlan, Dish, Ingredient, Meal, Recipe, RecipeSnapshot } from './types';
import { addDays } from '../lib/dates';
import { uid } from '../lib/text';

export const MEALS: Meal[] = ['almoco', 'jantar'];
export const MEAL_LABEL: Record<Meal, string> = { almoco: 'Almoço', jantar: 'Jantar' };

/** Copia a receita como está agora (o histórico não muda se a receita mudar). */
export function makeSnapshot(recipe: Recipe, ingredients: Map<string, Ingredient>): RecipeSnapshot {
  const snap: RecipeSnapshot = {
    name: recipe.name,
    items: recipe.items.map((item) => {
      const ing = ingredients.get(item.ingredientId);
      return {
        ...item,
        ingredientName: ing?.name ?? '(ingrediente removido)',
        categoryId: ing?.categoryId ?? 'outros',
      };
    }),
  };
  if (recipe.emoji) snap.emoji = recipe.emoji;
  if (recipe.cost) snap.cost = recipe.cost;
  if (recipe.imageId) snap.imageId = recipe.imageId;
  return snap;
}

export function makeDish(recipe: Recipe, ingredients: Map<string, Ingredient>, leftover = false): Dish {
  const dish: Dish = { uid: uid(), recipeId: recipe.id, snapshot: makeSnapshot(recipe, ingredients) };
  if (leftover) dish.leftover = true;
  return dish;
}

export function dishCount(days: Array<DayPlan | undefined>): number {
  return days.reduce((n, d) => n + (d && !d.deleted ? (d.slots.almoco?.length ?? 0) + (d.slots.jantar?.length ?? 0) : 0), 0);
}

/** Quantos dos 14 espaços (7 dias × almoço/jantar) têm pelo menos um prato. */
export function countPlannedSlots(days: Array<DayPlan | undefined>): number {
  return days.reduce((n, d) => n + (d && !d.deleted ? MEALS.filter((m) => d.slots[m]?.length).length : 0), 0);
}

async function ingredientsFor(db: MesaDB, recipe: Recipe) {
  const list = await db.ingredients.bulkGet(recipe.items.map((i) => i.ingredientId));
  return new Map(list.filter((i): i is Ingredient => !!i).map((i) => [i.id, i]));
}

/** Lê/altera/grava um dia numa transação só. */
async function editDay(db: MesaDB, date: string, fn: (day: DayPlan) => void | Promise<void>) {
  await db.transaction('rw', [db.days, db.recipes, db.ingredients], async () => {
    const day: DayPlan = (await db.days.get(date)) ?? { id: date, slots: {}, updatedAt: 0 };
    if (day.deleted) {
      day.slots = {};
      delete day.deleted;
    }
    await fn(day);
    day.updatedAt = Date.now();
    await db.days.put(day);
  });
}

export async function addDish(db: MesaDB, date: string, meal: Meal, recipeId: string, leftover = false) {
  await editDay(db, date, async (day) => {
    const recipe = await db.recipes.get(recipeId);
    if (!recipe || recipe.deleted) throw new Error('Receita não encontrada');
    const dish = makeDish(recipe, await ingredientsFor(db, recipe), leftover);
    day.slots[meal] = [...(day.slots[meal] ?? []), dish];
  });
}

export async function replaceDish(db: MesaDB, date: string, meal: Meal, dishUid: string, recipeId: string) {
  await editDay(db, date, async (day) => {
    const recipe = await db.recipes.get(recipeId);
    if (!recipe || recipe.deleted) throw new Error('Receita não encontrada');
    const fresh = makeDish(recipe, await ingredientsFor(db, recipe));
    day.slots[meal] = (day.slots[meal] ?? []).map((d) => (d.uid === dishUid ? { ...fresh, uid: d.uid } : d));
  });
}

export async function removeDish(db: MesaDB, date: string, meal: Meal, dishUid: string) {
  await editDay(db, date, (day) => {
    const left = (day.slots[meal] ?? []).filter((d) => d.uid !== dishUid);
    if (left.length) day.slots[meal] = left;
    else delete day.slots[meal];
  });
}

export async function setLeftover(db: MesaDB, date: string, meal: Meal, dishUid: string, leftover: boolean) {
  await editDay(db, date, (day) => {
    day.slots[meal] = (day.slots[meal] ?? []).map((d) => {
      if (d.uid !== dishUid) return d;
      const copy = { ...d };
      if (leftover) copy.leftover = true;
      else delete copy.leftover;
      return copy;
    });
  });
}

export interface LeftoverOption {
  dish: Dish;
  from: { date: string; meal: Meal };
}

/**
 * Pratos que podem virar sobra neste espaço: as duas refeições anteriores.
 * Almoço → jantar de ontem (o caso principal) e almoço de ontem.
 * Jantar → almoço de hoje e jantar de ontem.
 */
export async function leftoverOptions(db: MesaDB, date: string, meal: Meal): Promise<LeftoverOption[]> {
  const yesterday = addDays(date, -1);
  const sources: Array<{ date: string; meal: Meal }> = meal === 'almoco'
    ? [{ date: yesterday, meal: 'jantar' }, { date: yesterday, meal: 'almoco' }]
    : [{ date, meal: 'almoco' }, { date: yesterday, meal: 'jantar' }];
  const days = await db.days.bulkGet([...new Set(sources.map((s) => s.date))]);
  const byDate = new Map(days.filter((d): d is DayPlan => !!d && !d.deleted).map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: LeftoverOption[] = [];
  for (const src of sources) {
    for (const dish of byDate.get(src.date)?.slots[src.meal] ?? []) {
      if (seen.has(dish.recipeId)) continue;
      seen.add(dish.recipeId);
      out.push({ dish, from: src });
    }
  }
  return out;
}

export type ToggleResult = 'added' | 'added-leftover' | 'removed';

/**
 * Catálogo → semana: põe a receita no espaço, ou tira se já estiver lá.
 * Se a mesma receita estiver numa das duas refeições anteriores, entra como
 * sobra (padrão "quinta e sexta – estrogonofe": cozinha na quinta, sobra na sexta).
 */
export async function toggleRecipeInSlot(db: MesaDB, date: string, meal: Meal, recipeId: string): Promise<ToggleResult> {
  const day = await db.days.get(date);
  const existing = day && !day.deleted ? day.slots[meal]?.find((d) => d.recipeId === recipeId) : undefined;
  if (existing) {
    await removeDish(db, date, meal, existing.uid);
    return 'removed';
  }
  const leftover = (await leftoverOptions(db, date, meal)).some((o) => o.dish.recipeId === recipeId);
  await addDish(db, date, meal, recipeId, leftover);
  return leftover ? 'added-leftover' : 'added';
}
