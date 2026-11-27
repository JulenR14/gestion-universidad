import { useState } from 'react';
import { db, TYPE_LABEL, type Assignment, type Subject } from '../db';
import { formatDue } from '../lib/dates';
import { fmt, itemFinalWeight } from '../lib/grades';
import { priorityScore, progress, timeLeftLabel, urgency, URGENCY_LABEL } from '../lib/priority';
import AssignmentForm from './AssignmentForm';

export type SortMode = 'prioridad' | 'fecha';

export function weightOf(a: Assignment, s?: Subject) {
  return a.gradeItemId && s ? itemFinalWeight(s, a.gradeItemId) ?? a.weight : a.weight;
}

export function sortAssignments(list: Assignment[], byId: Map<string, Subject>, mode: SortMode) {
  const now = Date.now();
  const done = (a: Assignment) => (a.status === 'entregada' ? 1 : 0);
  return [...list].sort((a, b) => {
    if (done(a) !== done(b)) return done(a) - done(b);
    if (done(a)) return new Date(b.due).getTime() - new Date(a.due).getTime();
    if (mode === 'fecha') return new Date(a.due).getTime() - new Date(b.due).getTime();
    return priorityScore(b, weightOf(b, byId.get(b.subjectId)), now) - priorityScore(a, weightOf(a, byId.get(a.subjectId)), now);
  });
}

export default function AssignmentList({ items, byId, showSubject = true, empty }: {
  items: Assignment[]; byId: Map<string, Subject>; showSubject?: boolean; empty?: string;
}) {
  const [editing, setEditing] = useState<Assignment | null>(null);

  const toggleDone = (a: Assignment) =>
    db.assignments.update(a.id, a.status === 'entregada'
      ? { status: 'pendiente', completedAt: undefined }
      : { status: 'entregada', completedAt: Date.now() });

  if (!items.length) return <div className="empty">{empty ?? 'No hay entregas.'}</div>;

  return (
    <div className="a-list">
      {items.map((a) => {
        const s = byId.get(a.subjectId);
        const u = urgency(a);
        const w = weightOf(a, s);
        const p = progress(a);
        return (
          <div key={a.id} className={'a-row' + (a.status === 'entregada' ? ' done' : '')} style={{ ['--c' as string]: s?.color }} onClick={() => setEditing(a)}>
            <input
              type="checkbox"
              title="Marcar como entregada"
              checked={a.status === 'entregada'}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleDone(a)}
            />
            <div className="a-main">
              <div className="a-title">{a.title}</div>
              <div className="a-meta">
                {showSubject && <span style={{ color: s?.color, fontWeight: 600 }}>{s?.shortName || s?.name}</span>}
                <span>{TYPE_LABEL[a.type]}</span>
                <span>{formatDue(a.due)}</span>
                {w != null && <span>{fmt(w, 1)} % nota</span>}
                {a.subtasks.length > 0 && <span>✓ {a.subtasks.filter((x) => x.done).length}/{a.subtasks.length}</span>}
                {a.status === 'en_curso' && <span>⏳ En curso</span>}
              </div>
              {a.subtasks.length > 0 && a.status !== 'entregada' && (
                <div className="progress" style={{ marginTop: 6, maxWidth: 240 }}><div style={{ width: `${p * 100}%` }} /></div>
              )}
            </div>
            <div className="a-right">
              <span className={`badge b-${u}`}>{URGENCY_LABEL[u]}</span>
              {a.status !== 'entregada' && <span className="muted small">{timeLeftLabel(a)}</span>}
            </div>
          </div>
        );
      })}
      {editing && <AssignmentForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
