import Dexie, { type EntityTable } from 'dexie';
import type {
  Category, Ingredient, Recipe, WeekPlan, Staple, PantryItem, ImageBlob, Meta,
} from './types';

/**
 * Banco local (IndexedDB). Cada mudança de esquema vira uma nova
 * `this.version(n)` com migração — nunca alterar uma versão já publicada,
 * para preservar os dados cadastrados.
 */
export class MesaDB extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  ingredients!: EntityTable<Ingredient, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  weeks!: EntityTable<WeekPlan, 'id'>;
  staples!: EntityTable<Staple, 'id'>;
  pantry!: EntityTable<PantryItem, 'id'>;
  images!: EntityTable<ImageBlob, 'id'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name = 'mesa') {
    super(name);
    this.version(1).stores({
      categories: 'id, order, updatedAt',
      ingredients: 'id, name, *aliases, categoryId, updatedAt',
      recipes: 'id, name, mealType, updatedAt',
      weeks: 'id, updatedAt',
      staples: 'id, updatedAt',
      pantry: 'id, ingredientId, updatedAt',
      images: 'id, updatedAt',
      meta: 'key',
      // listas de compras entram na Etapa 5, como nova versão do esquema
    });
  }
}

export const db = new MesaDB();

/** Registros vivos (sem marca de exclusão). */
export function alive<T extends { deleted?: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted);
}

/** Pede ao navegador para não apagar os dados sob pressão de espaço. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
