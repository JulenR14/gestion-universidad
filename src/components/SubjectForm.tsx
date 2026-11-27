import { useState } from 'react';
import { db, uid, SUBJECT_COLORS, type ClassSlot, type GradeComponent, type Subject } from '../db';
import { DAYS } from '../lib/dates';
import { Modal, NumberInput } from './common';

const it = (name: string) => ({ id: uid(), name, weight: 1, grade: null, maxScore: 10 });
const comp = (name: string, weight: number, items: string[], minGrade?: number): GradeComponent => ({
  id: uid(), name, weight, minGrade, items: items.map(it),
});

export const TEMPLATES: Record<string, { label: string; make: () => GradeComponent[] }> = {
  vacio: { label: 'Lo configuro después', make: () => [] },
  parciales: {
    label: 'Parciales + trabajos (60/40)',
    make: () => [comp('Parciales', 60, ['Parcial 1', 'Parcial 2'], 4), comp('Trabajos / prácticas', 40, ['Trabajo 1', 'Trabajo 2'])],
  },
  final: {
    label: 'Examen final + prácticas (70/30)',
    make: () => [comp('Examen final', 70, ['Examen final'], 4), comp('Prácticas', 30, ['Práctica 1', 'Práctica 2', 'Práctica 3'])],
  },
  continua: {
    label: 'Solo evaluación continua (trabajos)',
    make: () => [comp('Trabajos', 70, ['Trabajo 1', 'Trabajo 2', 'Trabajo 3']), comp('Actividades', 30, ['Actividad 1', 'Actividad 2'])],
  },
};

export function currentSemester() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 8 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)} · ${m >= 8 || m === 0 ? '1er' : '2º'} semestre`;
}

export function blankSubject(): Subject {
  return {
    id: uid(), name: '', color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)],
    semester: currentSemester(), schedule: [], passGrade: 5, gradeScheme: [],
    attendance: { tracked: false }, archived: false, createdAt: Date.now(),
  };
}

export default function SubjectForm({ initial, onClose, onSaved }: { initial?: Subject; onClose: () => void; onSaved?: (s: Subject) => void }) {
  const isNew = !initial;
  const [s, setS] = useState<Subject>(initial ?? blankSubject());
  const [tpl, setTpl] = useState('parciales');
  const set = <K extends keyof Subject>(k: K, v: Subject[K]) => setS((p) => ({ ...p, [k]: v }));
  const setSlot = (i: number, patch: Partial<ClassSlot>) =>
    set('schedule', s.schedule.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!s.name.trim()) return;
    const out = { ...s, name: s.name.trim(), gradeScheme: isNew ? TEMPLATES[tpl].make() : s.gradeScheme };
    await db.subjects.put(out);
    onSaved?.(out);
    onClose();
  };

  return (
    <Modal
      title={isNew ? 'Nueva asignatura' : 'Editar asignatura'}
      onClose={onClose}
      footer={<>
        <button onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={save} disabled={!s.name.trim()}>Guardar</button>
      </>}
    >
      <div className="form-grid">
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Nombre *</span>
          <input autoFocus value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Cálculo II" />
        </label>
        <label className="field"><span>Abreviatura</span>
          <input value={s.shortName ?? ''} onChange={(e) => set('shortName', e.target.value)} placeholder="CAL2" /></label>
        <label className="field"><span>Color</span>
          <div className="row">
            {SUBJECT_COLORS.slice(0, 6).map((c) => (
              <button key={c} type="button" className="ghost" style={{ padding: 2 }} onClick={() => set('color', c)} aria-label={c}>
                <span className="dot" style={{ background: c, width: 22, height: 22, outline: s.color === c ? '2px solid var(--text)' : 'none', outlineOffset: 2 }} />
              </button>
            ))}
            <input type="color" value={s.color} onChange={(e) => set('color', e.target.value)} style={{ width: 44 }} />
          </div>
        </label>
        <label className="field"><span>Profesor/a</span>
          <input value={s.professor ?? ''} onChange={(e) => set('professor', e.target.value)} /></label>
        <label className="field"><span>Email del profesor/a</span>
          <input type="email" value={s.email ?? ''} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="field"><span>Semestre</span>
          <input value={s.semester} onChange={(e) => set('semester', e.target.value)} /></label>
        <label className="field"><span>Créditos</span>
          <NumberInput value={s.credits} onChange={(v) => set('credits', v ?? undefined)} /></label>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Enlace al curso en Moodle</span>
          <input value={s.moodleUrl ?? ''} onChange={(e) => set('moodleUrl', e.target.value)} placeholder="https://..." /></label>
      </div>

      <div className="form-section">
        <div className="row"><h3 style={{ margin: 0 }}>Horario de clases</h3><span className="spacer" />
          <button className="sm" type="button" onClick={() => set('schedule', [...s.schedule, { day: 0, start: '09:00', end: '11:00' }])}>+ Añadir clase</button>
        </div>
        {s.schedule.length === 0 && <p className="muted small" style={{ marginTop: 8 }}>Añade tus horas de clase para verlas en el inicio y controlar la asistencia.</p>}
        {s.schedule.map((c, i) => (
          <div className="row" key={i} style={{ marginTop: 8 }}>
            <select value={c.day} onChange={(e) => setSlot(i, { day: Number(e.target.value) })} style={{ maxWidth: 130 }}>
              {DAYS.map((d, j) => <option key={d} value={j}>{d}</option>)}
            </select>
            <input type="time" value={c.start} onChange={(e) => setSlot(i, { start: e.target.value })} />
            <input type="time" value={c.end} onChange={(e) => setSlot(i, { end: e.target.value })} />
            <input value={c.room ?? ''} placeholder="Aula" onChange={(e) => setSlot(i, { room: e.target.value })} />
            <button className="ghost sm" type="button" onClick={() => set('schedule', s.schedule.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      <div className="form-section">
        <h3>Evaluación</h3>
        <div className="form-grid">
          <label className="field"><span>Nota para aprobar</span>
            <NumberInput value={s.passGrade} onChange={(v) => set('passGrade', v ?? 5)} /></label>
          {isNew && (
            <label className="field"><span>Plantilla inicial (luego la puedes cambiar)</span>
              <select value={tpl} onChange={(e) => setTpl(e.target.value)}>
                {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="form-section">
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={s.attendance.tracked} onChange={(e) => set('attendance', { ...s.attendance, tracked: e.target.checked })} />
          <b>Controlar asistencia</b>
        </label>
        {s.attendance.tracked && (
          <div className="form-grid" style={{ marginTop: 10 }}>
            <label className="field"><span>Asistencia mínima (%)</span>
              <NumberInput value={s.attendance.minPercent} placeholder="80" onChange={(v) => set('attendance', { ...s.attendance, minPercent: v ?? undefined })} /></label>
            <label className="field"><span>Sesiones totales del semestre (opcional)</span>
              <NumberInput value={s.attendance.totalSessions} placeholder="28" onChange={(v) => set('attendance', { ...s.attendance, totalSessions: v ?? undefined })} /></label>
          </div>
        )}
      </div>
    </Modal>
  );
}
