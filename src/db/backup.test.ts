import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MesaDB, getWeekStart, setWeekStart } from './db';
import { ensureDefaults } from './seed';
import { loadExample } from './example';
import { BackupError, createBackup, importBackup, parseBackup, summarize } from './backup';
import { addDish } from './plan';

const fresh = async () => {
  const d = new MesaDB(`bk-${Math.random()}`);
  await ensureDefaults(d);
  return d;
};

let mac: MesaDB;
beforeEach(async () => {
  mac = await fresh();
  await loadExample(mac, '2026-11-09');
  await setWeekStart(6, mac);
  await mac.images.put({ id: 'img-1', updatedAt: 5, blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/webp' }) });
  await mac.recipes.update('ex-estrogonofe', { imageId: 'img-1' });
});

/** Simula o arquivo indo de um aparelho para o outro. */
const roundTrip = async (from: MesaDB) => parseBackup(JSON.stringify(await createBackup(from)));

describe('backup', () => {
  it('leva tudo para um aparelho vazio, inclusive fotos e o início da semana', async () => {
    const phone = await fresh();
    const b = await roundTrip(mac);
    expect(summarize(b)).toMatchObject({ receitas: 8, ingredientes: 24, dias: 7, fotos: 1 });

    await importBackup(phone, b, 'juntar');
    expect(await phone.recipes.count()).toBe(8);
    expect((await phone.days.get('2026-11-13'))?.slots.almoco?.map((d) => d.snapshot.name)).toEqual(['Estrogonofe', 'Wrap']);
    expect(await getWeekStart(phone)).toBe(6);
    const img = await phone.images.get('img-1');
    expect(img?.blob.type).toBe('image/webp');
    expect([...new Uint8Array(await img!.blob.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('juntar: fica a versão mais recente de cada item e nada é apagado', async () => {
    const phone = await fresh();
    await importBackup(phone, await roundTrip(mac), 'juntar');

    // No celular: um jantar novo (mais recente) e um prato só dele.
    await addDish(phone, '2026-11-14', 'jantar', 'ex-hamburguer');
    const phoneOnly = { id: 'cel-1', name: 'Receita do celular', mealType: 'ambos' as const, items: [], updatedAt: Date.now() };
    await phone.recipes.put(phoneOnly);
    // No Mac: edição antiga de outro dia.
    const old = (await mac.days.get('2026-11-09'))!;

    const r = await importBackup(phone, await roundTrip(mac), 'juntar');
    expect(r.added).toBe(0);
    expect(await phone.recipes.get('cel-1')).toBeDefined();
    expect((await phone.days.get('2026-11-14'))?.slots.jantar).toHaveLength(1);
    expect((await phone.days.get('2026-11-09'))?.updatedAt).toBe(old.updatedAt);
  });

  it('substituir: o aparelho fica igual ao backup', async () => {
    const phone = await fresh();
    await phone.recipes.put({ id: 'cel-1', name: 'Só no celular', mealType: 'ambos', items: [], updatedAt: Date.now() });
    await importBackup(phone, await roundTrip(mac), 'substituir');
    expect(await phone.recipes.get('cel-1')).toBeUndefined();
    expect(await phone.recipes.count()).toBe(8);
    expect(await phone.categories.count()).toBe(9);
  });

  it('recusa arquivos que não são backup do Mesa', () => {
    expect(() => parseBackup('isso não é json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"outro","data":{}}')).toThrow(/não é um backup do Mesa/);
    expect(() => parseBackup('{"app":"mesa","schema":99,"data":{}}')).toThrow(/versão mais nova/);
    expect(() => parseBackup('{"app":"mesa","schema":2,"data":{"recipes":[{"name":"x"}]}}')).toThrow(/corrompido/);
  });
});
