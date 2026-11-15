/**
 * Sincronização com o Google Drive (via Apps Script).
 *
 * Cada aparelho continua com o banco completo e funciona sem internet.
 * Quando há conexão: envia o que mudou aqui, recebe o que mudou nos outros
 * aparelhos e, registro a registro, fica a versão mais recente (updatedAt).
 *
 * Regra para o resto do app: nunca apagar registros de verdade — marcar
 * `deleted: true`, senão a exclusão não chega aos outros aparelhos.
 */
import { liveQuery } from 'dexie';
import type { MesaDB } from './db';
import type { SyncFields } from './types';

export const SYNC_TABLES = ['categories', 'ingredients', 'recipes', 'days', 'weeks', 'staples', 'pantry'] as const;

export interface SyncConfig {
  url: string;
  key: string;
}

export interface SyncStatus {
  config: SyncConfig | null;
  lastSyncAt: number | null;
  lastError: string | null;
  running: boolean;
}

type Rec = { t: string; r: SyncFields & Record<string, unknown> };
export type Transport = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

/* ───────── Configuração (fica só neste aparelho) ───────── */

async function getMeta<T>(db: MesaDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
async function setMeta(db: MesaDB, key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export async function getSyncConfig(db: MesaDB): Promise<SyncConfig | null> {
  return (await getMeta<SyncConfig>(db, 'sync:config')) ?? null;
}

/** Conecta este aparelho. Na primeira vez envia tudo e recebe tudo. */
export async function connectSync(db: MesaDB, config: SyncConfig, transport?: Transport) {
  const t = transport ?? httpTransport(config.url);
  const res = await t({ action: 'ping', key: config.key });
  if (!res.ok) throw new SyncError(res.erro === 'chave' ? 'Chave incorreta.' : 'O servidor não respondeu como esperado.');
  await db.meta.bulkPut([
    { key: 'sync:config', value: config },
    { key: 'sync:rev', value: 0 },
    { key: 'sync:lastPushAt', value: 0 },
    { key: 'sync:fullPush', value: true },
    { key: 'sync:lastError', value: null },
  ]);
}

export async function disconnectSync(db: MesaDB) {
  await db.meta.bulkDelete(['sync:config', 'sync:rev', 'sync:lastPushAt', 'sync:fullPush', 'sync:lastSyncAt', 'sync:lastError']);
}

/** Depois de importar um backup: na próxima sincronização envia tudo de novo. */
export async function requestFullPush(db: MesaDB) {
  if (await getSyncConfig(db)) await setMeta(db, 'sync:fullPush', true);
}

export async function getSyncStatus(db: MesaDB): Promise<SyncStatus> {
  return {
    config: await getSyncConfig(db),
    lastSyncAt: (await getMeta<number>(db, 'sync:lastSyncAt')) ?? null,
    lastError: (await getMeta<string | null>(db, 'sync:lastError')) ?? null,
    running: !!inflight,
  };
}

/* ───────── Link de pareamento ───────── */

export function pairingCode(config: SyncConfig): string {
  const json = JSON.stringify({ u: config.url, k: config.key });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parsePairingCode(code: string): SyncConfig | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(b64))));
    if (typeof o.u === 'string' && /^https:\/\//.test(o.u) && typeof o.k === 'string' && o.k.length >= 16) return { url: o.u, key: o.k };
  } catch { /* código inválido */ }
  return null;
}

export function newSyncKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ───────── Transporte ───────── */

export class SyncError extends Error {}

/** POST com text/plain: o Apps Script aceita sem a checagem prévia de CORS. */
export function httpTransport(url: string): Transport {
  return async (body) => {
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    } catch {
      throw new SyncError('Sem conexão com o servidor.');
    }
    if (!res.ok) throw new SyncError(`Servidor respondeu ${res.status}.`);
    try {
      return await res.json();
    } catch {
      throw new SyncError('Resposta inesperada do servidor. Confira se o Apps Script está publicado para "qualquer pessoa".');
    }
  };
}

/* ───────── base64 ───────── */

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/* ───────── Sincronizar ───────── */

let inflight: Promise<SyncResult> | null = null;

export interface SyncResult {
  sent: number;
  received: number;
}

/** Uma rodada de sincronização. Chamadas simultâneas compartilham a mesma rodada. */
export function syncNow(db: MesaDB, transport?: Transport): Promise<SyncResult> {
  if (!inflight) {
    inflight = runSync(db, transport).finally(() => { inflight = null; });
  }
  return inflight;
}

