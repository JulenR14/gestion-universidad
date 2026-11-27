import { db, withRemoteApply, type DocFile } from '../db';

interface BackupDoc extends Omit<DocFile, 'blob'> {
  data?: string; // base64
}

interface Backup {
  app: 'gestion-universidad';
  version: 1;
  exportedAt: string;
  subjects: unknown[];
  assignments: unknown[];
  attendance: unknown[];
  docs: BackupDoc[];
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

const base64ToBlob = (s: string, mime: string) => {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

export async function exportBackup(includeFiles: boolean): Promise<Blob> {
  const docs = await db.docs.toArray();
  const out: Backup = {
    app: 'gestion-universidad',
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: await db.subjects.toArray(),
    assignments: await db.assignments.toArray(),
    attendance: await db.attendance.toArray(),
    docs: await Promise.all(
      docs.map(async ({ blob, ...rest }) => ({
        ...rest,
        ...(includeFiles && blob ? { data: await blobToBase64(blob) } : {}),
      })),
    ),
  };
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

/** Reemplaza todos los datos por los de la copia. */
export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as Backup;
  if (data.app !== 'gestion-universidad') throw new Error('El archivo no es una copia de esta app');
  // Vaciar sin registrar borrados (si no, lo restaurado se borraría al sincronizar)
  await withRemoteApply(() =>
    db.transaction('rw', [db.subjects, db.assignments, db.attendance, db.docs, db.deletions], () =>
      Promise.all([db.subjects.clear(), db.assignments.clear(), db.attendance.clear(), db.docs.clear(), db.deletions.clear()])));
  // Lo restaurado se marca como recién modificado, así gana al sincronizar
  await db.transaction('rw', [db.subjects, db.assignments, db.attendance, db.docs], async () => {
    await db.subjects.bulkAdd(data.subjects as never[]);
    await db.assignments.bulkAdd(data.assignments as never[]);
    await db.attendance.bulkAdd(data.attendance as never[]);
    await db.docs.bulkAdd(
      data.docs.map(({ data: b64, ...d }) => ({ ...d, ...(b64 ? { blob: base64ToBlob(b64, d.mime) } : {}) })),
    );
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
