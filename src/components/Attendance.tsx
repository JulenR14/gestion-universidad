import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type AttendanceRecord, type AttendanceStatus, type Subject } from '../db';
import { formatDate, weekday, ymd } from '../lib/dates';
import { fmt } from '../lib/grades';

const LABEL: Record<AttendanceStatus, string> = { asistido: 'Asistí', falta: 'Falté', justificada: 'Justificada' };

export async function setAttendance(subjectId: string, date: string, start: string | undefined, status: AttendanceStatus | null) {
  const existing = await db.attendance.where('[subjectId+date]').equals([subjectId, date]).filter((r) => (r.start ?? '') === (start ?? '')).first();
  if (status == null) {
    if (existing) await db.attendance.delete(existing.id);
  } else if (existing) {
    await db.attendance.update(existing.id, { status });
  } else {
    await db.attendance.add({ id: uid(), subjectId, date, start, status });
  }
}

export function AttendanceButtons({ subjectId, date, start, record }: { subjectId: string; date: string; start?: string; record?: AttendanceRecord }) {
  return (
    <div className="att-btns">
      {(['asistido', 'falta', 'justificada'] as AttendanceStatus[]).map((st) => (
        <button key={st} className={'sm' + (record?.status === st ? ` sel-${st}` : '')} title={LABEL[st]} aria-label={LABEL[st]}
          onClick={() => setAttendance(subjectId, date, start, record?.status === st ? null : st)}>
          {st === 'asistido' ? '✓' : st === 'falta' ? '✕' : 'J'}
        </button>
      ))}
    </div>
  );
}

export function attendanceStats(s: Subject, recs: AttendanceRecord[]) {
  const asist = recs.filter((r) => r.status === 'asistido').length;
  const faltas = recs.filter((r) => r.status === 'falta').length;
  const just = recs.filter((r) => r.status === 'justificada').length;
  const total = recs.length;
  const percent = total ? ((asist + just) / total) * 100 : null;
  const min = s.attendance.minPercent;
  const sessions = s.attendance.totalSessions;
  const maxFaltas = min != null && sessions ? Math.floor(sessions * (1 - min / 100)) : null;
  const remaining = maxFaltas != null ? maxFaltas - faltas : null;
  const risk = (min != null && percent != null && percent < min) || (remaining != null && remaining < 0);
  return { asist, faltas, just, total, percent, maxFaltas, remaining, risk };
}

/** Clases del horario en los últimos `days` días (incluido hoy). */
export function pastSessions(s: Subject, days = 14) {
  const out: { date: string; start: string; end: string }[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    for (const c of s.schedule) if (c.day === weekday(d)) out.push({ date: ymd(d), start: c.start, end: c.end });
  }
  return out;
}

export default function AttendancePanel({ subject }: { subject: Subject }) {
  const recs = useLiveQuery(() => db.attendance.where('subjectId').equals(subject.id).toArray(), [subject.id]) ?? [];
  const [date, setDate] = useState(ymd(new Date()));
  const st = attendanceStats(subject, recs);
  const find = (date: string, start?: string) => recs.find((r) => r.date === date && (r.start ?? '') === (start ?? ''));
  const unrecorded = pastSessions(subject).filter((p) => !find(p.date, p.start));
  const sorted = [...recs].sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? '').localeCompare(a.start ?? ''));

  if (!subject.attendance.tracked) {
    return (
      <div className="empty">
        No estás controlando la asistencia de esta asignatura.
        <div style={{ marginTop: 10 }}>
          <button onClick={() => db.subjects.update(subject.id, { attendance: { ...subject.attendance, tracked: true } })}>Activar control de asistencia</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="v" style={{ color: st.risk ? 'var(--danger)' : undefined }}>{st.percent == null ? '—' : fmt(st.percent, 0) + ' %'}</div><div className="l">Asistencia{subject.attendance.minPercent ? ` (mín. ${subject.attendance.minPercent} %)` : ''}</div></div>
        <div className="stat"><div className="v">{st.asist}</div><div className="l">Asistidas</div></div>
        <div className="stat"><div className="v">{st.faltas}</div><div className="l">Faltas</div></div>
        <div className="stat"><div className="v">{st.just}</div><div className="l">Justificadas</div></div>
        {st.remaining != null && (
          <div className="stat"><div className="v" style={{ color: st.remaining <= 1 ? 'var(--danger)' : 'var(--ok)' }}>{Math.max(st.remaining, 0)}</div><div className="l">Faltas que te quedan</div></div>
        )}
      </div>
      {subject.attendance.minPercent != null && !subject.attendance.totalSessions && (
        <p className="muted small">Indica las sesiones totales del semestre en «Editar» para saber cuántas faltas te quedan.</p>
      )}

      {unrecorded.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Clases sin registrar (últimas 2 semanas)</h3>
          {unrecorded.map((p) => (
            <div className="row" key={p.date + p.start} style={{ padding: '6px 0' }}>
              <span style={{ flex: 1 }}>{formatDate(p.date)} · {p.start}–{p.end}</span>
              <AttendanceButtons subjectId={subject.id} date={p.date} start={p.start} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row wrap" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Registrar otra clase</h3>
          <span className="spacer" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />
          <AttendanceButtons subjectId={subject.id} date={date} record={find(date)} />
        </div>
        <h3 style={{ marginTop: 16 }}>Historial</h3>
        {sorted.length === 0 && <div className="muted small">Sin registros todavía.</div>}
        {sorted.map((r) => (
          <div className="row" key={r.id} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1 }}>{formatDate(r.date)}{r.start ? ` · ${r.start}` : ''}</span>
            <span className={'badge ' + (r.status === 'asistido' ? 'b-baja' : r.status === 'falta' ? 'b-critica' : 'b-alta')}>{LABEL[r.status]}</span>
            <button className="ghost sm" onClick={() => db.attendance.delete(r.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
