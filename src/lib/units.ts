/**
 * Unidades de medida.
 *
 * `dimension` define o que pode ser somado: só unidades da mesma dimensão
 * se convertem entre si. Embalagens e medidas caseiras (pacote, lata,
 * colher…) são cada uma sua própria dimensão — nunca viram gramas.
 */
export interface Unit {
  id: string;
  label: string;
  /** Rótulo no plural, quando diferente. */
  plural?: string;
  dimension: string;
  /** Fator para a unidade base da dimensão (g, ml, un). */
  factor: number;
}

export const UNITS: Unit[] = [
  { id: 'g', label: 'g', dimension: 'massa', factor: 1 },
  { id: 'kg', label: 'kg', dimension: 'massa', factor: 1000 },
  { id: 'ml', label: 'ml', dimension: 'volume', factor: 1 },
  { id: 'l', label: 'L', dimension: 'volume', factor: 1000 },
  { id: 'un', label: 'un', dimension: 'contagem', factor: 1 },
  { id: 'dz', label: 'dúzia', plural: 'dúzias', dimension: 'contagem', factor: 12 },
  { id: 'pacote', label: 'pacote', plural: 'pacotes', dimension: 'pacote', factor: 1 },
  { id: 'caixa', label: 'caixa', plural: 'caixas', dimension: 'caixa', factor: 1 },
  { id: 'lata', label: 'lata', plural: 'latas', dimension: 'lata', factor: 1 },
  { id: 'sache', label: 'sachê', plural: 'sachês', dimension: 'sache', factor: 1 },
  { id: 'pote', label: 'pote', plural: 'potes', dimension: 'pote', factor: 1 },
  { id: 'garrafa', label: 'garrafa', plural: 'garrafas', dimension: 'garrafa', factor: 1 },
  { id: 'maco', label: 'maço', plural: 'maços', dimension: 'maco', factor: 1 },
  { id: 'bandeja', label: 'bandeja', plural: 'bandejas', dimension: 'bandeja', factor: 1 },
  { id: 'colher-sopa', label: 'colher de sopa', plural: 'colheres de sopa', dimension: 'colher-sopa', factor: 1 },
  { id: 'colher-cha', label: 'colher de chá', plural: 'colheres de chá', dimension: 'colher-cha', factor: 1 },
  { id: 'xicara', label: 'xícara', plural: 'xícaras', dimension: 'xicara', factor: 1 },
];

const byId = new Map(UNITS.map((u) => [u.id, u]));

export function getUnit(id: string | null | undefined): Unit | undefined {
  return id ? byId.get(id) : undefined;
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return nf.format(n);
}

/** "350 g", "2 pacotes", "1 caixa"; vazio quando não há quantidade. */
export function formatQuantity(quantity: number | null, unitId: string | null): string {
  if (quantity == null) return '';
  const unit = getUnit(unitId);
  if (!unit) return formatNumber(quantity);
  const label = quantity > 1 && unit.plural ? unit.plural : unit.label;
  return `${formatNumber(quantity)} ${label}`;
}
