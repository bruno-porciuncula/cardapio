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

/** Rota atual a partir do hash (#/cardapio). O botão voltar do Android funciona. */
export type Route = 'cardapio' | 'montar' | 'refeicoes' | 'lista' | 'historico' | 'ajustes';
const ROUTES: Route[] = ['cardapio', 'montar', 'refeicoes', 'lista', 'historico', 'ajustes'];

function parseHash(): { route: Route; param?: string } {
  const [, r, param] = location.hash.split('/');
  const route = (ROUTES as string[]).includes(r) ? (r as Route) : 'cardapio';
  return { route, param };
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

export function navigate(route: Route, param?: string) {
  location.hash = `#/${route}${param ? `/${param}` : ''}`;
}
