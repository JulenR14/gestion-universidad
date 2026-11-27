import type { Assignment } from '../db';

export type Urgency = 'vencida' | 'critica' | 'alta' | 'media' | 'baja' | 'hecha';

const HOUR = 3600_000;

export function hoursLeft(a: Assignment, now = Date.now()) {
  return (new Date(a.due).getTime() - now) / HOUR;
}

export function progress(a: Assignment) {
  if (a.status === 'entregada') return 1;
  if (!a.subtasks.length) return a.status === 'en_curso' ? 0.25 : 0;
  return a.subtasks.filter((s) => s.done).length / a.subtasks.length;
}

/**
 * Prioridad inteligente: combina tiempo restante, peso en la nota y trabajo pendiente.
 * Cuanto mayor, más urgente.
 *   presión = horas de trabajo que faltan / horas útiles disponibles (~4 h de estudio por día)
 *   score  = (1 + peso/20) * (presión + 1 / días restantes)
 */
export function priorityScore(a: Assignment, weight: number | undefined, now = Date.now()) {
  if (a.status === 'entregada') return -1;
  const h = hoursLeft(a, now);
  if (h <= 0) return 1000 + -h; // vencidas arriba
  const days = Math.max(h / 24, 0.1);
  const remainingWork = (a.estimatedHours ?? defaultHours(a)) * (1 - progress(a));
  const pressure = remainingWork / Math.max(days * 4, 0.5);
  const w = weight ?? 5;
  return (1 + w / 20) * (pressure + 1 / days);
}

function defaultHours(a: Assignment) {
  return { practica: 4, actividad: 2, trabajo: 8, examen: 10, otro: 2 }[a.type];
}

export function urgency(a: Assignment, now = Date.now()): Urgency {
  if (a.status === 'entregada') return 'hecha';
  const h = hoursLeft(a, now);
  if (h < 0) return 'vencida';
  if (h <= 48) return 'critica';
  if (h <= 24 * 7) return 'alta';
  if (h <= 24 * 14) return 'media';
  return 'baja';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  vencida: 'Vencida',
  critica: '< 2 días',
  alta: 'Esta semana',
  media: '< 2 semanas',
  baja: 'Con margen',
  hecha: 'Entregada',
};

export function timeLeftLabel(a: Assignment, now = Date.now()) {
  const h = hoursLeft(a, now);
  const abs = Math.abs(h);
  let s: string;
  if (abs < 1) s = `${Math.round(abs * 60)} min`;
  else if (abs < 48) s = `${Math.round(abs)} h`;
  else s = `${Math.round(abs / 24)} días`;
  return h < 0 ? `hace ${s}` : `en ${s}`;
}
