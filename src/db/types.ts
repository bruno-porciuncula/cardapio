/**
 * Modelo de dados do app.
 *
 * Todo registro sincronizável carrega `id`, `updatedAt` (ms) e `deleted`
 * (marca de exclusão). Assim a sincronização com o Drive pode mesclar Mac
 * e Android registro a registro, sem migrar dados.
 */

export interface SyncFields {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export type MealType = 'almoco' | 'jantar' | 'ambos';
export type Meal = 'almoco' | 'jantar';

export interface Category extends SyncFields {
  name: string;
  /** Ordem na lista = percurso no supermercado. */
  order: number;
  color: string;
}

export interface Ingredient extends SyncFields {
  /** Nome padronizado. */
  name: string;
  /** Nomes alternativos (Muçarela, Mussarela…). */
  aliases: string[];
  categoryId: string;
  defaultUnit?: string;
  notes?: string;
}

export interface RecipeItem {
  ingredientId: string;
  /** null = sem quantidade definida (nunca inventamos uma). */
  quantity: number | null;
  /** id de unidade de lib/units.ts; null quando não há quantidade. */
  unit: string | null;
  /** Preparo/observação: "em cubos", "penne ou parafuso"… */
  note?: string;
}

export interface Recipe extends SyncFields {
  name: string;
  /** Ícone do prato; quando vazio, é deduzido do nome. */
  emoji?: string;
  description?: string;
  imageId?: string;
  mealType: MealType;
  notes?: string;
  items: RecipeItem[];
}

/** Cópia congelada da receita no momento em que entrou no cardápio. */
export interface RecipeSnapshot {
  name: string;
  emoji?: string;
  imageId?: string;
  items: Array<RecipeItem & { ingredientName: string; categoryId: string }>;
}

export interface Dish {
  /** id local do prato. */
  uid: string;
  recipeId: string;
  snapshot: RecipeSnapshot;
  /** Sobra de uma refeição anterior: aparece no cardápio, mas não entra na lista. */
  leftover?: boolean;
}

/**
 * Um dia do cardápio, identificado pela data ("2026-11-14").
 * Guardar por data (e não por "dia 0-6 da semana") permite mudar o dia em
 * que a semana começa sem mexer em nenhum prato.
 */
export interface DayPlan extends SyncFields {
  slots: Partial<Record<Meal, Dish[]>>;
}

/** Item avulso da lista da semana (não vem de receita). */
export interface ExtraItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  categoryId: string;
  note?: string;
}

/** Dados da semana; id = data do primeiro dia da semana. */
export interface WeekData extends SyncFields {
  extras: ExtraItem[];
}

/** Itens de sempre (extras recorrentes). */
export interface Staple extends SyncFields {
  name: string;
  ingredientId?: string;
  quantity: number | null;
  unit: string | null;
  categoryId: string;
  note?: string;
}

/** Despensa (Etapa 8) — tabela já existe para não exigir migração. */
export interface PantryItem extends SyncFields {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface ImageBlob extends SyncFields {
  blob: Blob;
}

export interface Meta {
  key: string;
  value: unknown;
}
