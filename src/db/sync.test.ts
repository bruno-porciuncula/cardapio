import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import serverCode from '../../sync/apps-script/Code.gs?raw';
import { MesaDB, getWeekStart, setWeekStart } from './db';
import { ensureDefaults } from './seed';
import { loadExample } from './example';
import { addDish, removeDish } from './plan';
import { connectSync, pairingCode, parsePairingCode, syncNow, type Transport } from './sync';

/* Servidor de verdade (o mesmo arquivo que vai para o Apps Script), com o Drive simulado em memória. */
function fakeServer() {
  const mod: { exports: { handle: (req: unknown, st: unknown) => Record<string, unknown>; criarEstado: () => unknown } } = { exports: {} as never };
  new Function('module', serverCode)(mod);
  let state = mod.exports.criarEstado();
  const files = new Map<string, { type: string; data: string }>();
  let n = 0;
  let clock = 1_000;
  const st = {
    load: () => JSON.parse(JSON.stringify(state)),
    save: (s: unknown) => { state = JSON.parse(JSON.stringify(s)); },
    putImage: (_id: string, type: string, data: string) => { const id = `f${++n}`; files.set(id, { type, data }); return id; },
    getImage: (id: string) => files.get(id)!,
    dropImage: (id: string) => files.delete(id),
    now: () => ++clock,
  };
  const KEY = 'chave-de-teste-123456789';
  const transport: Transport = async (body) => {
    if (body.key !== KEY) return { ok: false, erro: 'chave' };
    // ida e volta por JSON, como na rede
    return JSON.parse(JSON.stringify(mod.exports.handle(JSON.parse(JSON.stringify(body)), st)));
  };
  return { transport, config: { url: 'https://script.google.com/macros/s/x/exec', key: KEY }, files };
}

const device = async () => {
  const d = new MesaDB(`sync-${Math.random()}`);
  await ensureDefaults(d);
  return d;
};

let server: ReturnType<typeof fakeServer>;
let mac: MesaDB;
let phone: MesaDB;

beforeEach(async () => {
  server = fakeServer();
  mac = await device();
  phone = await device();
  await loadExample(mac, '2026-11-09');
  await setWeekStart(6, mac);
  await mac.images.put({ id: 'img-1', updatedAt: Date.now(), blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/webp' }) });
});

const sync = (d: MesaDB) => syncNow(d, server.transport);

describe('sincronização Mac ↔ celular', () => {
  it('o celular recebe tudo do Mac, inclusive fotos e o início da semana', async () => {
    await connectSync(mac, server.config, server.transport);
    await sync(mac);
    await connectSync(phone, server.config, server.transport);
    await sync(phone);

    expect(await phone.recipes.count()).toBe(8);
    expect((await phone.days.get('2026-11-13'))?.slots.almoco?.map((d) => d.snapshot.name)).toEqual(['Estrogonofe', 'Wrap']);
    expect(await getWeekStart(phone)).toBe(6);
    const img = await phone.images.get('img-1');
    expect([...new Uint8Array(await img!.blob.arrayBuffer())]).toEqual([9, 8, 7]);
  });

  it('mudança no celular aparece no Mac e vice-versa', async () => {
    for (const d of [mac, phone]) await connectSync(d, server.config, server.transport);
    await sync(mac);
    await sync(phone);

    await addDish(phone, '2026-11-14', 'jantar', 'ex-hamburguer');
    await sync(phone);
    await sync(mac);
    expect((await mac.days.get('2026-11-14'))?.slots.jantar?.[0].recipeId).toBe('ex-hamburguer');

    const uid = (await mac.days.get('2026-11-14'))!.slots.jantar![0].uid;
    await removeDish(mac, '2026-11-14', 'jantar', uid);
    await sync(mac);
    await sync(phone);
    expect((await phone.days.get('2026-11-14'))?.slots.jantar).toBeUndefined();
  });

  it('conflito: fica a alteração mais recente', async () => {
    for (const d of [mac, phone]) await connectSync(d, server.config, server.transport);
    await sync(mac);
    await sync(phone);

    await phone.recipes.update('ex-wrap', { name: 'Wrap (celular)', updatedAt: Date.now() });
    await new Promise((r) => setTimeout(r, 5));
    await mac.recipes.update('ex-wrap', { name: 'Wrap (Mac, mais recente)', updatedAt: Date.now() });
    await sync(phone);
    await sync(mac);
    await sync(phone);
    expect((await phone.recipes.get('ex-wrap'))?.name).toBe('Wrap (Mac, mais recente)');
    expect((await mac.recipes.get('ex-wrap'))?.name).toBe('Wrap (Mac, mais recente)');
  });

  it('sem mudanças, não envia nada de novo', async () => {
    await connectSync(mac, server.config, server.transport);
    const first = await sync(mac);
    expect(first.sent).toBeGreaterThan(30);
    const second = await sync(mac);
    expect(second.sent).toBe(0);
  });

  it('chave errada é recusada na conexão', async () => {
    await expect(connectSync(phone, { ...server.config, key: 'errada-errada-errada' }, server.transport)).rejects.toThrow(/Chave incorreta/);
  });

  it('link de pareamento ida e volta', () => {
    const code = pairingCode(server.config);
    expect(parsePairingCode(code)).toEqual(server.config);
    expect(parsePairingCode('lixo')).toBeNull();
  });
});
