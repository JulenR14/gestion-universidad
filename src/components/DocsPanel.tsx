import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type DocFile } from '../db';
import { formatSize } from '../lib/dates';
import { downloadBlob } from '../lib/backup';
import { fetchDocBlob } from '../lib/sync';
import { Modal } from './common';

const ext = (name: string) => (name.includes('.') ? name.split('.').pop()!.slice(0, 4).toUpperCase() : 'DOC');

export default function DocsPanel({ subjectId }: { subjectId: string }) {
  const docs = useLiveQuery(() => db.docs.where('subjectId').equals(subjectId).toArray(), [subjectId]) ?? [];
  const [folder, setFolder] = useState('General');
  const [over, setOver] = useState(false);
  const [q, setQ] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [moving, setMoving] = useState<DocFile | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => {
    const f = new Set(docs.map((d) => d.folder));
    f.add('General');
    return [...f].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [docs]);

  const grouped = useMemo(() => {
    const m = new Map<string, DocFile[]>();
    for (const d of docs) {
      if (q && !d.name.toLowerCase().includes(q.toLowerCase())) continue;
      m.set(d.folder, [...(m.get(d.folder) ?? []), d]);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
  }, [docs, q]);

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].map<DocFile>((f) => ({
      id: uid(), subjectId, name: f.name, folder: folder.trim() || 'General', mime: f.type || 'application/octet-stream',
      size: f.size, blob: f, addedAt: Date.now(),
    }));
    await db.docs.bulkAdd(list);
  };

  const [loading, setLoading] = useState<string | null>(null);

  /** Abre el documento; si solo está en Drive lo descarga primero. */
  const open = async (d: DocFile, download = false) => {
    if (d.url) return void window.open(d.url, '_blank', 'noopener');
    // La ventana se abre ya, dentro del clic, para que el móvil no la bloquee
    const win = !download && !d.blob ? window.open('', '_blank') : null;
    try {
      setLoading(d.id);
      const blob = await fetchDocBlob(d);
      if (download) return downloadBlob(blob, d.name);
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      win?.close();
      alert((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const total = docs.reduce((s, d) => s + d.size, 0);

  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <label className="field" style={{ minWidth: 200 }}>
          <span>Guardar en la carpeta</span>
          <input list="folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Tema 1, Prácticas..." />
          <datalist id="folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
        <span className="spacer" />
        <button onClick={() => setLinkOpen(true)}>🔗 Añadir enlace</button>
      </div>
      <div
        className={'drop' + (over ? ' over' : '')}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
      >
        <b>Arrastra aquí los archivos de Moodle</b> o haz clic para elegirlos
        <div className="small">Se guardan en esta app (en tu dispositivo), en la carpeta «{folder || 'General'}»</div>
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {docs.length > 0 && (
        <div className="row" style={{ marginTop: 14 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento..." style={{ maxWidth: 280 }} />
          <span className="spacer" />
          <span className="muted small">{docs.length} documentos · {formatSize(total)}</span>
        </div>
      )}
      {docs.length === 0 && <div className="empty">Aún no hay documentos. Ve guardando aquí los apuntes, enunciados y guías.</div>}

      {grouped.map(([f, list]) => (
        <div key={f}>
          <div className="folder-h">📁 {f} <span className="muted small">({list.length})</span></div>
          {list.map((d) => (
            <div className="doc-row" key={d.id}>
              <div className="doc-ico">{d.url ? '🔗' : ext(d.name)}</div>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => open(d)}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                <div className="muted small">
                  {d.url ? d.url : formatSize(d.size)} · {new Date(d.addedAt).toLocaleDateString('es-ES')}
                  {!d.url && (loading === d.id ? ' · ⏳ descargando…' : d.blob ? (d.driveFileId ? ' · ☁️ en Drive' : '') : ' · ☁️ solo en Drive')}
                </div>
              </div>
              {!d.url && <button className="ghost sm" title="Descargar" onClick={() => open(d, true)}>⬇</button>}
              <button className="ghost sm" title="Mover / renombrar" onClick={() => setMoving(d)}>✎</button>
              <button className="ghost sm danger" title="Eliminar" onClick={() => confirm(`¿Eliminar «${d.name}»?`) && db.docs.delete(d.id)}>🗑</button>
            </div>
          ))}
        </div>
      ))}

      {linkOpen && <LinkModal folder={folder} subjectId={subjectId} onClose={() => setLinkOpen(false)} />}
      {moving && <EditDocModal doc={moving} folders={folders} onClose={() => setMoving(null)} />}
    </div>
  );
}

function LinkModal({ folder, subjectId, onClose }: { folder: string; subjectId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const save = async () => {
    await db.docs.add({ id: uid(), subjectId, name: name || url, url, folder: folder || 'General', mime: 'text/uri-list', size: 0, addedAt: Date.now() });
    onClose();
  };
  return (
    <Modal title="Añadir enlace" onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!url} onClick={save}>Añadir</button></>}>
      <div className="form-grid">
        <label className="field"><span>Nombre</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vídeo tema 3" /></label>
        <label className="field"><span>URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></label>
      </div>
    </Modal>
  );
}

function EditDocModal({ doc, folders, onClose }: { doc: DocFile; folders: string[]; onClose: () => void }) {
  const [name, setName] = useState(doc.name);
  const [folder, setFolder] = useState(doc.folder);
  const save = async () => { await db.docs.update(doc.id, { name, folder: folder.trim() || 'General' }); onClose(); };
  return (
    <Modal title="Editar documento" onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button className="primary" onClick={save}>Guardar</button></>}>
      <div className="form-grid">
        <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Carpeta</span>
          <input list="folders-edit" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <datalist id="folders-edit">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
      </div>
    </Modal>
  );
}
