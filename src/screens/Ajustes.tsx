import { useEffect, useState } from 'preact/hooks';
import { db, getWeekStart, requestPersistence, setWeekStart } from '../db/db';
import { loadExample, type ExampleResult } from '../db/example';
import { WEEKDAY_NAMES, startOfWeek } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';
import { BackupPanel } from './BackupPanel';
import { SyncPanel } from './SyncPanel';

/** Ordem de exibição: segunda … domingo. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function Ajustes() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState('');
  const [result, setResult] = useState<ExampleResult | null>(null);
  const weekStart = useLive(() => getWeekStart());

  const counts = useLive(async () => {
    const live = <T extends { deleted?: boolean }>(rows: T[]) => rows.filter((r) => !r.deleted).length;
    return {
      receitas: live(await db.recipes.toArray()),
      ingredientes: live(await db.ingredients.toArray()),
      dias: (await db.days.toArray()).filter((d) => !d.deleted && (d.slots.almoco?.length || d.slots.jantar?.length)).length,
      fotos: live(await db.images.toArray()),
    };
  });

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB usados`);
    });
  }, []);

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">Mesa · versão {__APP_VERSION__}</p>
        <h1>Ajustes</h1>
      </header>

      <SyncPanel />
      <BackupPanel />

      <div class="settings-group">
        <h2 class="section-title"><span>🗓️</span> A semana começa no</h2>
        <p class="muted">Use o dia em que vocês fazem as compras. Os pratos já planejados não mudam de dia.</p>
        <div class="chips">
          {DOW_ORDER.map((dow) => (
            <button
              key={dow}
              class={`chip chip-toggle ${weekStart === dow ? 'is-on' : ''}`}
              aria-pressed={weekStart === dow}
              onClick={() => setWeekStart(dow)}
            >
              {WEEKDAY_NAMES[dow]}
            </button>
          ))}
        </div>
      </div>

      <div class="settings-group">
        <h2 class="section-title"><Icon name="database" size={18} /> Dados neste aparelho</h2>
        {counts && (
          <ul class="plain-list">
            <li><span>Receitas</span><span>{counts.receitas}</span></li>
            <li><span>Ingredientes</span><span>{counts.ingredientes}</span></li>
            <li><span>Dias planejados</span><span>{counts.dias}</span></li>
            <li><span>Fotos</span><span>{counts.fotos}</span></li>
          </ul>
        )}
        <div class="setting-row">
          <div>
            <strong>Armazenamento protegido</strong>
            <p class="muted">
              {persisted ? 'O navegador não vai apagar seus dados para liberar espaço.' : 'Instale o app na tela inicial para proteger os dados.'}
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
        <h2 class="section-title"><span>✨</span> Cardápio de exemplo</h2>
        <p class="muted">Adiciona as receitas do briefing e preenche os almoços vazios desta semana. Não apaga nem sobrescreve nada.</p>
        <button class="btn" onClick={async () => setResult(await loadExample(db, startOfWeek(new Date(), weekStart ?? 1)))}>
          Carregar exemplo
        </button>
        {result && (
          <p class="fine">
            {result.recipesAdded} receitas e {result.ingredientsAdded} ingredientes novos · {result.slotsFilled} almoços preenchidos
            {result.slotsSkipped ? ` · ${result.slotsSkipped} já ocupados foram mantidos` : ''}.
          </p>
        )}
      </div>

      {import.meta.env.DEV && <DevSeed />}

      
    </section>
  );
}

/** Só na versão de teste (servidor do Mac): carrega a semana da Giulia, os 6 cardápios e as fotos. */
function DevSeed() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const dev = (window as unknown as { __mesaDev?: { seed: () => Promise<unknown> } }).__mesaDev;
  if (!dev) return null;
  return (
    <div class="settings-group">
      <h2 class="section-title"><span>🧪</span> Dados de teste</h2>
      <p class="muted">Semana de 14/11 com os extras, os 6 cardápios de exemplo e as fotos. Só aparece na versão de teste.</p>
      <button
        class="btn"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          try {
            await dev.seed();
            setState('done');
          } catch (err) {
            console.error(err);
            setState('error');
          }
        }}
      >
        {state === 'busy' ? 'Carregando…' : 'Carregar dados de teste'}
      </button>
      {state === 'done' && <p class="fine">Pronto! Veja o Cardápio.</p>}
      {state === 'error' && <p class="fine">Não deu certo. Tente de novo.</p>}
    </div>
  );
}
