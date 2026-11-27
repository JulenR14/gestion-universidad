import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSubjects } from '../components/common';
import AssignmentForm from '../components/AssignmentForm';
import AssignmentList, { sortAssignments, type SortMode } from '../components/AssignmentList';

type Filter = 'pendientes' | 'entregadas' | 'todas';

export default function Assignments() {
  const { active, byId } = useSubjects();
  const all = useLiveQuery(() => db.assignments.toArray(), []) ?? [];
  const [filter, setFilter] = useState<Filter>('pendientes');
  const [subject, setSubject] = useState('');
  const [sort, setSort] = useState<SortMode>(() => {
    try { return (localStorage.getItem('sort') as SortMode) || 'prioridad'; } catch { return 'prioridad'; }
  });
  const [creating, setCreating] = useState(false);

  const changeSort = (m: SortMode) => {
    setSort(m);
    try { localStorage.setItem('sort', m); } catch { /* sin almacenamiento */ }
  };

  const list = sortAssignments(
    all.filter((a) =>
      (filter === 'todas' || (filter === 'entregadas' ? a.status === 'entregada' : a.status !== 'entregada')) &&
      (!subject || a.subjectId === subject) &&
      !byId.get(a.subjectId)?.archived),
    byId, sort,
  );

  return (
    <>
      <div className="page-head">
        <div><h1>Entregas</h1><div className="subtitle">Prácticas, actividades, trabajos y exámenes</div></div>
        <button className="primary" onClick={() => setCreating(true)}>+ Nueva entrega</button>
      </div>

      <div className="row wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div className="chips">
          {(['pendientes', 'entregadas', 'todas'] as Filter[]).map((f) => (
            <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="">Todas las asignaturas</option>
          {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="spacer" />
        <div className="chips" title="La prioridad inteligente combina fecha, peso en la nota y trabajo restante">
          <span className="muted small" style={{ alignSelf: 'center' }}>Ordenar:</span>
          <button className={'chip' + (sort === 'prioridad' ? ' active' : '')} onClick={() => changeSort('prioridad')}>🧠 Prioridad</button>
          <button className={'chip' + (sort === 'fecha' ? ' active' : '')} onClick={() => changeSort('fecha')}>📅 Fecha</button>
        </div>
      </div>

      <AssignmentList items={list} byId={byId}
        empty={filter === 'pendientes' ? '🎉 No tienes entregas pendientes.' : 'No hay entregas.'} />

      {creating && <AssignmentForm subjectId={subject || undefined} onClose={() => setCreating(false)} />}
    </>
  );
}
