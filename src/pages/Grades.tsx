import { Link } from 'react-router-dom';
import { useSubjects } from '../components/common';
import { Verdict } from '../components/GradeEditor';
import { fmt, summarizeGrades } from '../lib/grades';

export default function Grades() {
  const { active } = useSubjects();
  const rows = active.map((s) => ({ s, g: summarizeGrades(s) }));
  const finished = rows.filter((r) => r.g.pendingWeight === 0 && r.g.gradedWeight > 0);
  const credits = finished.reduce((a, r) => a + (r.s.credits ?? 1), 0);
  const weighted = credits ? finished.reduce((a, r) => a + r.g.accumulated * (r.s.credits ?? 1), 0) / credits : null;

  return (
    <>
      <div className="page-head">
        <div><h1>Notas</h1><div className="subtitle">Cómo vas en cada asignatura y qué necesitas para aprobar</div></div>
      </div>
      <div className="stats">
        <div className="stat"><div className="v">{rows.filter((r) => r.g.status === 'aprobado').length}/{rows.length}</div><div className="l">Asignaturas aprobadas</div></div>
        <div className="stat"><div className="v">{fmt(weighted)}</div><div className="l">Media de las terminadas (por créditos)</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--danger)' }}>{rows.filter((r) => r.g.status === 'suspenso').length}</div><div className="l">En riesgo</div></div>
      </div>
      {rows.length === 0 && <div className="card empty">Añade asignaturas para ver tus notas.</div>}
      <div className="grid grid-2">
        {rows.map(({ s, g }) => (
          <Link key={s.id} to={`/asignaturas/${s.id}?tab=notas`} className="card s-card" style={{ ['--c' as string]: s.color, color: 'inherit' }}>
            <div className="row"><b>{s.name}</b><span className="spacer" /><span className="grade" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmt(g.accumulated)}</span></div>
            <div className="progress" style={{ margin: '10px 0' }}><div style={{ width: `${g.gradedWeight}%`, background: s.color }} /></div>
            <div className="muted small" style={{ marginBottom: 10 }}>
              {fmt(g.gradedWeight, 0)} % evaluado · media {fmt(g.currentAverage)} · máx. posible {fmt(g.maxReachable)}
            </div>
            <Verdict g={g} pass={s.passGrade} />
          </Link>
        ))}
      </div>
    </>
  );
}
