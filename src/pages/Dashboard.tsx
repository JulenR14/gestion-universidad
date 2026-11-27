import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSubjects } from '../components/common';
import AssignmentForm from '../components/AssignmentForm';
import AssignmentList, { sortAssignments } from '../components/AssignmentList';
import { AttendanceButtons, attendanceStats } from '../components/Attendance';
import { hoursLeft } from '../lib/priority';
import { fmt, summarizeGrades } from '../lib/grades';
import { DAYS, MONTHS, weekday, ymd } from '../lib/dates';

export default function Dashboard() {
  const { active, byId } = useSubjects();
  const nav = useNavigate();
  const assignments = useLiveQuery(() => db.assignments.where('status').notEqual('entregada').toArray(), []) ?? [];
  const today = ymd(new Date());
  const todayAtt = useLiveQuery(() => db.attendance.where('date').equals(today).toArray(), [today]) ?? [];
  const allAtt = useLiveQuery(() => db.attendance.toArray(), []) ?? [];
  const [creating, setCreating] = useState(false);

  const pending = assignments.filter((a) => !byId.get(a.subjectId)?.archived);
  const overdue = pending.filter((a) => hoursLeft(a) < 0).length;
  const next48 = pending.filter((a) => hoursLeft(a) >= 0 && hoursLeft(a) <= 48).length;
  const week = pending.filter((a) => hoursLeft(a) >= 0 && hoursLeft(a) <= 24 * 7).length;
  const top = sortAssignments(pending, byId, 'prioridad').slice(0, 8);

  const now = new Date();
  const wd = weekday(now);
  const classes = active
    .flatMap((s) => s.schedule.filter((c) => c.day === wd).map((c) => ({ s, c })))
    .sort((a, b) => a.c.start.localeCompare(b.c.start));

  const atRisk = active.filter((s) => {
    const g = summarizeGrades(s);
    const att = s.attendance.tracked ? attendanceStats(s, allAtt.filter((r) => r.subjectId === s.id)) : null;
    return g.status === 'suspenso' || (g.neededToPass ?? 0) > 7 || att?.risk;
  });

  const hello = now.getHours() < 14 ? 'Buenos días' : now.getHours() < 21 ? 'Buenas tardes' : 'Buenas noches';

  if (active.length === 0) {
    return (
      <div className="card empty" style={{ marginTop: 40 }}>
        <h1>👋 Bienvenido/a</h1>
        <p>Empieza creando las asignaturas de este semestre. Después podrás añadir entregas, documentos, notas y asistencia.</p>
        <button className="primary" onClick={() => nav('/asignaturas')}>Crear mis asignaturas</button>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{hello}</h1>
          <div className="subtitle">{DAYS[wd]}, {now.getDate()} de {MONTHS[now.getMonth()].toLowerCase()}</div>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>+ Nueva entrega</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="v" style={{ color: overdue ? 'var(--danger)' : undefined }}>{overdue}</div><div className="l">Vencidas</div></div>
        <div className="stat"><div className="v" style={{ color: next48 ? 'var(--warn)' : undefined }}>{next48}</div><div className="l">En las próximas 48 h</div></div>
        <div className="stat"><div className="v">{week}</div><div className="l">Esta semana</div></div>
        <div className="stat"><div className="v">{pending.length}</div><div className="l">Pendientes en total</div></div>
      </div>

      <div className="grid dash-grid">
        <div className="card" style={{ minWidth: 0 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>🧠 Qué hacer primero</h2><span className="spacer" />
            <Link to="/entregas" className="small">Ver todas →</Link>
          </div>
          <AssignmentList items={top} byId={byId} empty="🎉 Nada pendiente. ¡Buen trabajo!" />
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="card">
            <h2>📍 Clases de hoy</h2>
            {classes.length === 0 && <div className="muted">Hoy no tienes clases.</div>}
            {classes.map(({ s, c }) => (
              <div key={s.id + c.start} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="dot" style={{ background: s.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="muted small">{c.start}–{c.end}{c.room ? ` · ${c.room}` : ''}</div>
                </div>
                {s.attendance.tracked && (
                  <AttendanceButtons subjectId={s.id} date={today} start={c.start}
                    record={todayAtt.find((r) => r.subjectId === s.id && (r.start ?? '') === c.start)} />
                )}
              </div>
            ))}
          </div>

          <div className="card">
            <h2>🎯 Notas</h2>
            {active.map((s) => {
              const g = summarizeGrades(s);
              return (
                <Link key={s.id} to={`/asignaturas/${s.id}?tab=notas`} className="row" style={{ color: 'inherit', padding: '6px 0' }}>
                  <span className="dot" style={{ background: s.color }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <b>{fmt(g.accumulated)}</b>
                  <span className="muted small" style={{ width: 92, textAlign: 'right' }}>
                    {g.status === 'aprobado' ? '✅ aprobada' : g.status === 'suspenso' ? '⚠️ en riesgo' : g.neededToPass != null ? `necesitas ${fmt(g.neededToPass, 1)}` : 'sin notas'}
                  </span>
                </Link>
              );
            })}
          </div>

          {atRisk.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
              <h2>⚠️ Atención</h2>
              {atRisk.map((s) => <div key={s.id}><Link to={`/asignaturas/${s.id}`}>{s.name}</Link> <span className="muted small">— revisa notas o asistencia</span></div>)}
            </div>
          )}
        </div>
      </div>

      {creating && <AssignmentForm onClose={() => setCreating(false)} />}
    </>
  );
}
