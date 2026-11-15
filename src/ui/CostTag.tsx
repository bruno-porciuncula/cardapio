import type { Cost } from '../db/types';
import { COST_INFO } from '../db/recipes';

/** Etiqueta de custo: $ Econômica · $$ Média · $$$ Mais cara. */
export function CostTag({ cost, compact }: { cost?: Cost; compact?: boolean }) {
  if (!cost) return null;
  const info = COST_INFO[cost];
  return (
    <span class={`cost cost-${cost}`} title={`${info.label}: ${info.hint}`}>
      <b>{info.short}</b>{!compact && <span>{info.label}</span>}
    </span>
  );
}
