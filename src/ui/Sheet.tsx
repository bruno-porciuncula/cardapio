import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon';

/**
 * Painel que sobe de baixo no celular (modal centralizado no computador).
 * O botão "voltar" do Android fecha o painel em vez de sair da tela.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const closedByBack = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    history.pushState({ sheet: true }, '');
    const onPop = () => {
      closedByBack.current = true;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('popstate', onPop);
    addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      removeEventListener('popstate', onPop);
      removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      if (!closedByBack.current && history.state?.sheet) history.back();
    };
  }, []);

  function close() {
    onCloseRef.current();
  }

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-grip" />
        <header class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={close} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </header>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}
