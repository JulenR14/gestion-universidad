import type { GradeComponent, GradeItem, Subject } from '../db';

/** Nota de un item normalizada a 0-10. */
export const norm10 = (it: GradeItem) =>
  it.grade == null ? null : (it.grade / (it.maxScore || 10)) * 10;

/** Peso efectivo de cada item sobre la nota final (0-100). */
export function effectiveWeights(c: GradeComponent): Map<string, number> {
  const total = c.items.reduce((s, i) => s + (i.weight > 0 ? i.weight : 0), 0);
  const m = new Map<string, number>();
  for (const i of c.items) m.set(i.id, total > 0 ? (c.weight * Math.max(i.weight, 0)) / total : 0);
  return m;
}

export interface ComponentSummary {
  component: GradeComponent;
  /** Media actual del bloque con lo evaluado (0-10), null si nada evaluado. */
  average: number | null;
  gradedWeight: number; // % del final ya evaluado en este bloque
  pendingWeight: number; // % del final pendiente en este bloque
  /** Media necesaria en lo que falta del bloque para llegar a minGrade. */
  neededForMin: number | null;
  failsMin: boolean; // ya imposible llegar al mínimo
}

export interface GradeSummary {
  totalWeight: number; // suma de pesos de bloques (debería ser 100)
  /** Puntos ya asegurados sobre 10 (lo que llevas en la final). */
  accumulated: number;
  /** Media sobre lo evaluado hasta ahora (0-10). */
  currentAverage: number | null;
  gradedWeight: number;
  pendingWeight: number;
  /** Media que necesitas en todo lo pendiente para aprobar. */
  neededToPass: number | null;
  status: 'aprobado' | 'suspenso' | 'en_juego' | 'sin_datos';
  /** Nota máxima alcanzable sacando 10 en todo lo que falta. */
  maxReachable: number;
  components: ComponentSummary[];
}

function summarizeComponent(c: GradeComponent): ComponentSummary {
  const w = effectiveWeights(c);
  let gw = 0, pw = 0, pts = 0;
  for (const it of c.items) {
    const ew = w.get(it.id) ?? 0;
    const g = norm10(it);
    if (g == null) pw += ew;
    else { gw += ew; pts += g * ew; }
  }
  const average = gw > 0 ? pts / gw : null;
  let neededForMin: number | null = null;
  let failsMin = false;
  if (c.minGrade != null && c.minGrade > 0) {
    const totalW = gw + pw;
    if (pw > 0) {
      neededForMin = Math.max(0, (c.minGrade * totalW - pts) / pw);
      failsMin = neededForMin > 10;
    } else if (totalW > 0) {
      failsMin = (average ?? 0) < c.minGrade;
    }
  }
  return { component: c, average, gradedWeight: gw, pendingWeight: pw, neededForMin, failsMin };
}

export function summarizeGrades(s: Pick<Subject, 'gradeScheme' | 'passGrade'>): GradeSummary {
  const components = s.gradeScheme.map(summarizeComponent);
  const totalWeight = s.gradeScheme.reduce((a, c) => a + c.weight, 0);
  let gw = 0, pw = 0, pts = 0;
  for (const cs of components) {
    gw += cs.gradedWeight;
    pw += cs.pendingWeight;
    pts += (cs.average ?? 0) * cs.gradedWeight;
  }
  const accumulated = pts / 100;
  const currentAverage = gw > 0 ? pts / gw : null;
  const maxReachable = accumulated + (pw * 10) / 100;
  const pass = s.passGrade || 5;
  const anyMinFail = components.some((c) => c.failsMin);

  let neededToPass: number | null = null;
  let status: GradeSummary['status'];
  if (gw === 0 && pw === 0) status = 'sin_datos';
  else if (anyMinFail) status = 'suspenso';
  else if (pw === 0) status = accumulated >= pass - 1e-9 ? 'aprobado' : 'suspenso';
  else {
    neededToPass = Math.max(0, ((pass - accumulated) * 100) / pw);
    // Los mínimos por bloque pueden exigir más que la media global
    for (const c of components) {
      if (c.neededForMin != null && c.pendingWeight > 0) neededToPass = Math.max(neededToPass, c.neededForMin);
    }
    if (neededToPass > 10 + 1e-9) status = 'suspenso';
    else if (accumulated >= pass - 1e-9 && components.every((c) => c.neededForMin == null || c.neededForMin === 0))
      status = 'aprobado';
    else status = 'en_juego';
  }
  return { totalWeight, accumulated, currentAverage, gradedWeight: gw, pendingWeight: pw, neededToPass, status, maxReachable, components };
}

/** Peso (%) en la nota final de un item concreto. */
export function itemFinalWeight(s: Subject, itemId: string): number | undefined {
  for (const c of s.gradeScheme) {
    const w = effectiveWeights(c).get(itemId);
    if (w != null) return w;
  }
  return undefined;
}

export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });
