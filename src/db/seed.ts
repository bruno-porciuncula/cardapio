import type { Category } from './types';
import type { MesaDB } from './db';

/**
 * Categorias padrão. Ids fixos (não uuid) para que Mac e Android criem
 * exatamente os mesmos registros e a sincronização não os duplique.
 * updatedAt = 0: qualquer edição sua vence a versão padrão.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'hortifruti', name: 'Hortifruti', order: 1, color: '#9CC49A', updatedAt: 0 },
  { id: 'acougue', name: 'Açougue', order: 2, color: '#E2A493', updatedAt: 0 },
  { id: 'frios', name: 'Frios e Laticínios', order: 3, color: '#EBD39A', updatedAt: 0 },
  { id: 'mercearia', name: 'Mercearia e Padaria', order: 4, color: '#D8B99A', updatedAt: 0 },
  { id: 'congelados', name: 'Congelados', order: 5, color: '#A9C8DE', updatedAt: 0 },
  { id: 'bebidas', name: 'Bebidas', order: 6, color: '#C3B4DC', updatedAt: 0 },
  { id: 'limpeza', name: 'Produtos de limpeza', order: 7, color: '#A8D4CB', updatedAt: 0 },
  { id: 'higiene', name: 'Higiene pessoal', order: 8, color: '#E4B5CB', updatedAt: 0 },
  { id: 'outros', name: 'Outros', order: 9, color: '#C9C4BA', updatedAt: 0 },
];

/** Garante as categorias padrão sem sobrescrever as que você já editou. */
export async function ensureDefaults(db: MesaDB): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const existing = new Set((await db.categories.toArray()).map((c) => c.id));
    const missing = DEFAULT_CATEGORIES.filter((c) => !existing.has(c.id));
    if (missing.length) await db.categories.bulkAdd(missing);
  });
}
