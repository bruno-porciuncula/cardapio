/**
 * Cardápio de exemplo do briefing (seção 13), gravado no banco real.
 *
 * - Quantidades só onde o briefing informou; o resto fica sem quantidade.
 * - "em cubos" é preparo: vai na observação, e o ingrediente é "Carne bovina",
 *   para somar 350 g + 500 g na lista.
 * - "Estrogonofe + wrap" vira dois pratos no mesmo almoço.
 * - Ids fixos "ex-…": carregar no Mac e no Android não duplica nada.
 */
import type { MesaDB } from './db';
import type { DayPlan, Ingredient, Recipe, RecipeItem, Staple } from './types';
import { makeDish } from './plan';
import { addDays } from '../lib/dates';

type IngDef = [id: string, name: string, categoryId: string, aliases?: string[]];

const INGREDIENTS: IngDef[] = [
  ['carne-bovina', 'Carne bovina', 'acougue'],
  ['carne-moida', 'Carne moída', 'acougue'],
  ['tomate', 'Tomate', 'hortifruti'],
  ['tomate-cereja', 'Tomate cereja', 'hortifruti', ['Tomatinho']],
  ['cebola', 'Cebola', 'hortifruti'],
  ['abobrinha', 'Abobrinha', 'hortifruti'],
  ['berinjela', 'Berinjela', 'hortifruti'],
  ['cenoura', 'Cenoura', 'hortifruti'],
  ['beterraba', 'Beterraba', 'hortifruti'],
  ['cebolinha', 'Cebolinha', 'hortifruti'],
  ['brocolis', 'Brócolis', 'hortifruti'],
  ['mucarela', 'Queijo muçarela', 'frios', ['Muçarela', 'Mussarela', 'Queijo mussarela']],
  ['gorgonzola', 'Queijo gorgonzola', 'frios', ['Gorgonzola']],
  ['queijo-ralado', 'Queijo ralado', 'frios', ['Parmesão ralado']],
  ['creme-de-leite', 'Creme de leite', 'frios'],
  ['peito-de-peru', 'Peito de peru', 'frios'],
  ['molho-tomate', 'Molho de tomate', 'mercearia'],
  ['macarrao', 'Macarrão', 'mercearia', ['Massa']],
  ['batata-palha', 'Batata palha', 'mercearia'],
  ['wrap', 'Massa para wrap', 'mercearia', ['Wrap', 'Tortilha']],
  ['arroz-risoto', 'Arroz para risoto', 'mercearia', ['Arroz arbóreo', 'Arroz de risoto']],
  ['caldo-legumes', 'Caldo de legumes', 'mercearia'],
  ['pao-hamburguer', 'Pão de hambúrguer', 'mercearia'],
  ['pao-forma-frances', 'Pão de forma ou francês', 'mercearia'],
];

type ItemDef = [ingredient: string, quantity?: number, unit?: string, note?: string];
type RecipeDef = [id: string, name: string, items: ItemDef[]];

const RECIPES: RecipeDef[] = [
  ['carne-panela', 'Carne de panela + ratatouille fake', [
    ['carne-bovina', 350, 'g', 'em cubos'], ['tomate'], ['cebola'], ['abobrinha'],
  ]],
  ['berinjela-forno', 'Berinjela no forno + cenoura e beterraba cozidas', [
    ['berinjela', 2, 'un'], ['mucarela'], ['molho-tomate'], ['cenoura'], ['beterraba'],
  ]],
  ['macarrao-oriental', 'Macarrão oriental', [
    ['cebolinha'], ['cenoura'], ['brocolis'], ['cebola'], ['macarrao'],
  ]],
  ['estrogonofe', 'Estrogonofe', [
    ['carne-bovina', 500, 'g'], ['creme-de-leite'], ['batata-palha', 2, 'pacote'],
  ]],
  ['wrap', 'Wrap', [['wrap'], ['mucarela'], ['molho-tomate']]],
  ['risoto-gorgonzola', 'Risoto de gorgonzola com tomates cereja', [
    ['arroz-risoto'], ['gorgonzola'], ['queijo-ralado', 1, 'pacote'], ['caldo-legumes'], ['tomate-cereja'],
  ]],
  ['hamburguer', 'Hambúrguer artesanal', [['carne-moida'], ['pao-hamburguer']]],
  ['misto-quente', 'Misto quente', [['pao-forma-frances'], ['mucarela'], ['peito-de-peru']]],
];

