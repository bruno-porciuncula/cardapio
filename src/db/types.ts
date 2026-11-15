/**
 * Modelo de dados do app.
 *
 * Todo registro sincronizável carrega `id` (uuid), `updatedAt` (ms) e
 * `deleted` (marca de exclusão). Assim a Etapa 3B (sync com o Drive) pode
 * mesclar Mac e Android registro a registro, sem migrar dados.
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
  /** Cor suave usada como marcador (hex). */
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
  /** Preparo/observação: "em cubos", "maduro"… */
  note?: string;
}

export interface Recipe extends SyncFields {
  name: string;
  description?: string;
  imageId?: string;
  mealType: MealType;
  notes?: string;
  items: RecipeItem[];
}

/** Cópia congelada da receita no momento em que entrou no cardápio. */
export interface RecipeSnapshot {
  name: string;
  imageId?: string;
  items: Array<RecipeItem & { ingredientName: string; categoryId: string }>;
}

export interface Dish {
  /** id local do prato dentro da semana. */
  uid: string;
  recipeId: string;
  snapshot: RecipeSnapshot;
  /** Sobra do jantar do dia anterior: não entra na lista de compras. */
  leftover?: boolean;
}

/** Chave do espaço: `${dia 0-6}-${refeição}`, ex.: "0-almoco" (segunda). */
export type SlotKey = `${number}-${Meal}`;

export interface WeekPlan extends SyncFields {
  /** id = data da segunda-feira, "2026-11-09". */
  slots: Partial<Record<SlotKey, Dish[]>>;
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
