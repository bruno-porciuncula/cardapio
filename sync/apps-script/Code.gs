/**
 * Mesa · servidor de sincronização (Google Apps Script).
 *
 * Guarda os dados do app numa pasta do seu Google Drive e devolve só o que
 * mudou desde a última vez. Cada registro fica com a versão mais recente
 * (campo updatedAt), o mesmo critério do backup.
 *
 * Instalação: cole este arquivo num projeto novo em script.google.com,
 * troque a CHAVE abaixo e publique como "App da Web"
 * (Executar como: eu · Quem pode acessar: qualquer pessoa).
 */

const CHAVE = 'COLE_AQUI_A_CHAVE';
const PASTA = 'Mesa (sincronização)';
const ARQUIVO = 'mesa-dados.json';
const VERSAO = 1;

/* ───────── Núcleo (sem Google, testável) ───────── */

function criarEstado() {
  return { rev: 0, records: {} };
}

/**
 * Processa um pedido. `st` é o armazenamento:
 * { load(), save(state), putImage(id, type, base64) -> fileId, getImage(fileId) -> {type, data}, dropImage(fileId), now() }
 */
function handle(req, st) {
  if (!req || typeof req !== 'object') return { ok: false, erro: 'pedido' };
  const state = st.load();
  const next = () => (state.rev = Math.max(state.rev + 1, st.now()));
  let changed = false;

  switch (req.action) {
    case 'ping':
      return { ok: true, app: 'mesa-sync', versao: VERSAO, rev: state.rev };

    case 'push': {
      let accepted = 0;
      for (const item of req.records || []) {
        const t = item && item.t;
        const r = item && item.r;
        if (!t || t === 'images' || !r || typeof r.id !== 'string' || typeof r.updatedAt !== 'number') continue;
        const k = t + '/' + r.id;
        const cur = state.records[k];
        if (!cur || r.updatedAt > cur.r.updatedAt) {
          state.records[k] = { t: t, r: r, rev: next() };
          accepted++;
          changed = true;
        }
      }
      if (changed) st.save(state);
      return { ok: true, accepted: accepted, rev: state.rev };
    }

    case 'pull': {
      const since = Number(req.since) || 0;
      const out = [];
      for (const k in state.records) {
        const rec = state.records[k];
        if (rec.rev > since) out.push({ t: rec.t, r: rec.r });
      }
      return { ok: true, records: out, rev: state.rev };
    }

    case 'putImage': {
      if (typeof req.id !== 'string' || typeof req.updatedAt !== 'number') return { ok: false, erro: 'imagem' };
      const k = 'images/' + req.id;
      const cur = state.records[k];
      if (cur && req.updatedAt <= cur.r.updatedAt) return { ok: true, accepted: 0, rev: state.rev };
      let fileId = null;
      if (!req.deleted && req.data) fileId = st.putImage(req.id, req.type || 'image/webp', req.data);
      if (cur && cur.r.fileId) st.dropImage(cur.r.fileId);
      const r = { id: req.id, updatedAt: req.updatedAt, type: req.type || 'image/webp', fileId: fileId };
      if (req.deleted) r.deleted = true;
      state.records[k] = { t: 'images', r: r, rev: next() };
      st.save(state);
      return { ok: true, accepted: 1, rev: state.rev };
    }

    case 'getImage': {
      const rec = state.records['images/' + req.id];
      if (!rec || !rec.r.fileId) return { ok: false, erro: 'sem-imagem' };
      const img = st.getImage(rec.r.fileId);
      return { ok: true, type: img.type, data: img.data };
    }

    default:
      return { ok: false, erro: 'acao' };
  }
}

/* ───────── Apps Script ───────── */

function doGet() {
  return resposta({ ok: true, app: 'mesa-sync', versao: VERSAO });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return resposta({ ok: false, erro: 'json' });
  }
  if (!req || req.key !== CHAVE || CHAVE === 'COLE_AQUI_A_CHAVE') return resposta({ ok: false, erro: 'chave' });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return resposta(handle(req, armazenamentoDrive()));
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function pastaDados() {
  const it = DriveApp.getFoldersByName(PASTA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA);
}

function armazenamentoDrive() {
  const pasta = pastaDados();
  let arquivo = null;
  return {
    load: function () {
      const it = pasta.getFilesByName(ARQUIVO);
      if (!it.hasNext()) return criarEstado();
      arquivo = it.next();
      return JSON.parse(arquivo.getBlob().getDataAsString('UTF-8'));
    },
    save: function (state) {
      const texto = JSON.stringify(state);
      if (arquivo) arquivo.setContent(texto);
      else arquivo = pasta.createFile(ARQUIVO, texto, 'application/json');
    },
    putImage: function (id, type, base64) {
      const blob = Utilities.newBlob(Utilities.base64Decode(base64), type, 'foto-' + id);
      return pasta.createFile(blob).getId();
    },
    getImage: function (fileId) {
      const blob = DriveApp.getFileById(fileId).getBlob();
      return { type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
    },
    dropImage: function (fileId) {
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) { /* já removida */ }
    },
    now: function () {
      return Date.now();
    },
  };
}

/** Rode uma vez no editor para autorizar o acesso ao Drive e criar a pasta. */
function instalar() {
  const pasta = pastaDados();
  Logger.log('Pasta pronta: ' + pasta.getName() + ' (' + pasta.getUrl() + ')');
}

// Para os testes do app (não existe no Apps Script).
if (typeof module !== 'undefined') module.exports = { handle: handle, criarEstado: criarEstado };
