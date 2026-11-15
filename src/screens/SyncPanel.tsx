import qrcode from 'qrcode-generator';
import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/db';
import {
  SyncError, connectSync, disconnectSync, getSyncStatus, pairingCode, parsePairingCode, syncNow, type SyncConfig,
} from '../db/sync';
import { useLive } from '../lib/hooks';
import { Icon } from '../ui/Icon';

const APP_URL = 'https://bruno-porciuncula.github.io/cardapio/';

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'agora há pouco';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}

export function pairingLink(config: SyncConfig) {
  return `${APP_URL}#/parear/${pairingCode(config)}`;
}

/** QR code em SVG, gerado no próprio aparelho (nada sai daqui). */
function Qr({ text }: { text: string }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return <div class="qr" dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }} />;
}

export function SyncPanel() {
  const status = useLive(() => getSyncStatus(db));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [showPair, setShowPair] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [, tick] = useState(0);

  // Atualiza o "há X min".
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function connect(config: SyncConfig) {
    setBusy(true);
    setMsg(null);
    try {
      await connectSync(db, config);
      const r = await syncNow(db);
      setMsg({ ok: true, text: `Conectado! Enviados ${r.sent} itens e recebidos ${r.received}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof SyncError ? err.message : 'Não foi possível conectar.' });
    } finally {
      setBusy(false);
    }
  }

  async function onManual() {
    const pasted = parsePairingCode(url.split('#/parear/')[1] ?? '');
    if (pasted) return connect(pasted);
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url.trim())) {
      setMsg({ ok: false, text: 'Cole o endereço do App da Web (termina em /exec) ou um link de pareamento.' });
      return;
    }
    if (key.trim().length < 16) {
      setMsg({ ok: false, text: 'A chave precisa ter pelo menos 16 caracteres.' });
      return;
    }
    await connect({ url: url.trim(), key: key.trim() });
  }

  async function onSyncNow() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await syncNow(db);
      setMsg({ ok: true, text: r.sent || r.received ? `Enviados ${r.sent}, recebidos ${r.received}.` : 'Tudo em dia.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Falhou.' });
    } finally {
      setBusy(false);
    }
  }

  async function share(link: string) {
    try {
      if (navigator.share) await navigator.share({ title: 'Parear · Refeição dos porcis', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setMsg({ ok: true, text: 'Link copiado.' });
      }
    } catch { /* cancelado */ }
  }

  if (!status) return null;
  const config = status.config;

  return (
    <div class="settings-group">
      <h2 class="section-title"><span>🔄</span> Sincronização</h2>

      {!config ? (
        <>
          <p class="muted">
            Mantém este aparelho igual aos outros, usando uma pasta no seu Google Drive. Funciona sem internet e
            sincroniza quando a conexão voltar.
          </p>
          <label class="field">
            <span>Endereço do App da Web ou link de pareamento</span>
            <input type="url" inputMode="url" placeholder="https://script.google.com/macros/s/…/exec" value={url}
              onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />
          </label>
          {!url.includes('#/parear/') && (
            <label class="field">
              <span>Chave</span>
              <input type="text" autoComplete="off" spellcheck={false} value={key}
                onInput={(e) => setKey((e.target as HTMLInputElement).value)} />
            </label>
          )}
          <button class="btn btn-primary" disabled={busy || !url} onClick={onManual}>
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
          <p class="fine">No outro aparelho, abra Ajustes → Sincronização → Parear outro aparelho e escaneie o QR code.</p>
        </>
      ) : (
        <>
          <p class={`backup-status ${status.lastError ? 'is-stale' : ''}`}>
            <Icon name={status.lastError ? 'history' : 'check'} size={16} />
            {status.lastError
              ? `Não sincronizou: ${status.lastError}`
              : status.lastSyncAt ? `Sincronizado ${ago(status.lastSyncAt)}` : 'Conectado, aguardando a primeira sincronização'}
          </p>
          <div class="backup-actions">
            <button class="btn btn-primary" disabled={busy} onClick={onSyncNow}>
              <Icon name="repeat" size={18} /> {busy ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
            <button class="btn" onClick={() => setShowPair(!showPair)}>
              <Icon name="plus" size={18} /> Parear outro aparelho
            </button>
          </div>

          {showPair && (
            <div class="import-preview pair">
              <strong>Aponte a câmera do outro aparelho</strong>
              <Qr text={pairingLink(config)} />
              <p class="fine">
                O QR code abre o app já conectado. Ele contém a chave da sua sincronização: não compartilhe com outras
                pessoas.
              </p>
              <button class="btn" onClick={() => share(pairingLink(config))}>Enviar link de pareamento</button>
            </div>
          )}

          {confirmOff ? (
            <button class="btn btn-danger" onClick={async () => { await disconnectSync(db); setConfirmOff(false); setMsg(null); }}>
              Desconectar este aparelho (os dados ficam aqui)
            </button>
          ) : (
            <button class="link-btn" onClick={() => setConfirmOff(true)}>Desconectar</button>
          )}
        </>
      )}
      {msg && <p class={msg.ok ? 'fine ok' : 'fine error'}>{msg.text}</p>}
    </div>
  );
}

/** Tela aberta pelo link/QR de pareamento. */
export function Parear({ code }: { code?: string }) {
  const config = code ? parsePairingCode(code) : null;
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');

  useEffect(() => {
    // Tira a chave da barra de endereço assim que a tela abre.
    if (code) history.replaceState(null, '', `${location.pathname}#/parear`);
  }, []);

  async function go() {
    if (!config) return;
    setState('busy');
    try {
      await connectSync(db, config);
      const r = await syncNow(db);
      setText(`Recebidos ${r.received} itens.`);
      setState('done');
    } catch (err) {
      setText(err instanceof SyncError ? err.message : 'Não foi possível conectar.');
      setState('error');
    }
  }

  return (
    <section class="screen">
      <header class="screen-head">
        <p class="eyebrow">Sincronização</p>
        <h1>Parear aparelho</h1>
      </header>
      <div class="empty-card">
        <span class="empty-emoji">🔄</span>
        {!config && state === 'idle' ? (
          <>
            <h3>Link inválido</h3>
            <p class="muted">Gere um novo QR code em Ajustes → Sincronização no outro aparelho.</p>
          </>
        ) : state === 'done' ? (
          <>
            <h3>Pronto, aparelho conectado!</h3>
            <p class="muted">{text} Daqui pra frente tudo sincroniza sozinho.</p>
            <a class="btn btn-primary" href="#/inicio">Ir para o início</a>
          </>
        ) : (
          <>
            <h3>Conectar este aparelho?</h3>
            <p class="muted">
              Ele passa a sincronizar com a sua pasta no Google Drive. Nada deste aparelho é apagado: quando o mesmo
              item existir nos dois, fica a versão mais recente.
            </p>
            <button class="btn btn-primary" disabled={state === 'busy'} onClick={go}>
              {state === 'busy' ? 'Conectando…' : 'Conectar e sincronizar'}
            </button>
            {state === 'error' && <p class="fine error">{text}</p>}
          </>
        )}
      </div>
    </section>
  );
}
