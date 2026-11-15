import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MesaDB } from './db';
import { ensureDefaults } from './seed';
import { loadExample } from './example';
import { BANK, bankPending, loadBank } from './bank';
import { deleteRecipe, draftFromRecipe, guessCategory, saveRecipe } from './recipes';
import { addDish } from './plan';

let db: MesaDB;
beforeEach(async () => {
  db = new MesaDB(`rec-${Math.random()}`);
  await ensureDefaults(db);
  await loadExample(db, '2026-11-09');
});

describe('criar e editar receita', () => {
  it('liga ingredientes existentes pelo nome ou apelido e cria só os novos', async () => {
    const before = await db.ingredients.count();
    const id = await saveRecipe(db, {
      name: 'Pão com muçarela',
      emoji: '🥖',
      mealType: 'jantar',
      cost: 'baixo',
      items: [
        { name: 'mussarela', quantity: 100, unit: 'g' }, // apelido de "Queijo muçarela"
        { name: 'Pão francês', quantity: null, unit: null },
        { name: '  ', quantity: null, unit: null }, // linha vazia é ignorada
      ],
    });
    const r = await db.recipes.get(id);
    expect(r).toMatchObject({ name: 'Pão com muçarela', emoji: '🥖', cost: 'baixo', mealType: 'jantar' });
    expect(r!.items[0]).toMatchObject({ ingredientId: 'ex-mucarela', quantity: 100, unit: 'g' });
    expect(r!.items).toHaveLength(2);
    expect(await db.ingredients.count()).toBe(before + 1);
  });

  it('editar mantém o id e o cardápio já montado não muda', async () => {
    await addDish(db, '2026-11-14', 'jantar', 'ex-wrap');
    const draft = (await draftFromRecipe(db, 'ex-wrap'))!;
    await saveRecipe(db, { ...draft, name: 'Wrap caprichado', items: [...draft.items, { name: 'Alface', quantity: null, unit: null }] });
    expect((await db.recipes.get('ex-wrap'))?.name).toBe('Wrap caprichado');
    expect((await db.days.get('2026-11-14'))!.slots.jantar![0].snapshot.name).toBe('Wrap');
  });

  it('excluir é "macio": some da lista mas o registro fica marcado para sincronizar', async () => {
    await deleteRecipe(db, 'ex-wrap');
    expect((await db.recipes.get('ex-wrap'))?.deleted).toBe(true);
    expect(await draftFromRecipe(db, 'ex-wrap')).toBeNull();
  });

  it('sugere categoria para ingrediente novo', () => {
    expect(guessCategory('Filé de frango')).toBe('acougue');
    expect(guessCategory('Requeijão')).toBe('frios');
    expect(guessCategory('Abóbora')).toBe('hortifruti');
    expect(guessCategory('Lentilha')).toBe('mercearia');
    expect(guessCategory('Macarrão instantâneo')).toBe('mercearia');
    expect(guessCategory('Ovos')).toBe('hortifruti');
    expect(guessCategory('Batata palha')).toBe('mercearia');
  });
});

describe('banco de receitas', () => {
  it('adiciona as sugestões, reaproveita ingredientes e marca custo nas antigas', async () => {
    expect(await bankPending(db)).toBe(BANK.length);
    const r = await loadBank(db);
    expect(r.recipesAdded).toBe(BANK.length);
    expect(r.costsTagged).toBe(8); // as 8 do exemplo
    expect((await db.recipes.get('ex-estrogonofe'))?.cost).toBe('alto');
    // "Queijo muçarela" do banco é o mesmo ingrediente do exemplo
    const omelete = (await db.recipes.get('bank-omelete'))!;
    expect(omelete.items.map((i) => i.ingredientId)).toContain('ex-mucarela');
    expect(omelete.items.every((i) => i.quantity === null)).toBe(true);
  });

  it('carregar de novo não duplica', async () => {
    await loadBank(db);
    const again = await loadBank(db);
    expect(again).toEqual({ recipesAdded: 0, ingredientsAdded: 0, costsTagged: 0 });
    expect(await bankPending(db)).toBe(0);
  });
});

describe('links das sugestões', () => {
  it('troca só o link de busca; link colado por você fica', async () => {
    const { RECIPE_LINKS, applyBankLinks, loadBank: lb, searchLink } = await import('./bank');
    await lb(db);
    const ids = Object.keys(RECIPE_LINKS);
    if (!ids.length) return;
    const [a, b] = ids;
    // simula a versão anterior: link de busca
    for (const id of [a, b]) {
      const r = (await db.recipes.get(id))!;
      await db.recipes.put({ ...r, link: searchLink(r.name) });
    }
    await db.recipes.update(b, { link: 'https://minha-receita.example/b' });
    await applyBankLinks(db);
    expect((await db.recipes.get(a))!.link).toBe(RECIPE_LINKS[a]);
    expect((await db.recipes.get(b))!.link).toBe('https://minha-receita.example/b');
  });
});
