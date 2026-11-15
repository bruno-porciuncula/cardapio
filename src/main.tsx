import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './styles/app.css';
import { App } from './app';
import { db, requestPersistence } from './db/db';
import { ensureDefaults } from './db/seed';

// No Android, o Chrome concede automaticamente quando o app está instalado.
requestPersistence().catch(() => {});

ensureDefaults(db)
  .catch((err) => console.error('Falha ao preparar o banco', err))
  .finally(() => render(<App />, document.getElementById('app')!));
