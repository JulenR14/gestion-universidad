import { useSyncExternalStore } from 'react';
import { db, onLocalChange, SYNC_TABLES, withRemoteApply, type DocFile, type Stamped, type Subject } from '../db';
import { Drive, DriveAuthError } from './drive';
import { getClientId, getToken, invalidateToken, isConnected } from './google-auth';
import { emptySnapshot, fingerprint, mergeSnapshots, type Snapshot } from './merge';

const ROOT = 'Gestión Universidad';
const DATA_FILE = 'datos.json';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'needs_auth' | 'error' | 'offline';
interface SyncState { status: SyncStatus; lastSync: number | null; error: string | null; detail?: string }

let state: SyncState = { status: isConnected() ? 'idle' : 'off', lastSync: null, error: null };
const subs = new Set<() => void>();
const setState = (p: Partial<SyncState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useSyncState = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

db.meta.get('lastSync').then((m) => m && setState({ lastSync: m.value as number })).catch(() => {});

async function localSnapshot(): Promise<Snapshot> {
  const s = emptySnapshot();
  for (const t of SYNC_TABLES) s.tables[t] = (await db.table(t).toArray()) as Stamped[];
  s.deletions = await db.deletions.toArray();
  return s;
}

/** Lo que se sube a Drive: sin el contenido binario de los documentos. */
const forRemote = (s: Snapshot) => ({
  app: 'gestion-universidad',
  format: 2,
  savedAt: new Date().toISOString(),
  tables: { ...s.tables, docs: (s.tables.docs as DocFile[]).map(({ blob: _b, ...d }) => d) },
  deletions: s.deletions,
});

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Sin nombre';

let running: Promise<void> | null = null;
let again = false;

/**
 * Sincroniza con Google Drive. Con `interactive` puede abrir la ventana de Google
 * (solo desde un clic). Sin él, si el token caducó, se queda en «needs_auth».
 */
export function syncNow(interactive = false): Promise<void> {
  if (!getClientId() || (!isConnected() && !interactive)) return Promise.resolve();
  if (running) { again = true; return running; }
  running = doSync(interactive).finally(() => {
    running = null;
    if (again) { again = false; void syncNow(false); }
  });
  return running;
}

async function doSync(interactive: boolean) {
  if (!navigator.onLine) { setState({ status: 'offline' }); return; }
  let token: string | null;
  try {
    token = await getToken(interactive);
  } catch (e) {
    setState({ status: 'error', error: (e as Error).message });
    return;
  }
  if (!token) { setState({ status: 'needs_auth' }); return; }

  setState({ status: 'syncing', error: null, detail: 'Conectando…' });
  const drive = new Drive(token);
  try {
    const root = await drive.folder(ROOT);
    const dataId = await drive.findFile(DATA_FILE, root);
    const remote: Snapshot = dataId ? await drive.readJson<Snapshot>(dataId) : emptySnapshot();
    remote.tables = { ...emptySnapshot().tables, ...(remote.tables ?? {}) };
    remote.deletions ??= [];

    // 1. Subir documentos nuevos de este dispositivo
    const toUpload = (await db.docs.toArray()).filter((d) => d.blob && !d.driveFileId && !d.url);
    if (toUpload.length) {
      const subjects = new Map((await db.subjects.toArray()).map((s) => [s.id, s] as [string, Subject]));
      const docsRoot = await drive.folder('Documentos', root);
      const folders = new Map<string, string>();
      let i = 0;
      for (const d of toUpload) {
        setState({ detail: `Subiendo documentos (${++i}/${toUpload.length})…` });
        const sName = safeName(subjects.get(d.subjectId)?.name ?? 'Otros');
        let fid = folders.get(sName);
        if (!fid) { fid = await drive.folder(sName, docsRoot); folders.set(sName, fid); }
        const driveFileId = await drive.upload(d.blob!, { name: `${safeName(d.folder)} - ${d.name}`, parents: [fid], mimeType: d.mime });
        await withRemoteApply(() => db.docs.update(d.id, { driveFileId, updatedAt: Date.now() } as Partial<DocFile>));
      }
    }

    // 2. Fusionar
    setState({ detail: 'Fusionando cambios…' });
    const local = await localSnapshot();
    const merged = mergeSnapshots(local, remote);

    // 3. Borrar en Drive los documentos eliminados
    for (const d of merged.deletions) {
      if (d.driveFileId && !d.driveDone) { await drive.trash(d.driveFileId); d.driveDone = true; }
    }

    // 4. Aplicar en este dispositivo
    await withRemoteApply(() => applyLocal(local, merged));

    // 5. Subir a Drive si hay algo nuevo
    if (!dataId || fingerprint(merged) !== fingerprint(remote)) {
      setState({ detail: 'Guardando en Drive…' });
      await drive.writeJson(DATA_FILE, root, forRemote(merged), dataId);
    }

    const now = Date.now();
    await db.meta.put({ key: 'lastSync', value: now });
    setState({ status: 'idle', lastSync: now, error: null, detail: undefined });
  } catch (e) {
    if (e instanceof DriveAuthError) {
      invalidateToken();
      setState({ status: 'needs_auth', detail: undefined });
    } else {
      setState({ status: 'error', error: (e as Error).message, detail: undefined });
    }
  }
}

async function applyLocal(local: Snapshot, merged: Snapshot) {
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.deletions], async () => {
    for (const t of SYNC_TABLES) {
      const before = new Map(local.tables[t].map((r) => [r.id, r]));
      const keep = new Set<string>();
      const puts: Stamped[] = [];
      for (const r of merged.tables[t]) {
        keep.add(r.id);
        const prev = before.get(r.id);
        if (prev && (prev.updatedAt ?? 0) === (r.updatedAt ?? 0)) continue;
        if (t === 'docs' && prev) {
          // Conservar el archivo ya descargado si sigue siendo el mismo
          const p = prev as DocFile, n = r as DocFile;
          if (p.blob && !n.blob && (!n.driveFileId || n.driveFileId === p.driveFileId)) {
            puts.push({ ...n, blob: p.blob } as DocFile);
            continue;
          }
        }
        puts.push(r);
      }
      if (puts.length) await db.table(t).bulkPut(puts);
      const gone = [...before.keys()].filter((id) => !keep.has(id));
      if (gone.length) await db.table(t).bulkDelete(gone);
    }
    await db.deletions.clear();
    await db.deletions.bulkPut(merged.deletions);
  });
}

/** Descarga de Drive un documento que aún no está en este dispositivo. */
export async function fetchDocBlob(doc: DocFile): Promise<Blob> {
  if (doc.blob) return doc.blob;
  if (!doc.driveFileId) throw new Error('El documento no está disponible');
  const token = await getToken(true);
  if (!token) throw new Error('Conéctate a Google Drive');
  try {
    const blob = await new Drive(token).download(doc.driveFileId);
    const typed = blob.type ? blob : new Blob([blob], { type: doc.mime });
    await withRemoteApply(() => db.docs.update(doc.id, { blob: typed }));
    return typed;
  } catch (e) {
    if (e instanceof DriveAuthError) invalidateToken();
    throw e;
  }
}

/** Sincronización automática: al abrir, al volver a la app, tras cambios y cada 5 min. */
let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(false), 4000);
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow(false));
  window.addEventListener('online', () => void syncNow(false));
  setInterval(() => document.visibilityState === 'visible' && void syncNow(false), 5 * 60_000);
  void syncNow(false);
}
