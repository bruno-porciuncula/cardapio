import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon';

/*
 * O botão "voltar" do Android fecha o painel do topo em vez de sair da tela.
 * Uma única entrada no histórico cobre todos os painéis abertos, para que
 * trocar de um painel para outro não dispare um "voltar" no painel novo.
 */
const stack: Array<() => void> = [];
let hasEntry = false;

addEventListener('popstate', () => {
  if (!hasEntry) return;
  hasEntry = false;
  stack[stack.length - 1]?.();
});

function sync() {
  setTimeout(() => {
    if (stack.length === 0 && hasEntry) {
      hasEntry = false;
      history.back();
    } else if (stack.length > 0 && !hasEntry) {
      history.pushState({ sheet: true }, '');
      hasEntry = true;
    }
  }, 0);
}

/** Painel que sobe de baixo no celular (modal centralizado no computador). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const close = () => onCloseRef.current();
    stack.push(close);
    sync();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stack[stack.length - 1] === close && close();
    addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      stack.splice(stack.indexOf(close), 1);
      removeEventListener('keydown', onKey);
      if (!stack.length) document.body.classList.remove('no-scroll');
      sync();
    };
  }, []);

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onCloseRef.current()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-grip" />
        <header class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={() => onCloseRef.current()} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </header>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}
