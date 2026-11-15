/** Normaliza para busca/comparação: minúsculas, sem acento, espaços únicos. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function uid(): string {
  return crypto.randomUUID();
}

export const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
