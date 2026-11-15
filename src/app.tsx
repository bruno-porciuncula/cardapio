import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { navigate, useRoute, type Route } from './lib/hooks';
import { Icon } from './ui/Icon';
import { Cardapio } from './screens/Cardapio';
import { Refeicoes } from './screens/Refeicoes';
import { Lista } from './screens/Lista';
import { Historico } from './screens/Historico';
import { Ajustes } from './screens/Ajustes';

const TABS: Array<[Route, string, string]> = [
  ['cardapio', 'Cardápio', 'calendar'],
  ['refeicoes', 'Refeições', 'book'],
  ['lista', 'Lista', 'cart'],
  ['historico', 'Histórico', 'history'],
];

export function App() {
  const { route, param } = useRoute();
  const [update, setUpdate] = useState<null | (() => void)>(null);

  useEffect(() => {
    // Nova versão: avisa e espera você tocar. Nunca recarrega no meio das compras.
    const updateSW = registerSW({ onNeedRefresh: () => setUpdate(() => () => updateSW(true)) });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div class="app">
      <nav class="nav" aria-label="Navegação principal">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">M</span>
          <span class="brand-name">Mesa</span>
        </div>
        {TABS.map(([id, label, icon]) => (
          <a key={id} href={`#/${id}`} class={`nav-item ${route === id ? 'is-active' : ''}`} aria-current={route === id ? 'page' : undefined}>
            <Icon name={icon} />
            <span>{label}</span>
          </a>
        ))}
        <a href="#/ajustes" class={`nav-item nav-settings ${route === 'ajustes' ? 'is-active' : ''}`}>
          <Icon name="settings" />
          <span>Ajustes</span>
        </a>
      </nav>

      <button class="settings-fab icon-btn" onClick={() => navigate('ajustes')} aria-label="Ajustes">
        <Icon name="settings" />
      </button>

      <main class="main">
        {route === 'cardapio' && <Cardapio weekParam={param} />}
        {route === 'refeicoes' && <Refeicoes />}
        {route === 'lista' && <Lista />}
        {route === 'historico' && <Historico />}
        {route === 'ajustes' && <Ajustes />}
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
