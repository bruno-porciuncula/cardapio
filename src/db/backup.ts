/**
 * Backup completo em um arquivo .json (fotos incluídas, em base64).
 *
 * Importar tem dois modos:
 * - "juntar": registro a registro, fica a versão mais recente (updatedAt).
 *   É o mesmo critério que a sincronização vai usar.
 * - "substituir": apaga tudo deste aparelho e põe o conteúdo do arquivo.
 */
import type { MesaDB } from './db';
import type { SyncFields } from './types';

export const BACKUP_APP = 'mesa';
export const BACKUP_SCHEMA = 2;

const TABLES = ['categories', 'ingredients', 'recipes', 'days', 'weeks', 'staples', 'pantry'] as const;
type TableName = (typeof TABLES)[number];

interface BackupImage extends SyncFields {
  type: string;
  data: string; // base64
}

export interface Backup {
  app: typeof BACKUP_APP;
  schema: number;
  exportedAt: string;
  prefs: { weekStart?: number };
  data: Record<TableName, SyncFields[]> & { images: BackupImage[] };
}

export interface BackupSummary {
  receitas: number;
  ingredientes: number;
  dias: number;
  fotos: number;
  exportedAt: string;
}

/* ───────── base64 sem dependências ───────── */

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

/* ───────── Exportar ───────── */

export async function createBackup(db: MesaDB): Promise<Backup> {
  const data = {} as Backup['data'];
  for (const t of TABLES) data[t] = (await db.table(t).toArray()) as SyncFields[];
  data.images = await Promise.all(
    (await db.images.toArray()).map(async (img) => ({
      id: img.id,
      updatedAt: img.updatedAt,
      ...(img.deleted ? { deleted: true } : {}),
      type: img.blob.type || 'image/webp',
      data: await blobToBase64(img.blob),
    })),
  );
  const weekStart = (await db.meta.get('weekStart'))?.value;
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    prefs: typeof weekStart === 'number' ? { weekStart } : {},
    data,
  };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `mesa-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export async function markBackupDone(db: MesaDB) {
  await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
}

export async function lastBackupAt(db: MesaDB): Promise<number | null> {
  const v = (await db.meta.get('lastBackupAt'))?.value;
  return typeof v === 'number' ? v : null;
}

/* ───────── Ler e validar ───────── */

export class BackupError extends Error {}

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('O arquivo não é um backup válido (não é JSON).');
  }
  const b = raw as Partial<Backup>;
  if (!b || b.app !== BACKUP_APP || !b.data) throw new BackupError('Este arquivo não é um backup do Refeição dos porcis.');
  if (typeof b.schema !== 'number' || b.schema > BACKUP_SCHEMA) {
    throw new BackupError('Este backup é de uma versão mais nova do app. Atualize o app e tente de novo.');
  }
  for (const t of [...TABLES, 'images'] as const) {
    const rows = (b.data as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows)) throw new BackupError(`Backup corrompido (${t}).`);
    for (const r of (rows as SyncFields[] | undefined) ?? []) {
      if (!r || typeof r.id !== 'string' || typeof r.updatedAt !== 'number') throw new BackupError(`Backup corrompido (${t}).`);
    }
  }
  return b as Backup;
}

export function summarize(b: Backup): BackupSummary {
  const live = (rows: SyncFields[] = []) => rows.filter((r) => !r.deleted);
  return {
    receitas: live(b.data.recipes).length,
    ingredientes: live(b.data.ingredients).length,
    dias: live(b.data.days).filter((d) => {
      const slots = (d as { slots?: Record<string, unknown[]> }).slots ?? {};
      return Object.values(slots).some((x) => x?.length);
    }).length,
    fotos: live(b.data.images).length,
    exportedAt: b.exportedAt,
  };
}

/* ───────── Importar ───────── */

export type ImportMode = 'juntar' | 'substituir';

export interface ImportResult {
  added: number;
  updated: number;
  kept: number;
}

export async function importBackup(db: MesaDB, b: Backup, mode: ImportMode): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, kept: 0 };
  const tables = [...TABLES.map((t) => db.table(t)), db.images, db.meta];

  await db.transaction('rw', tables, async () => {
    if (mode === 'substituir') {
      for (const t of TABLES) await db.table(t).clear();
      await db.images.clear();
    }

    const merge = async (table: string, incoming: SyncFields[], toRow: (r: SyncFields) => unknown) => {
      const t = db.table(table);
      const local = new Map(((await t.bulkGet(incoming.map((r) => r.id))) as Array<SyncFields | undefined>)
        .filter((r): r is SyncFields => !!r).map((r) => [r.id, r]));
      const write: unknown[] = [];
      for (const r of incoming) {
        const mine = local.get(r.id);
        if (!mine) { result.added++; write.push(toRow(r)); }
        else if (r.updatedAt > mine.updatedAt) { result.updated++; write.push(toRow(r)); }
        else result.kept++;
      }
      if (write.length) await t.bulkPut(write);
    };

    for (const t of TABLES) await merge(t, b.data[t] ?? [], (r) => r);
    await merge('images', b.data.images ?? [], (r) => {
      const img = r as BackupImage;
      return { id: img.id, updatedAt: img.updatedAt, ...(img.deleted ? { deleted: true } : {}), blob: base64ToBlob(img.data, img.type) };
    });

    if (typeof b.prefs?.weekStart === 'number') {
      const hasLocal = await db.meta.get('weekStart');
      if (mode === 'substituir' || !hasLocal) await db.meta.put({ key: 'weekStart', value: b.prefs.weekStart });
    }
  });
  return result;
}