/** Almoços dos 7 dias, a partir do primeiro dia informado. */
const LUNCHES: string[][] = [
  ['carne-panela'],
  ['berinjela-forno'],
  ['macarrao-oriental'],
  ['estrogonofe'],
  ['estrogonofe', 'wrap'],
  ['risoto-gorgonzola', 'hamburguer'],
  ['risoto-gorgonzola', 'misto-quente'],
];

const STAPLES: Array<[id: string, name: string, categoryId: string, quantity?: number, unit?: string]> = [
  ['leite', 'Leite', 'frios', 3, 'caixa'],
  ['frutas-vermelhas', 'Morango ou frutas vermelhas congeladas', 'congelados'],
  ['iogurte', 'Iogurte natural', 'frios'],
  ['leite-em-po', 'Leite em pó', 'mercearia'],
  ['salsa', 'Salsa desidratada', 'mercearia'],
];

const ex = (id: string) => `ex-${id}`;

function buildIngredients(now: number): Ingredient[] {
  return INGREDIENTS.map(([id, name, categoryId, aliases]) => ({
    id: ex(id), name, categoryId, aliases: aliases ?? [], updatedAt: now,
  }));
}

function buildRecipes(now: number): Recipe[] {
  return RECIPES.map(([id, name, items]) => ({
    id: ex(id),
    name,
    mealType: 'ambos',
    updatedAt: now,
    items: items.map(([ing, quantity, unit, note]): RecipeItem => {
      const item: RecipeItem = { ingredientId: ex(ing), quantity: quantity ?? null, unit: unit ?? null };
      if (note) item.note = note;
      return item;
    }),
  }));
}

export interface ExampleResult {
  recipesAdded: number;
  ingredientsAdded: number;
  slotsFilled: number;
  slotsSkipped: number;
}

/**
 * Carrega o exemplo na semana `weekId`. Não sobrescreve nada: receitas e
 * ingredientes que já existem ficam como estão, e almoços já preenchidos
 * são mantidos.
 */
export async function loadExample(db: MesaDB, startDate: string): Promise<ExampleResult> {
  const now = Date.now();
  return db.transaction('rw', [db.ingredients, db.recipes, db.days, db.staples], async () => {
    const result: ExampleResult = { recipesAdded: 0, ingredientsAdded: 0, slotsFilled: 0, slotsSkipped: 0 };

    const ingIds = new Set((await db.ingredients.toArray()).map((i) => i.id));
    const newIngs = buildIngredients(now).filter((i) => !ingIds.has(i.id));
    await db.ingredients.bulkAdd(newIngs);
    result.ingredientsAdded = newIngs.length;

    const recIds = new Set((await db.recipes.toArray()).map((r) => r.id));
    const newRecs = buildRecipes(now).filter((r) => !recIds.has(r.id));
    await db.recipes.bulkAdd(newRecs);
    result.recipesAdded = newRecs.length;

    const stapleIds = new Set((await db.staples.toArray()).map((s) => s.id));
    const staples: Staple[] = STAPLES
      .filter(([id]) => !stapleIds.has(ex(id)))
      .map(([id, name, categoryId, quantity, unit]) => ({
        id: ex(id), name, categoryId, quantity: quantity ?? null, unit: unit ?? null, updatedAt: now,
      }));
    await db.staples.bulkAdd(staples);

    const ingredients = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
    const recipes = new Map((await db.recipes.toArray()).map((r) => [r.id, r]));

    for (const [i, ids] of LUNCHES.entries()) {
      const date = addDays(startDate, i);
      const day: DayPlan = (await db.days.get(date)) ?? { id: date, slots: {}, updatedAt: now };
      if (!day.deleted && day.slots.almoco?.length) {
        result.slotsSkipped++;
        continue;
      }
      const dishes = ids
        .map((id) => recipes.get(ex(id)))
        .filter((r): r is Recipe => !!r && !r.deleted)
        .map((r) => makeDish(r, ingredients));
      if (!dishes.length) continue;
      if (day.deleted) {
        day.slots = {};
        delete day.deleted;
      }
      day.slots.almoco = dishes;
      day.updatedAt = now;
      await db.days.put(day);
      result.slotsFilled++;
    }
    return result;
  });
}
