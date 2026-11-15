import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './styles/app.css';
import { App } from './app';
import { db, requestPersistence } from './db/db';
import { ensureDefaults } from './db/seed';

// No Android, o Chrome concede automaticamente quando o app está instalado.
requestPersistence().catch(() => {});

// Só no Mac, em desenvolvimento: dados de teste locais (arquivos fora do git).
if (import.meta.env.DEV) {
  for (const load of Object.values(import.meta.glob('./dev/local-seed.ts'))) {
    load().then((mod) => {
      (window as unknown as { __mesaDev: unknown }).__mesaDev = { db, seed: () => (mod as { seedLocal: (d: typeof db) => Promise<unknown> }).seedLocal(db) };
    });
  }
}

ensureDefaults(db)
  .catch((err) => console.error('Falha ao preparar o banco', err))
  .finally(() => render(<App />, document.getElementById('app')!));
