import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { useRoute, type Route } from './lib/hooks';
import { Icon } from './ui/Icon';
import { Home } from './screens/Home';
import { Semana } from './screens/Semana';
import { Receitas } from './screens/Receitas';
import { ReceitaForm } from './screens/ReceitaForm';
import { Lista } from './screens/Lista';
import { Ajustes } from './screens/Ajustes';
import { Parear } from './screens/SyncPanel';

const TABS: Array<[Route, string, string]> = [
  ['inicio', 'Início', 'home'],
  ['cardapio', 'Cardápio', 'book'],
  ['lista', 'Compras', 'cart'],
  ['ajustes', 'Ajustes', 'settings'],
];
/** Telas internas acendem a aba de onde vieram. */
const PARENT: Partial<Record<Route, Route>> = { semana: 'inicio', receita: 'cardapio', parear: 'ajustes' };

export function App() {
  const { route, param, sub } = useRoute();
  const tabRoute = PARENT[route] ?? route;
  const [update, setUpdate] = useState<null | (() => void)>(null);

  useEffect(() => {
    // Nova versão: avisa e espera você tocar. Nunca recarrega no meio das compras.
    const updateSW = registerSW({ onNeedRefresh: () => setUpdate(() => () => updateSW(true)) });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route, param]);

  return (
    <div class="app">
      <nav class="nav" aria-label="Navegação principal">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">🍽️</span>
          <span class="brand-name">Refeição dos porcis</span>
        </div>
        {TABS.map(([id, label, icon]) => {
          const active = tabRoute === id;
          return (
          <a key={id} href={`#/${id}`} class={`nav-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon name={icon} />
            <span>{label}</span>
          </a>
          );
        })}
      </nav>

      <main class="main">
        {route === 'inicio' && <Home />}
        {route === 'semana' && <Semana weekParam={param} tab={sub} />}
        {route === 'cardapio' && <Receitas />}
        {route === 'receita' && <ReceitaForm key={param} id={param} />}
        {route === 'lista' && <Lista weekParam={param} />}
        {route === 'ajustes' && <Ajustes />}
        {route === 'parear' && <Parear code={param} />}
      </main>

      {update && (
        <div class="toast" role="status">
          <span>Nova versão disponível</span>
          <button class="btn btn-primary" onClick={update}>Atualizar</button>
        </div>
      )}
    </div>
  );
}
