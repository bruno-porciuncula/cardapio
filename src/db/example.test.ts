import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it, beforeEach } from 'vitest';
import { MesaDB, getWeekStart, setWeekStart } from './db';
import { ensureDefaults, DEFAULT_CATEGORIES } from './seed';
import { loadExample } from './example';
import { addDish, countPlannedSlots, dishCount, leftoverOptions, removeDish, replaceDish, setLeftover, toggleRecipeInSlot } from './plan';

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
  const start = '2026-11-09';

  it('carrega receitas, ingredientes e os 7 almoços', async () => {
    const r = await loadExample(db, start);
    expect(r).toMatchObject({ recipesAdded: 8, ingredientsAdded: 24, slotsFilled: 7 });
    const days = await db.days.toArray();
    expect(dishCount(days)).toBe(10);
    const sexta = await db.days.get('2026-11-13');
    expect(sexta?.slots.almoco?.map((d) => d.snapshot.name)).toEqual(['Estrogonofe', 'Wrap']);
    expect(sexta?.slots.jantar).toBeUndefined();
  });

  it('não inventa quantidades', async () => {
    await loadExample(db, start);
    const carne = await db.recipes.get('ex-carne-panela');
    expect(carne?.items[0]).toMatchObject({ quantity: 350, unit: 'g', note: 'em cubos' });
    expect(carne?.items[1]).toMatchObject({ quantity: null, unit: null });
  });

  it('é idempotente e não sobrescreve almoços preenchidos', async () => {
    await loadExample(db, start);
    const again = await loadExample(db, start);
    expect(again).toMatchObject({ recipesAdded: 0, ingredientsAdded: 0, slotsFilled: 0, slotsSkipped: 7 });
    expect(await db.recipes.count()).toBe(8);
  });

  it('snapshot congela a receita: editar a biblioteca não muda o cardápio', async () => {
    await loadExample(db, start);
    const recipe = (await db.recipes.get('ex-estrogonofe'))!;
    recipe.items[0].quantity = 600;
    await db.recipes.put(recipe);
    const quinta = await db.days.get('2026-11-12');
    expect(quinta?.slots.almoco?.[0].snapshot.items[0].quantity).toBe(500);
  });
});

describe('operações do cardápio', () => {
  beforeEach(() => loadExample(db, '2026-11-09'));

  it('adiciona, troca, marca sobra e remove', async () => {
    const date = '2026-11-14';
    await addDish(db, date, 'jantar', 'ex-estrogonofe');
    let day = await db.days.get(date);
    const uid = day!.slots.jantar![0].uid;
    expect(day!.slots.jantar![0].snapshot.name).toBe('Estrogonofe');

    await replaceDish(db, date, 'jantar', uid, 'ex-wrap');
    day = await db.days.get(date);
    expect(day!.slots.jantar![0]).toMatchObject({ uid, recipeId: 'ex-wrap' });

    await setLeftover(db, date, 'jantar', uid, true);
    expect((await db.days.get(date))!.slots.jantar![0].leftover).toBe(true);
    await setLeftover(db, date, 'jantar', uid, false);
    expect((await db.days.get(date))!.slots.jantar![0].leftover).toBeUndefined();

    await removeDish(db, date, 'jantar', uid);
    expect((await db.days.get(date))!.slots.jantar).toBeUndefined();
  });

  it('sugere como sobra o jantar de ontem e o almoço de ontem', async () => {
    await addDish(db, '2026-11-11', 'jantar', 'ex-hamburguer');
    const opts = await leftoverOptions(db, '2026-11-12', 'almoco');
    expect(opts.map((o) => [o.dish.recipeId, o.from.meal])).toEqual([
      ['ex-hamburguer', 'jantar'],
      ['ex-macarrao-oriental', 'almoco'],
    ]);
  });
});

describe('montar semana pelo catálogo', () => {
  beforeEach(() => loadExample(db, '2026-11-09'));

  it('marca e desmarca a receita num espaço', async () => {
    expect(await toggleRecipeInSlot(db, '2026-11-18', 'jantar', 'ex-hamburguer')).toBe('added');
    expect((await db.days.get('2026-11-18'))!.slots.jantar!.map((d) => d.recipeId)).toEqual(['ex-hamburguer']);
    expect(await toggleRecipeInSlot(db, '2026-11-18', 'jantar', 'ex-hamburguer')).toBe('removed');
    expect((await db.days.get('2026-11-18'))!.slots.jantar).toBeUndefined();
  });

  it('"quinta e sexta – estrogonofe": o segundo dia entra como sobra', async () => {
    expect(await toggleRecipeInSlot(db, '2026-11-19', 'almoco', 'ex-estrogonofe')).toBe('added');
    expect(await toggleRecipeInSlot(db, '2026-11-20', 'almoco', 'ex-estrogonofe')).toBe('added-leftover');
    expect((await db.days.get('2026-11-20'))!.slots.almoco![0].leftover).toBe(true);
  });

  it('jantar de ontem vira sobra no almoço de hoje', async () => {
    await toggleRecipeInSlot(db, '2026-11-18', 'jantar', 'ex-wrap');
    expect(await toggleRecipeInSlot(db, '2026-11-19', 'almoco', 'ex-wrap')).toBe('added-leftover');
  });

  it('conta os espaços preenchidos', async () => {
    const days = await db.days.bulkGet(['2026-11-09', '2026-11-10']);
    expect(countPlannedSlots(days)).toBe(2);
  });
});

describe('preferências', () => {
  it('semana começa na segunda por padrão e pode mudar', async () => {
    expect(await getWeekStart(db)).toBe(1);
    await setWeekStart(6, db);
    expect(await getWeekStart(db)).toBe(6);
  });
});

describe('migração v1 → v2', () => {
  it('converte pratos guardados por semana em pratos por data, sem perder nada', async () => {
    const name = `mig-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      categories: 'id, order, updatedAt', ingredients: 'id, name, *aliases, categoryId, updatedAt',
      recipes: 'id, name, mealType, updatedAt', weeks: 'id, updatedAt', staples: 'id, updatedAt',
      pantry: 'id, ingredientId, updatedAt', images: 'id, updatedAt', meta: 'key',
    });
    const dish = { uid: 'u1', recipeId: 'r1', snapshot: { name: 'Estrogonofe', items: [] } };
    await v1.table('weeks').put({ id: '2026-11-09', updatedAt: 1, slots: { '4-almoco': [dish], '6-jantar': [dish] } });
    v1.close();

    const v2 = new MesaDB(name);
    expect(await v2.days.get('2026-11-13')).toMatchObject({ slots: { almoco: [dish] } });
    expect(await v2.days.get('2026-11-15')).toMatchObject({ slots: { jantar: [dish] } });
    expect(await v2.weeks.get('2026-11-09')).toMatchObject({ extras: [] });
  });
});
