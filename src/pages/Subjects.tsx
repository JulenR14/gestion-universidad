import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSubjects } from '../components/common';
import SubjectForm from '../components/SubjectForm';
import { fmt, summarizeGrades } from '../lib/grades';
import { DAYS } from '../lib/dates';

export default function Subjects() {
  const { all } = useSubjects();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const nav = useNavigate();
  const pending = useLiveQuery(() => db.assignments.where('status').notEqual('entregada').toArray(), []) ?? [];

  const list = all.filter((s) => s.archived === showArchived);
  const bySemester = new Map<string, typeof list>();
  for (const s of list) bySemester.set(s.semester, [...(bySemester.get(s.semester) ?? []), s]);
  const semesters = [...bySemester.keys()].sort().reverse();

  return (
    <>
      <div className="page-head">
        <div><h1>Asignaturas</h1><div className="subtitle">Documentos, entregas, notas y asistencia de cada asignatura</div></div>
        <div className="row">
          <button onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Ver activas' : 'Ver archivadas'}</button>
          <button className="primary" onClick={() => setCreating(true)}>+ Nueva asignatura</button>
        </div>
      </div>

      {list.length === 0 && (
        <div className="card empty">
          {showArchived ? 'No hay asignaturas archivadas.' : <>
            <p>Empieza añadiendo las asignaturas de este semestre.</p>
            <button className="primary" onClick={() => setCreating(true)}>+ Añadir la primera</button>
          </>}
        </div>
      )}

      {semesters.map((sem) => (
        <section key={sem} style={{ marginBottom: 24 }}>
          <h2 className="muted">{sem}</h2>
          <div className="grid grid-3">
            {bySemester.get(sem)!.map((s) => {
              const g = summarizeGrades(s);
              const p = pending.filter((a) => a.subjectId === s.id).length;
              return (
                <div key={s.id} className="card s-card" style={{ ['--c' as string]: s.color }} onClick={() => nav(`/asignaturas/${s.id}`)}>
                  <div className="row"><b style={{ fontSize: '1.05rem' }}>{s.name}</b></div>
                  <div className="muted small">{s.professor || 'Sin profesor/a'}{s.credits ? ` · ${s.credits} ECTS` : ''}</div>
                  <div className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
                    <div>
                      <div className="grade">{fmt(g.accumulated, 2)}</div>
                      <div className="muted small">puntos acumulados</div>
                    </div>
                    <span className="spacer" />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{p}</div>
                      <div className="muted small">entregas pendientes</div>
                    </div>
                  </div>
                  {s.schedule.length > 0 && (
                    <div className="muted small" style={{ marginTop: 10 }}>
                      {s.schedule.map((c) => `${DAYS[c.day].slice(0, 3)} ${c.start}`).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {creating && <SubjectForm onClose={() => setCreating(false)} onSaved={(s) => nav(`/asignaturas/${s.id}`)} />}
    </>
  );
}
