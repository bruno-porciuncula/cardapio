import { useEffect, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';

/**
 * Consulta reativa ao banco: a tela atualiza sozinha quando os dados mudam
 * (inclusive por outra aba ou, no futuro, pela sincronização).
 * Retorna `undefined` enquanto carrega.
 */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: setValue,
      error: (err) => console.error('[useLive]', err),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Rota atual a partir do hash (#/semana/2026-11-14/montar). O botão voltar do Android funciona. */
export type Route = 'inicio' | 'semana' | 'cardapio' | 'receita' | 'lista' | 'ajustes' | 'parear';
const ROUTES: Route[] = ['inicio', 'semana', 'cardapio', 'receita', 'lista', 'ajustes', 'parear'];
/** Endereços antigos continuam abrindo no lugar certo. */
const LEGACY: Record<string, Route> = { montar: 'semana', refeicoes: 'cardapio', historico: 'inicio' };

function parseHash(): { route: Route; param?: string; sub?: string } {
  const [, r, param, sub] = location.hash.split('/');
  if (r && LEGACY[r]) return { route: LEGACY[r], param, sub: r === 'montar' ? 'montar' : sub };
  const route = (ROUTES as string[]).includes(r) ? (r as Route) : 'inicio';
  return { route, param, sub };
}

export function useRoute() {
  const [state, setState] = useState(parseHash);
  useEffect(() => {
    const on = () => setState(parseHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return state;
}

export function navigate(route: Route, param?: string, sub?: string) {
  location.hash = `#/${route}${param ? `/${param}` : ''}${sub ? `/${sub}` : ''}`;
}
