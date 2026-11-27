import { useEffect, useRef, useState } from 'react';
import { db, withRemoteApply } from '../db';
import { downloadBlob, exportBackup, importBackup } from '../lib/backup';
import { formatSize, ymd } from '../lib/dates';
import { disconnect, getClientId, isConnected, setClientId } from '../lib/google-auth';
import { syncNow, useSyncState } from '../lib/sync';
import { ago } from '../components/SyncBadge';

function DriveCard() {
  const s = useSyncState();
  const [clientId, setCid] = useState(getClientId());
  const [draft, setDraft] = useState('');
  const [, force] = useState(0);
  const builtIn = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const connected = isConnected();

  const freeSpace = async () => {
    const docs = (await db.docs.toArray()).filter((d) => d.blob && d.driveFileId);
    const bytes = docs.reduce((a, d) => a + d.size, 0);
    if (!docs.length) return alert('No hay documentos que ya estén en Drive y ocupen espacio aquí.');
    if (!confirm(`Se quitarán de este dispositivo ${docs.length} documentos (${formatSize(bytes)}) que ya están en tu Drive. Se volverán a descargar cuando los abras. ¿Continuar?`)) return;
    await withRemoteApply(() => db.transaction('rw', db.docs, async () => {
      for (const d of docs) await db.docs.update(d.id, { blob: undefined });
    }));
  };

  if (!clientId) {
    return (
      <div className="card">
        <h2>☁️ Sincronizar con Google Drive</h2>
        <p>Para usar la app en el ordenador y en el móvil con los mismos datos, se guardan en <b>tu propio Google Drive</b> (gratis).
          Hace falta un «Client ID» de Google; se crea una sola vez siguiendo la guía <code>SINCRONIZACION.md</code> del proyecto.</p>
        <div className="row wrap">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="123456-abc.apps.googleusercontent.com" style={{ maxWidth: 440 }} />
          <button className="primary" disabled={!draft.trim().endsWith('.apps.googleusercontent.com')}
            onClick={() => { setClientId(draft); setCid(getClientId()); }}>Guardar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>☁️ Google Drive</h2>
      {!connected ? (
        <>
          <p>Conecta tu cuenta de Google. La app solo podrá ver los archivos que ella misma cree (carpeta «Gestión Universidad» de tu Drive).</p>
          <button className="primary" onClick={() => syncNow(true).then(() => force((n) => n + 1))}>Conectar con Google Drive</button>
        </>
      ) : (
        <>
          <p>
            {s.status === 'syncing' ? `🔄 ${s.detail ?? 'Sincronizando…'}`
              : s.status === 'needs_auth' ? '🔑 La sesión de Google ha caducado (dura 1 hora). Pulsa «Sincronizar ahora».'
              : s.status === 'error' ? `⚠️ ${s.error}`
              : s.status === 'offline' ? '📴 Sin conexión: se sincronizará al volver a tener internet.'
              : `✅ Sincronizado ${ago(s.lastSync)}.`}
          </p>
          <p className="muted small">Se sincroniza sola al abrir la app, al volver a ella y unos segundos después de cada cambio.</p>
          <div className="row wrap">
            <button className="primary" disabled={s.status === 'syncing'} onClick={() => syncNow(true)}>🔄 Sincronizar ahora</button>
            <button onClick={freeSpace} title="Útil en el móvil">🧹 Liberar espacio (dejar documentos solo en Drive)</button>
            <button className="danger" onClick={() => { if (confirm('¿Desconectar Google Drive en este dispositivo? Tus datos se quedan aquí y en Drive.')) { disconnect(); force((n) => n + 1); location.reload(); } }}>Desconectar</button>
          </div>
        </>
      )}
      {!builtIn && (
        <p className="muted small" style={{ marginTop: 12 }}>
          Client ID: <code>{clientId.slice(0, 18)}…</code>{' '}
          <button className="ghost sm" onClick={() => { if (confirm('¿Quitar el Client ID?')) { disconnect(); setClientId(''); setCid(''); } }}>Cambiar</button>
        </p>
      )}
    </div>
  );
}

export default function Settings() {
  const [usage, setUsage] = useState<{ used: number; quota: number; persisted: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await navigator.storage.estimate();
        setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0, persisted: await navigator.storage.persisted() });
      } catch { /* no disponible */ }
    })();
  }, []);

  const doExport = async (files: boolean) => {
    setBusy(true);
    try { downloadBlob(await exportBackup(files), `uni-copia-${ymd(new Date())}${files ? '-completa' : ''}.json`); }
    finally { setBusy(false); }
  };

  const doImport = async (f: File) => {
    if (!confirm('Se reemplazarán TODOS los datos actuales por los de la copia. ¿Continuar?')) return;
    setBusy(true);
    try { await importBackup(f); alert('Copia restaurada.'); }
    catch (e) { alert('No se pudo importar: ' + (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head"><div><h1>Ajustes</h1><div className="subtitle">Copias de seguridad y almacenamiento</div></div></div>

      <DriveCard />

      <div className="card">
        <h2>💾 Dónde se guardan tus datos</h2>
        <p>Todo se guarda <b>en este navegador, en tu dispositivo</b>, y si activas Google Drive, también en tu Drive.
          No hay servidores de terceros: es gratis y privado. Sin Drive, si borras los datos del navegador se pierden.</p>
        {usage && (
          <p className="muted small">
            Usando {formatSize(usage.used)} de {formatSize(usage.quota)} disponibles ·
            {usage.persisted ? ' ✅ almacenamiento persistente activado' : ' ⚠️ el navegador podría liberar espacio si falta disco'}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Copia de seguridad</h2>
        <div className="row wrap">
          <button className="primary" disabled={busy} onClick={() => doExport(true)}>⬇ Copia completa (con documentos)</button>
          <button disabled={busy} onClick={() => doExport(false)}>⬇ Copia ligera (sin archivos)</button>
          <button disabled={busy} onClick={() => file.current?.click()}>⬆ Restaurar copia</button>
          <input ref={file} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          También sirve para pasar los datos a otro dispositivo mientras no esté activada la sincronización.
        </p>
      </div>
    </>
  );
}
