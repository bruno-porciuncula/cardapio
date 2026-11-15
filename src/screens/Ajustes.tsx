import { useEffect, useState } from 'preact/hooks';
import { db, requestPersistence } from '../db/db';
import { loadExample, type ExampleResult } from '../db/example';
import { mondayOf } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';

export function Ajustes() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const [result, setResult] = useState<ExampleResult | null>(null);

  const counts = useLive(async () => {
    const live = <T extends { deleted?: boolean }>(rows: T[]) => rows.filter((r) => !r.deleted).length;
    return {
      receitas: live(await db.recipes.toArray()),
      ingredientes: live(await db.ingredients.toArray()),
      semanas: live(await db.weeks.toArray()),
      categorias: live(await db.categories.toArray()),
    };
  });

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024).toFixed(0)} KB usados`);
    });
  }, []);

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">Mesa · versão {__APP_VERSION__}</p>
        <h1>Ajustes</h1>
      </header>

      <div class="settings-group">
        <h2 class="section-title"><Icon name="database" size={18} /> Dados neste aparelho</h2>
        {counts && (
          <ul class="plain-list">
            <li><span>Receitas</span><span>{counts.receitas}</span></li>
            <li><span>Ingredientes</span><span>{counts.ingredientes}</span></li>
            <li><span>Semanas</span><span>{counts.semanas}</span></li>
            <li><span>Categorias</span><span>{counts.categorias}</span></li>
          </ul>
        )}
        <div class="setting-row">
          <div>
            <strong>Armazenamento protegido</strong>
            <p class="muted">
              {persisted
                ? 'O navegador não vai apagar seus dados para liberar espaço.'
                : 'Instale o app na tela inicial e toque em proteger.'}
              {usage && ` ${usage}.`}
            </p>
          </div>
          {persisted ? (
            <span class="chip chip-accent"><Icon name="check" size={13} /> ativo</span>
          ) : (
            <button class="btn" onClick={async () => setPersisted(await requestPersistence())}>Proteger</button>
          )}
        </div>
      </div>

      <div class="settings-group">
        <h2 class="section-title"><Icon name="sparkles" size={18} /> Cardápio de exemplo</h2>
        <p class="muted">
          Adiciona as receitas do briefing e preenche os almoços vazios desta semana. Não apaga nem sobrescreve nada.
        </p>
        <button class="btn" onClick={async () => setResult(await loadExample(db, mondayOf()))}>Carregar exemplo</button>
        {result && (
          <p class="fine">
            {result.recipesAdded} receitas e {result.ingredientsAdded} ingredientes novos · {result.slotsFilled} almoços
            preenchidos{result.slotsSkipped ? ` · ${result.slotsSkipped} já ocupados foram mantidos` : ''}.
          </p>
        )}
      </div>

      <p class="fine center">Backup e sincronização com o Drive chegam nas próximas etapas.</p>
    </section>
  );
}
