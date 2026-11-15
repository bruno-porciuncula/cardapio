import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MesaDB } from './db';
import { ensureDefaults } from './seed';
import { loadExample } from './example';
import { BANK, RECIPE_LINKS, loadBank } from './bank';
import { PORTIONS, applyPortions } from './portions';
import { addDish } from './plan';
import { normalize } from '../lib/text';

let db: MesaDB;
beforeEach(async () => {
  db = new MesaDB(`por-${Math.random()}`);
  await ensureDefaults(db);
  await loadExample(db, '2026-11-09');
  await loadBank(db);
});

const itemsOf = async (id: string) => {
  const r = (await db.recipes.get(id))!;
  const ings = await db.ingredients.bulkGet(r.items.map((i) => i.ingredientId));
  return Object.fromEntries(r.items.map((it, i) => [ings[i]!.name, [it.quantity, it.unit]]));
};

describe('quantidades para 6 pratos', () => {
  it('toda receita do banco tem quantidade em todos os ingredientes, link e rende 6', async () => {
    await applyPortions(db, '2026-11-14');
    for (const b of BANK) {
      const r = (await db.recipes.get(b.id))!;
      expect(r.servings, b.id).toBe(6);
      expect(r.link, b.id).toBe(RECIPE_LINKS[b.id]);
      expect(r.link, b.id).toMatch(/^https:\/\/(www\.)?(panelinha|tudogostoso|receiteria)\.com\.br\//);
      expect(r.items.every((i) => i.quantity != null && i.unit), `${b.id} sem quantidade`).toBe(true);
    }
  });

  it('não muda quantidade que você já tinha informado', async () => {
    await applyPortions(db, '2026-11-14');
    const carne = await itemsOf('ex-carne-panela');
    expect(carne['Carne bovina']).toEqual([350, 'g']); // informado no briefing
    expect(carne['Tomate']).toEqual([4, 'un']); // preenchido agora
    expect((await itemsOf('ex-estrogonofe'))['Batata palha']).toEqual([2, 'pacote']);
  });

  it('semanas a partir da data usam as quantidades novas; semanas passadas ficam como estavam', async () => {
    await addDish(db, '2026-11-15', 'almoco', 'ex-carne-panela');
    await applyPortions(db, '2026-11-14');
    const futuro = (await db.days.get('2026-11-15'))!.slots.almoco!.find((d) => d.recipeId === 'ex-carne-panela')!.snapshot.items;
    expect(futuro.find((i) => i.ingredientName === 'Tomate')?.quantity).toBe(4);
    const passado = (await db.days.get('2026-11-09'))!.slots.almoco![0].snapshot.items; // segunda do exemplo
    expect(passado.find((i) => i.ingredientName === 'Tomate')?.quantity).toBeNull();
  });

  it('roda de novo sem mudar nada', async () => {
    await applyPortions(db, '2026-11-14');
    const again = await applyPortions(db, '2026-11-14');
    expect(again).toEqual({ recipesUpdated: 0, itemsFilled: 0, itemsAdded: 0, dishesRefreshed: 0 });
  });

  it('a tabela só usa unidades que existem', async () => {
    const { UNITS } = await import('../lib/units');
    const ids = new Set(UNITS.map((u) => u.id));
    for (const [rid, table] of Object.entries(PORTIONS)) {
      for (const [name, [, unit]] of Object.entries(table)) expect(ids.has(unit), `${rid} · ${name} · ${unit}`).toBe(true);
    }
    expect(normalize('Ovo')).toBe('ovo');
  });
});