async function runSync(db: MesaDB, transport?: Transport): Promise<SyncResult> {
  const config = await getSyncConfig(db);
  if (!config) return { sent: 0, received: 0 };
  const call = transport ?? httpTransport(config.url);
  const ask = async (body: Record<string, unknown>) => {
    const res = await call({ ...body, key: config.key });
    if (!res.ok) throw new SyncError(res.erro === 'chave' ? 'Chave incorreta. Conecte de novo.' : `Erro do servidor: ${String(res.erro)}`);
    return res;
  };

  try {
    const result: SyncResult = { sent: 0, received: 0 };

    /* 1. Enviar o que mudou aqui */
    const pushStart = Date.now();
    const full = (await getMeta<boolean>(db, 'sync:fullPush')) ?? false;
    const lastPushAt = full ? 0 : ((await getMeta<number>(db, 'sync:lastPushAt')) ?? 0);

    const outgoing: Rec[] = [];
    for (const t of SYNC_TABLES) {
      const rows = (await db.table(t).where('updatedAt').above(lastPushAt - 1).toArray()) as SyncFields[];
      for (const r of rows) if (full || r.updatedAt > lastPushAt) outgoing.push({ t, r: r as Rec['r'] });
    }
    const ws = await getMeta<number>(db, 'weekStart');
    const wsAt = (await getMeta<number>(db, 'weekStart:updatedAt')) ?? 0;
    if (typeof ws === 'number' && (full || wsAt > lastPushAt)) outgoing.push({ t: 'prefs', r: { id: 'weekStart', value: ws, updatedAt: wsAt } });

    for (let i = 0; i < outgoing.length; i += 150) {
      await ask({ action: 'push', records: outgoing.slice(i, i + 150) });
    }
    result.sent += outgoing.length;

    const images = await db.images.where('updatedAt').above(lastPushAt - 1).toArray();
    for (const img of images) {
      if (!full && img.updatedAt <= lastPushAt) continue;
      await ask({
        action: 'putImage', id: img.id, updatedAt: img.updatedAt, deleted: !!img.deleted,
        type: img.blob?.type || 'image/webp', data: img.deleted ? null : await blobToBase64(img.blob),
      });
      result.sent++;
    }
    await db.meta.bulkPut([{ key: 'sync:lastPushAt', value: pushStart }, { key: 'sync:fullPush', value: false }]);

    /* 2. Receber o que mudou nos outros aparelhos */
    const since = (await getMeta<number>(db, 'sync:rev')) ?? 0;
    const pulled = await ask({ action: 'pull', since });
    const records = (pulled.records as Rec[]) ?? [];

    const imageDownloads: Array<Rec['r']> = [];
    await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.images, db.meta], async () => {
      for (const { t, r } of records) {
        if (t === 'prefs') {
          if (r.id === 'weekStart' && r.updatedAt > ((await getMeta<number>(db, 'weekStart:updatedAt')) ?? 0)) {
            await db.meta.bulkPut([{ key: 'weekStart', value: r.value }, { key: 'weekStart:updatedAt', value: r.updatedAt }]);
            result.received++;
          }
          continue;
        }
        if (t === 'images') {
          const local = await db.images.get(r.id);
          if (!local || r.updatedAt > local.updatedAt) imageDownloads.push(r);
          continue;
        }
        if (!(SYNC_TABLES as readonly string[]).includes(t)) continue;
        const local = (await db.table(t).get(r.id)) as SyncFields | undefined;
        if (!local || r.updatedAt > local.updatedAt) {
          await db.table(t).put(r);
          result.received++;
        }
      }
    });

    for (const r of imageDownloads) {
      if (r.deleted) {
        const local = await db.images.get(r.id);
        if (local) await db.images.put({ ...local, deleted: true, updatedAt: r.updatedAt });
      } else {
        const img = await ask({ action: 'getImage', id: r.id });
        await db.images.put({ id: r.id, updatedAt: r.updatedAt, blob: base64ToBlob(String(img.data), String(img.type)) });
      }
      result.received++;
    }

    await db.meta.bulkPut([
      { key: 'sync:rev', value: pulled.rev },
      { key: 'sync:lastSyncAt', value: Date.now() },
      { key: 'sync:lastError', value: null },
    ]);
    return result;
  } catch (err) {
    await setMeta(db, 'sync:lastError', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/* ───────── Automático ───────── */

/**
 * Sincroniza ao abrir, ao voltar para o app, ao recuperar a internet,
 * alguns segundos depois de cada alteração e a cada minuto com o app aberto.
 */
export function startAutoSync(db: MesaDB, onChange?: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    clearTimeout(timer);
    if (!navigator.onLine || document.visibilityState !== 'visible') return;
    syncNow(db).catch(() => { /* erro fica registrado em sync:lastError */ }).finally(() => onChange?.());
  };
  const soon = (ms = 4000) => {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };

  run();
  addEventListener('online', () => soon(500));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && soon(300));
  setInterval(() => document.visibilityState === 'visible' && run(), 60_000);

  // Alterações locais: quando o maior updatedAt passa do último envio, sincroniza em seguida.
  const sub = liveQuery(async () => {
    let max = 0;
    for (const t of SYNC_TABLES) {
      const last = (await db.table(t).orderBy('updatedAt').last()) as SyncFields | undefined;
      if (last && last.updatedAt > max) max = last.updatedAt;
    }
    const img = await db.images.orderBy('updatedAt').last();
    if (img && img.updatedAt > max) max = img.updatedAt;
    return max;
  }).subscribe({
    next: async (max) => {
      if (!(await getSyncConfig(db))) return;
      const pushed = (await getMeta<number>(db, 'sync:lastPushAt')) ?? 0;
      if (max > pushed) soon();
    },
  });
  return () => sub.unsubscribe();
}
