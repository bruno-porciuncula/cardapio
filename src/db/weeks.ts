import type { Dish, Ingredient, Meal, Recipe, RecipeSnapshot, SlotKey, WeekPlan } from './types';
import { uid } from '../lib/text';

export const MEALS: Meal[] = ['almoco', 'jantar'];
export const MEAL_LABEL: Record<Meal, string> = { almoco: 'Almoço', jantar: 'Jantar' };

export function slotKey(day: number, meal: Meal): SlotKey {
  return `${day}-${meal}`;
}

/** Copia a receita como está agora (o histórico não muda se a receita mudar). */
export function makeSnapshot(recipe: Recipe, ingredients: Map<string, Ingredient>): RecipeSnapshot {
  return {
    name: recipe.name,
    imageId: recipe.imageId,
    items: recipe.items.map((item) => {
      const ing = ingredients.get(item.ingredientId);
      return {
        ...item,
        ingredientName: ing?.name ?? '(ingrediente removido)',
        categoryId: ing?.categoryId ?? 'outros',
      };
    }),
  };
}

export function makeDish(recipe: Recipe, ingredients: Map<string, Ingredient>, leftover = false): Dish {
  const dish: Dish = { uid: uid(), recipeId: recipe.id, snapshot: makeSnapshot(recipe, ingredients) };
  if (leftover) dish.leftover = true;
  return dish;
}

export function emptyWeek(id: string): WeekPlan {
  return { id, slots: {}, updatedAt: Date.now() };
}

export function countDishes(week: WeekPlan | undefined): number {
  if (!week) return 0;
  return Object.values(week.slots).reduce((n, dishes) => n + (dishes?.length ?? 0), 0);
}
