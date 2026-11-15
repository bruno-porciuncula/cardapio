import Dexie, { type EntityTable, type Transaction } from 'dexie';
import type {
  Category, Ingredient, Recipe, DayPlan, WeekData, Staple, PantryItem, ImageBlob, Meta, Dish, Meal,
} from './types';
import { addDays } from '../lib/dates';

/**
 * Banco local (IndexedDB). Cada mudança de esquema vira uma nova
 * `this.version(n)` com migração — nunca alterar uma versão já publicada,
 * para preservar os dados cadastrados.
 */
export class MesaDB extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  ingredients!: EntityTable<Ingredient, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  days!: EntityTable<DayPlan, 'id'>;
  weeks!: EntityTable<WeekData, 'id'>;
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
    });
    // v2: pratos passam a ser guardados por data (tabela days); a semana fica só com os extras.
    this.version(2)
      .stores({ days: 'id, updatedAt' })
      .upgrade(migrateWeeksToDays);
  }
}

/** v1 → v2: "2026-11-09" + slot "4-almoco" vira o dia "2026-11-13", almoço. */
export async function migrateWeeksToDays(tx: Transaction): Promise<void> {
  const now = Date.now();
  const weeks = tx.table('weeks');
  const days = tx.table('days');
  const old = (await weeks.toArray()) as Array<{ id: string; slots?: Record<string, Dish[]>; deleted?: boolean }>;
  for (const week of old) {
    const byDate = new Map<string, DayPlan>();
    for (const [key, dishes] of Object.entries(week.slots ?? {})) {
      const [dayIdx, meal] = key.split('-') as [string, Meal];
      if (!dishes?.length || week.deleted) continue;
      const date = addDays(week.id, Number(dayIdx));
      const day = byDate.get(date) ?? { id: date, slots: {}, updatedAt: now };
      day.slots[meal] = dishes;
      byDate.set(date, day);
    }
    if (byDate.size) await days.bulkPut([...byDate.values()]);
    await weeks.put({ id: week.id, extras: [], updatedAt: now, ...(week.deleted ? { deleted: true } : {}) });
  }
}

export const db = new MesaDB();

/** Pede ao navegador para não apagar os dados sob pressão de espaço. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

/* ───────── Preferências (por enquanto, por aparelho) ───────── */

/** Dia em que a semana começa, no padrão do JS: 0 = domingo, 1 = segunda … 6 = sábado. */
export async function getWeekStart(d: MesaDB = db): Promise<number> {
  const row = await d.meta.get('weekStart');
  return typeof row?.value === 'number' ? row.value : 1;
}

export async function setWeekStart(dow: number, d: MesaDB = db, updatedAt = Date.now()): Promise<void> {
  await d.meta.bulkPut([
    { key: 'weekStart', value: dow },
    { key: 'weekStart:updatedAt', value: updatedAt },
  ]);
}
