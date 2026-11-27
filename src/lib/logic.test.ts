import { describe, expect, it } from 'vitest';
import { summarizeGrades } from './grades';
import { priorityScore, urgency } from './priority';
import type { Assignment, GradeComponent } from '../db';

const item = (id: string, grade: number | null, weight = 1, maxScore = 10) => ({ id, name: id, grade, weight, maxScore });

describe('summarizeGrades', () => {
  const scheme = (g1: number | null, g2: number | null, t: number | null): GradeComponent[] => [
    { id: 'p', name: 'Parciales', weight: 60, items: [item('p1', g1), item('p2', g2)] },
    { id: 't', name: 'Trabajos', weight: 40, items: [item('t1', t)] },
  ];

  it('calcula acumulado y nota necesaria', () => {
    const s = summarizeGrades({ passGrade: 5, gradeScheme: scheme(6, null, null) });
    expect(s.accumulated).toBeCloseTo(1.8); // 6 * 30 %
    expect(s.pendingWeight).toBeCloseTo(70);
    expect(s.neededToPass).toBeCloseTo((5 - 1.8) / 0.7);
    expect(s.status).toBe('en_juego');
  });

  it('aprobado y suspenso finales', () => {
    expect(summarizeGrades({ passGrade: 5, gradeScheme: scheme(5, 5, 5) }).status).toBe('aprobado');
    expect(summarizeGrades({ passGrade: 5, gradeScheme: scheme(4, 4, 4) }).status).toBe('suspenso');
  });

  it('respeta nota mínima por bloque', () => {
    const sc = scheme(3, null, 10);
    sc[0].minGrade = 4;
    const s = summarizeGrades({ passGrade: 5, gradeScheme: sc });
    // Para media 4 en parciales con un 3, necesita 5 en el segundo
    expect(s.components[0].neededForMin).toBeCloseTo(5);
    expect(s.neededToPass).toBeCloseTo(5);
    const fail = scheme(4, 3, 10);
    fail[0].minGrade = 4;
    expect(summarizeGrades({ passGrade: 5, gradeScheme: fail }).status).toBe('suspenso');
  });

  it('normaliza notas sobre otra escala', () => {
    const s = summarizeGrades({
      passGrade: 5,
      gradeScheme: [{ id: 'x', name: 'x', weight: 100, items: [item('a', 80, 1, 100)] }],
    });
    expect(s.accumulated).toBeCloseTo(8);
  });
});

describe('prioridad', () => {
  const now = new Date('2026-11-27T10:00:00Z').getTime();
  const a = (daysAhead: number, extra: Partial<Assignment> = {}): Assignment => ({
    id: 'a', subjectId: 's', title: 't', type: 'actividad', status: 'pendiente', subtasks: [], createdAt: 0,
    due: new Date(now + daysAhead * 86400_000).toISOString(), ...extra,
  });

  it('un trabajo importante y largo supera a una actividad pequeña más cercana', () => {
    const big = priorityScore(a(6, { type: 'trabajo', estimatedHours: 20 }), 40, now);
    const small = priorityScore(a(3, { estimatedHours: 1 }), 2, now);
    expect(big).toBeGreaterThan(small);
  });

  it('las vencidas van primero y las entregadas al final', () => {
    expect(priorityScore(a(-1), 5, now)).toBeGreaterThan(priorityScore(a(0.1), 50, now));
    expect(priorityScore(a(1, { status: 'entregada' }), 50, now)).toBe(-1);
    expect(urgency(a(1), now)).toBe('critica');
    expect(urgency(a(5), now)).toBe('alta');
  });
});
