import type { Deletion, Stamped, SyncTable } from '../db';
import { SYNC_TABLES } from '../db';

export interface Snapshot {
  tables: Record<SyncTable, Stamped[]>;
  deletions: Deletion[];
}

export const emptySnapshot = (): Snapshot => ({
  tables: { subjects: [], assignments: [], docs: [], attendance: [] },
  deletions: [],
});

const DELETION_TTL = 1000 * 60 * 60 * 24 * 365; // se recuerdan los borrados un año

/**
 * Fusiona dos copias registro a registro: gana la modificación más reciente
 * y un borrado gana si es posterior (o igual) a la última modificación.
 */
export function mergeSnapshots(a: Snapshot, b: Snapshot, now = Date.now()): Snapshot {
  const dels = new Map<string, Deletion>();
  for (const d of [...a.deletions, ...b.deletions]) {
    if (now - d.at > DELETION_TTL) continue;
    const prev = dels.get(d.key);
    if (!prev) dels.set(d.key, d);
    else dels.set(d.key, { ...(d.at >= prev.at ? d : prev), driveDone: prev.driveDone || d.driveDone });
  }

  const out = emptySnapshot();
  for (const t of SYNC_TABLES) {
    const m = new Map<string, Stamped>();
    for (const r of [...a.tables[t], ...b.tables[t]]) {
      const prev = m.get(r.id);
      if (!prev || (r.updatedAt ?? 0) > (prev.updatedAt ?? 0)) m.set(r.id, r);
    }
    for (const r of m.values()) {
      const d = dels.get(`${t}:${r.id}`);
      if (d && d.at >= (r.updatedAt ?? 0)) continue;
      if (d) dels.delete(d.key); // se volvió a crear después del borrado
      out.tables[t].push(r);
    }
  }
  out.deletions = [...dels.values()];
  return out;
}

/** Versión estable para comparar si algo cambió. */
export function fingerprint(s: Snapshot): string {
  const sortById = <T extends { id?: string; key?: string }>(xs: T[]) =>
    [...xs].sort((x, y) => String(x.id ?? x.key).localeCompare(String(y.id ?? y.key)));
  return JSON.stringify({
    t: SYNC_TABLES.map((t) => sortById(s.tables[t]).map((r) => [r.id, r.updatedAt ?? 0])),
    d: sortById(s.deletions).map((d) => [d.key, d.at, !!d.driveDone]),
  });
}
