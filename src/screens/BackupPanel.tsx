import { useRef, useState } from 'preact/hooks';
import { db } from '../db/db';
import {
  BackupError, backupFileName, createBackup, importBackup, lastBackupAt, markBackupDone, parseBackup, summarize,
  type Backup, type BackupSummary, type ImportMode, type ImportResult,
} from '../db/backup';
import { ensureDefaults } from '../db/seed';
import { requestFullPush } from '../db/sync';
import { useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';

const dtf = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function daysAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Entrega o arquivo: no Android abre o menu "Compartilhar" (Drive, WhatsApp…); no computador, baixa. */
async function deliver(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup · Refeição dos porcis' });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // se o compartilhamento falhar, cai no download
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export function BackupPanel() {
  const last = useLive(() => lastBackupAt(db));
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onExport() {
    setExporting(true);
    setExportMsg('');
    try {
      const backup = await createBackup(db);
      const file = new File([JSON.stringify(backup)], backupFileName(), { type: 'application/json' });
      const how = await deliver(file);
      if (how === 'cancelled') return;
      await markBackupDone(db);
      setExportMsg(how === 'shared' ? 'Backup enviado. Guarde no Drive para não perder.' : `Arquivo ${file.name} baixado.`);
    } catch (err) {
      console.error(err);
      setExportMsg('Não foi possível gerar o backup.');
    } finally {
      setExporting(false);
    }
  }

  async function onPick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    setImportMsg(null);
    setConfirmReplace(false);
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setPending({ backup, summary: summarize(backup) });
    } catch (err) {
      setImportMsg({ ok: false, text: err instanceof BackupError ? err.message : 'Não foi possível ler o arquivo.' });
    }
  }

  async function onImport(mode: ImportMode) {
    if (!pending) return;
    setImporting(true);
    try {
      const r: ImportResult = await importBackup(db, pending.backup, mode);
      await ensureDefaults(db);
      await requestFullPush(db);
      setImportMsg({
        ok: true,
        text: mode === 'substituir'
          ? 'Pronto! Os dados deste aparelho foram substituídos pelo backup.'
          : `Pronto! ${r.added} novos, ${r.updated} atualizados e ${r.kept} mantidos como estavam.`,
      });
      setPending(null);
    } catch (err) {
      console.error(err);
      setImportMsg({ ok: false, text: 'Não foi possível importar. Nada foi alterado.' });
    } finally {
      setImporting(false);
      setConfirmReplace(false);
    }
  }

  const stale = last === null || (last !== undefined && Date.now() - last > 7 * 86400000);

  return (
    <div class="settings-group">
      <h2 class="section-title"><span>💾</span> Backup</h2>
      <p class="muted">
        Um arquivo com tudo: receitas, cardápios, extras e fotos. Use para guardar uma cópia ou para levar seus dados
        para outro aparelho.
      </p>
      {last !== undefined && (
        <p class={`backup-status ${stale ? 'is-stale' : ''}`}>
          <Icon name={stale ? 'history' : 'check'} size={16} />
          {last ? `Último backup ${daysAgo(last)}` : 'Nenhum backup feito neste aparelho ainda'}
        </p>
      )}

      <div class="backup-actions">
        <button class="btn btn-primary" disabled={exporting} onClick={onExport}>
          <Icon name="download" size={18} /> {exporting ? 'Gerando…' : 'Exportar backup'}
        </button>
        <button class="btn" onClick={() => input.current?.click()}>
          <Icon name="upload" size={18} /> Importar backup
        </button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={onPick} />
      </div>
      {exportMsg && <p class="fine">{exportMsg}</p>}

      {pending && (
        <div class="import-preview">
          <strong>Backup de {dtf.format(new Date(pending.summary.exportedAt))}</strong>
          <p class="muted">
            {pending.summary.receitas} receitas · {pending.summary.ingredientes} ingredientes · {pending.summary.dias} dias
            planejados · {pending.summary.fotos} fotos
          </p>
          <button class="btn btn-primary" disabled={importing} onClick={() => onImport('juntar')}>
            {importing ? 'Importando…' : 'Juntar com o que já tenho'}
          </button>
          <p class="fine">Recomendado. Nada é apagado; quando o mesmo item existir nos dois, fica a versão mais recente.</p>
          {confirmReplace ? (
            <button class="btn btn-danger" disabled={importing} onClick={() => onImport('substituir')}>
              Sim, apagar este aparelho e usar o backup
            </button>
          ) : (
            <button class="btn btn-ghost-danger" disabled={importing} onClick={() => setConfirmReplace(true)}>
              Substituir tudo
            </button>
          )}
          <button class="link-btn" onClick={() => { setPending(null); setConfirmReplace(false); }}>Cancelar</button>
        </div>
      )}
      {importMsg && <p class={importMsg.ok ? 'fine ok' : 'fine error'}>{importMsg.text}</p>}
    </div>
  );
}
