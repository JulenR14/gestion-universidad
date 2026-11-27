import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Assignment } from '../db';
import { useSubjects } from '../components/common';
import AssignmentForm from '../components/AssignmentForm';
import AssignmentList, { sortAssignments } from '../components/AssignmentList';
import { DAYS_SHORT, MONTHS, weekday, ymd } from '../lib/dates';

export default function CalendarPage() {
  const { byId } = useSubjects();
  const all = useLiveQuery(() => db.assignments.toArray(), []) ?? [];
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const visible = all.filter((a) => !byId.get(a.subjectId)?.archived);
  const byDay = new Map<string, Assignment[]>();
  for (const a of visible) {
    const k = ymd(new Date(a.due));
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }

  const first = new Date(cursor);
  const start = new Date(first);
  start.setDate(1 - weekday(first));
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = ymd(new Date());
  const move = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  const selList = selected ? sortAssignments(byDay.get(selected) ?? [], byId, 'fecha') : [];

  return (
    <>
      <div className="page-head">
        <div><h1>Calendario</h1><div className="subtitle">Todas tus entregas por fecha</div></div>
        <div className="row">
          <button onClick={() => move(-1)}>←</button>
          <b style={{ minWidth: 150, textAlign: 'center' }}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</b>
          <button onClick={() => move(1)}>→</button>
          <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(today); }}>Hoy</button>
        </div>
      </div>

      <div className="cal">
        {DAYS_SHORT.map((d) => <div key={d} className="cal-h">{d}</div>)}
        {cells.map((d) => {
          const k = ymd(d);
          const items = byDay.get(k) ?? [];
          return (
            <div key={k} onClick={() => setSelected(k)}
              className={'cal-d' + (d.getMonth() !== cursor.getMonth() ? ' out' : '') + (k === today ? ' today' : '')}
              style={selected === k ? { background: 'var(--primary-soft)' } : undefined}>
              <span className="cal-n">{d.getDate()}</span>
              {items.map((a) => (
                <div key={a.id} className={'cal-e' + (a.status === 'entregada' ? ' done' : '')}
                  style={{ ['--c' as string]: byId.get(a.subjectId)?.color }}
                  title={a.title}
                  onClick={(e) => { e.stopPropagation(); setEditing(a); }}>
                  {a.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{new Date(selected + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <AssignmentList items={selList} byId={byId} empty="Sin entregas este día." />
        </div>
      )}

      {editing && <AssignmentForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
