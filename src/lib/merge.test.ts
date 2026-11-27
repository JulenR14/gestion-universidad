import { describe, expect, it } from 'vitest';
import { emptySnapshot, fingerprint, mergeSnapshots } from './merge';
import type { Deletion } from '../db';

const snap = (subjects: { id: string; updatedAt?: number; name?: string }[], deletions: Deletion[] = []) => {
  const s = emptySnapshot();
  s.tables.subjects = subjects;
  s.deletions = deletions;
  return s;
};
const del = (id: string, at: number, extra: Partial<Deletion> = {}): Deletion => ({ key: `subjects:${id}`, table: 'subjects', id, at, ...extra });
const NOW = 1000;

describe('mergeSnapshots', () => {
  it('une registros de los dos lados', () => {
    const m = mergeSnapshots(snap([{ id: 'a', updatedAt: 1 }]), snap([{ id: 'b', updatedAt: 1 }]), NOW);
    expect(m.tables.subjects.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('gana la modificación más reciente', () => {
    const pc = snap([{ id: 'a', updatedAt: 10, name: 'PC' } as never]);
    const movil = snap([{ id: 'a', updatedAt: 20, name: 'Móvil' } as never]);
    expect((mergeSnapshots(pc, movil, NOW).tables.subjects[0] as unknown as { name: string }).name).toBe('Móvil');
    expect((mergeSnapshots(movil, pc, NOW).tables.subjects[0] as unknown as { name: string }).name).toBe('Móvil');
  });

  it('un borrado posterior elimina el registro en el otro dispositivo', () => {
    const m = mergeSnapshots(snap([{ id: 'a', updatedAt: 10 }]), snap([], [del('a', 15)]), NOW);
    expect(m.tables.subjects).toHaveLength(0);
    expect(m.deletions).toHaveLength(1);
  });

  it('una edición posterior al borrado lo recupera', () => {
    const m = mergeSnapshots(snap([{ id: 'a', updatedAt: 20 }]), snap([], [del('a', 15)]), NOW);
    expect(m.tables.subjects).toHaveLength(1);
    expect(m.deletions).toHaveLength(0);
  });

  it('registros antiguos sin marca de tiempo se conservan', () => {
    const m = mergeSnapshots(snap([{ id: 'a' }]), emptySnapshot(), NOW);
    expect(m.tables.subjects).toHaveLength(1);
  });

  it('recuerda que el archivo de Drive ya se borró', () => {
    const m = mergeSnapshots(snap([], [del('a', 5, { driveFileId: 'f', driveDone: true })]), snap([], [del('a', 5, { driveFileId: 'f' })]), NOW);
    expect(m.deletions[0].driveDone).toBe(true);
  });

  it('es estable: fusionar dos veces no cambia nada', () => {
    const a = snap([{ id: 'a', updatedAt: 1 }, { id: 'c', updatedAt: 3 }], [del('x', 2)]);
    const b = snap([{ id: 'b', updatedAt: 2 }]);
    const m = mergeSnapshots(a, b, NOW);
    expect(fingerprint(mergeSnapshots(m, b, NOW))).toBe(fingerprint(m));
  });
});
