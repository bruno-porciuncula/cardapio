/**
 * Criar, editar e excluir receitas.
 *
 * Os ingredientes são digitados pelo nome. Ao salvar, cada nome é ligado a um
 * ingrediente que já existe (pelo nome padronizado ou por um nome alternativo,
 * ignorando acentos e maiúsculas). Só quando não há nenhum igual é que um
 * ingrediente novo é criado — nunca juntamos nomes "parecidos" sozinhos.
 */
import type { MesaDB } from './db';
import type { Cost, Ingredient, MealType, Recipe, RecipeItem } from './types';
import { normalize, uid } from '../lib/text';

export const COST_INFO: Record<Cost, { label: string; short: string; hint: string }> = {
  baixo: { label: 'Econômica', short: '$', hint: 'mais vegetais, ovos, massas simples' },
  medio: { label: 'Média', short: '$$', hint: 'frango, carne moída, queijos' },
  alto: { label: 'Mais cara', short: '$$$', hint: 'carne bovina em pedaço, peixe, queijos especiais, pedir comida' },
};

export interface DraftItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  note?: string;
  /** Categoria usada só se o ingrediente for novo. */
  categoryId?: string;
}

export interface RecipeDraft {
  id?: string;
  name: string;
  emoji?: string;
  mealType: MealType;
  cost?: Cost;
  servings?: number;
  link?: string;
  notes?: string;
  /** null remove a foto e passa a usar o emoji. */
  imageId?: string | null;
  items: DraftItem[];
}

/** Índice nome/apelido normalizado → ingrediente. */
export async function ingredientIndex(db: MesaDB): Promise<Map<string, Ingredient>> {
  const map = new Map<string, Ingredient>();
  for (const ing of await db.ingredients.toArray()) {
    if (ing.deleted) continue;
    map.set(normalize(ing.name), ing);
    for (const a of ing.aliases) if (!map.has(normalize(a))) map.set(normalize(a), ing);
  }
  return map;
}

/** Categoria provável para um ingrediente novo (você pode trocar no formulário). */
export function guessCategory(name: string): string {
  const n = normalize(name);
  // \b no fim das palavras curtas evita, por exemplo, "maca" casar dentro de "macarrao".
  const rules: Array<[RegExp, string]> = [
    [/\b(batata palha|molho|caldo|farinha|extrato|massa|macarrao)/, 'mercearia'],
    [/\b(carne|frango|bife|patinho|alcatra|costela|linguica|peixe|tilapia|salmao|camarao|sobrecoxa|file)/, 'acougue'],
    [/\b(queijo|mucarela|mussarela|presunto|peito de peru|iogurte|requeijao|creme de leite|manteiga|leite\b|salsicha|ricota)/, 'frios'],
    [/\b(congelad|sorvete|polpa)/, 'congelados'],
    [/\b(agua\b|suco|refrigerante|coca\b|cerveja|vinho|cha\b)/, 'bebidas'],
    [/\b(detergente|sabao|amaciante|desinfetante|esponja|agua sanitaria)/, 'limpeza'],
    [/\b(sabonete|shampoo|pasta de dente|papel higienico|desodorante)/, 'higiene'],
    [/\b(tomate|cebola|alho\b|batata\b|cenoura|abobrinha|berinjela|alface|rucula|brocolis|couve\b|repolho|pimentao|pepino|banana|maca\b|limao|laranja|morango|mandioca|aipim|abobora|cheiro|salsinha|cebolinha|manjericao|beterraba|chuchu|vagem|espinafre|ovos?\b)/, 'hortifruti'],
  ];
  for (const [re, cat] of rules) if (re.test(n)) return cat;
  return 'mercearia';
}

export async function saveRecipe(db: MesaDB, draft: RecipeDraft): Promise<string> {
  const name = draft.name.trim();
  if (!name) throw new Error('Dê um nome para a receita.');
  const now = Date.now();
  const id = draft.id ?? `r-${uid()}`;

  await db.transaction('rw', [db.recipes, db.ingredients], async () => {
    const index = await ingredientIndex(db);
    const items: RecipeItem[] = [];
    for (const d of draft.items) {
      const label = d.name.trim();
      if (!label) continue;
      let ing = index.get(normalize(label));
      if (!ing) {
        ing = { id: `i-${uid()}`, name: label, aliases: [], categoryId: d.categoryId ?? guessCategory(label), updatedAt: now };
        await db.ingredients.add(ing);
        index.set(normalize(label), ing);
      }
      const hasQty = d.quantity != null && Number.isFinite(d.quantity) && d.quantity > 0;
      const item: RecipeItem = { ingredientId: ing.id, quantity: hasQty ? d.quantity : null, unit: hasQty ? d.unit ?? 'un' : null };
      if (d.note?.trim()) item.note = d.note.trim();
      items.push(item);
    }

    const prev = draft.id ? await db.recipes.get(draft.id) : undefined;
    const recipe: Recipe = {
      ...(prev ?? {}),
      id,
      name,
      mealType: draft.mealType,
      items,
      updatedAt: now,
    } as Recipe;
    delete recipe.deleted;
    if (draft.emoji) recipe.emoji = draft.emoji; else delete recipe.emoji;
    if (draft.cost) recipe.cost = draft.cost; else delete recipe.cost;
    if (draft.notes?.trim()) recipe.notes = draft.notes.trim(); else delete recipe.notes;
    recipe.servings = draft.servings && draft.servings > 0 ? draft.servings : 6;
    const link = draft.link?.trim();
    if (link) recipe.link = /^https?:\/\//.test(link) ? link : `https://${link}`; else delete recipe.link;
    if (draft.imageId === null) delete recipe.imageId;
    else if (draft.imageId) recipe.imageId = draft.imageId;
    await db.recipes.put(recipe);
  });
  return id;
}

/** Exclusão "macia": some da biblioteca e dos outros aparelhos; cardápios já montados não mudam. */
export async function deleteRecipe(db: MesaDB, id: string) {
  const r = await db.recipes.get(id);
  if (r) await db.recipes.put({ ...r, deleted: true, updatedAt: Date.now() });
}

/** Rascunho a partir de uma receita existente, para o formulário. */
export async function draftFromRecipe(db: MesaDB, id: string): Promise<RecipeDraft | null> {
  const r = await db.recipes.get(id);
  if (!r || r.deleted) return null;
  const ings = await db.ingredients.bulkGet(r.items.map((i) => i.ingredientId));
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    mealType: r.mealType,
    cost: r.cost,
    servings: r.servings,
    link: r.link,
    notes: r.notes,
    imageId: r.imageId,
    items: r.items.map((it, i) => ({
      name: ings[i]?.name ?? '',
      quantity: it.quantity,
      unit: it.unit,
      note: it.note,
      categoryId: ings[i]?.categoryId,
    })),
  };
}
