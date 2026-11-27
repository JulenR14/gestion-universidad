import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSubjects } from '../components/common';
import SubjectForm from '../components/SubjectForm';
import AssignmentForm from '../components/AssignmentForm';
import AssignmentList, { sortAssignments } from '../components/AssignmentList';
import DocsPanel from '../components/DocsPanel';
import GradeEditor from '../components/GradeEditor';
import AttendancePanel from '../components/Attendance';
import { DAYS } from '../lib/dates';

const TABS = [
  { k: 'entregas', l: '📋 Entregas' },
  { k: 'documentos', l: '📁 Documentos' },
  { k: 'notas', l: '🎯 Notas' },
  { k: 'asistencia', l: '✋ Asistencia' },
  { k: 'info', l: 'ℹ️ Info' },
];

export default function SubjectDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'entregas';
  const { byId } = useSubjects();
  const subject = useLiveQuery(() => db.subjects.get(id), [id]);
  const assignments = useLiveQuery(() => db.assignments.where('subjectId').equals(id).toArray(), [id]) ?? [];
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  if (subject === undefined) return null;
  if (!subject) return <div className="empty">Asignatura no encontrada.</div>;

  const remove = async () => {
    if (!confirm(`¿Eliminar «${subject.name}» con todas sus entregas, documentos y asistencia? No se puede deshacer.`)) return;
    await db.transaction('rw', [db.subjects, db.assignments, db.docs, db.attendance], async () => {
      await db.assignments.where('subjectId').equals(id).delete();
      await db.docs.where('subjectId').equals(id).delete();
      await db.attendance.where('subjectId').equals(id).delete();
      await db.subjects.delete(id);
    });
    nav('/asignaturas');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row"><span className="dot" style={{ background: subject.color, width: 14, height: 14 }} /><h1>{subject.name}</h1></div>
          <div className="subtitle">{[subject.professor, subject.semester, subject.credits && `${subject.credits} ECTS`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="row">
          {subject.moodleUrl && <a className="btn" href={subject.moodleUrl} target="_blank" rel="noreferrer">🎓 Moodle</a>}
          <button onClick={() => setEditing(true)}>✎ Editar</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.k} className={'tab' + (tab === t.k ? ' active' : '')} onClick={() => setParams({ tab: t.k }, { replace: true })}>{t.l}</button>
        ))}
      </div>

      {tab === 'entregas' && (
        <>
          <div className="row" style={{ marginBottom: 12 }}><span className="spacer" /><button className="primary" onClick={() => setCreating(true)}>+ Nueva entrega</button></div>
          <AssignmentList items={sortAssignments(assignments, byId, 'prioridad')} byId={byId} showSubject={false} empty="Sin entregas registradas en esta asignatura." />
        </>
      )}
      {tab === 'documentos' && <DocsPanel subjectId={id} />}
      {tab === 'notas' && <GradeEditor subject={subject} />}
      {tab === 'asistencia' && <AttendancePanel subject={subject} />}
      {tab === 'info' && (
        <div className="card">
          <p><b>Profesor/a:</b> {subject.professor || '—'} {subject.email && <a href={`mailto:${subject.email}`}>({subject.email})</a>}</p>
          <p><b>Horario:</b> {subject.schedule.length ? subject.schedule.map((c) => `${DAYS[c.day]} ${c.start}–${c.end}${c.room ? ` (${c.room})` : ''}`).join(' · ') : '—'}</p>
          <p><b>Nota para aprobar:</b> {subject.passGrade}</p>
          <label className="field" style={{ marginTop: 12 }}><span>Apuntes sobre la asignatura</span>
            <textarea rows={6} defaultValue={subject.notes ?? ''} placeholder="Criterios del profe, fechas de revisión, recuperaciones..."
              onBlur={(e) => db.subjects.update(id, { notes: e.target.value })} />
          </label>
          <div className="row" style={{ marginTop: 16 }}>
            <button onClick={() => db.subjects.update(id, { archived: !subject.archived })}>{subject.archived ? 'Desarchivar' : '📦 Archivar (fin de semestre)'}</button>
            <span className="spacer" />
            <button className="danger" onClick={remove}>Eliminar asignatura</button>
          </div>
        </div>
      )}

      {editing && <SubjectForm initial={subject} onClose={() => setEditing(false)} />}
      {creating && <AssignmentForm subjectId={id} onClose={() => setCreating(false)} />}
    </>
  );
}
