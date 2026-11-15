import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { MesaDB } from './db';
import { ensureDefaults, DEFAULT_CATEGORIES } from './seed';
import { loadExample } from './example';
import { countDishes } from './weeks';

let db: MesaDB;
beforeEach(async () => {
  db = new MesaDB(`test-${Math.random()}`);
  await ensureDefaults(db);
});

describe('categorias padrão', () => {
  it('cria as 9 categorias uma única vez', async () => {
    await ensureDefaults(db);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it('não sobrescreve uma categoria editada', async () => {
    await db.categories.update('outros', { name: 'Diversos', updatedAt: 5 });
    await ensureDefaults(db);
    expect((await db.categories.get('outros'))?.name).toBe('Diversos');
  });
});

describe('cardápio de exemplo', () => {
  const week = '2026-11-09';

  it('carrega receitas, ingredientes e os 7 almoços', async () => {
    const r = await loadExample(db, week);
    expect(r).toMatchObject({ recipesAdded: 8, ingredientsAdded: 24, slotsFilled: 7 });
    const plan = await db.weeks.get(week);
    expect(countDishes(plan)).toBe(10); // sexta, sábado e domingo têm 2 pratos
    expect(plan?.slots['4-almoco']?.map((d) => d.snapshot.name)).toEqual(['Estrogonofe', 'Wrap']);
    expect(plan?.slots['0-jantar']).toBeUndefined();
  });

  it('não inventa quantidades', async () => {
    await loadExample(db, week);
    const carne = await db.recipes.get('ex-carne-panela');
    expect(carne?.items[0]).toMatchObject({ quantity: 350, unit: 'g', note: 'em cubos' });
    expect(carne?.items[1]).toMatchObject({ quantity: null, unit: null });
  });

  it('é idempotente e não sobrescreve almoços preenchidos', async () => {
    await loadExample(db, week);
    const again = await loadExample(db, week);
    expect(again).toMatchObject({ recipesAdded: 0, ingredientsAdded: 0, slotsFilled: 0, slotsSkipped: 7 });
    expect(await db.recipes.count()).toBe(8);
  });

  it('snapshot congela a receita: editar a biblioteca não muda a semana', async () => {
    await loadExample(db, week);
    const recipe = (await db.recipes.get('ex-estrogonofe'))!;
    recipe.items[0].quantity = 600;
    await db.recipes.put(recipe);
    const plan = await db.weeks.get(week);
    expect(plan?.slots['3-almoco']?.[0].snapshot.items[0].quantity).toBe(500);
  });
});
