import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

/**
 * Só no servidor de desenvolvimento do Mac: guarda um backup gerado no navegador
 * em ./backups e serve o arquivo para o celular baixar pela rede Wi-Fi.
 */
function devBackupBridge(): Plugin {
  const dir = resolve(__dirname, 'backups');
  return {
    name: 'mesa-dev-backup',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/backup', (req, res) => {
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            mkdirSync(dir, { recursive: true });
            const name = basename(String(req.headers['x-file-name'] || 'mesa-backup.json')).replace(/[^\w.-]/g, '');
            writeFileSync(resolve(dir, name), Buffer.concat(chunks));
            res.end(JSON.stringify({ saved: name }));
          });
          return;
        }
        const name = basename(decodeURIComponent((req.url || '').replace(/^\//, '')));
        const file = resolve(dir, name);
        if (!name || !existsSync(file)) { res.statusCode = 404; res.end('não encontrado'); return; }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    devBackupBridge(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mesa · cardápio da semana',
        short_name: 'Mesa',
        description: 'Cardápio semanal e lista de compras',
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#F6F2EA',
        theme_color: '#F6F2EA',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
});
