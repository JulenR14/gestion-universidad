import { useState } from 'react';
import { db, uid, STATUS_LABEL, TYPE_LABEL, type Assignment, type AssignmentStatus, type AssignmentType } from '../db';
import { fromLocalInput, toLocalInput } from '../lib/dates';
import { fmt, itemFinalWeight } from '../lib/grades';
import { Modal, NumberInput, useSubjects } from './common';

function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

export default function AssignmentForm({ initial, subjectId, onClose }: { initial?: Assignment; subjectId?: string; onClose: () => void }) {
  const { active, byId } = useSubjects();
  const [a, setA] = useState<Assignment>(
    initial ?? {
      id: uid(), subjectId: subjectId ?? '', title: '', type: 'practica', due: defaultDue(), status: 'pendiente',
      subtasks: [], createdAt: Date.now(),
    },
  );
  const [newSub, setNewSub] = useState('');
  const set = <K extends keyof Assignment>(k: K, v: Assignment[K]) => setA((p) => ({ ...p, [k]: v }));
  const sid = a.subjectId || active[0]?.id || '';
  const subject = byId.get(sid);
  const linkedWeight = subject && a.gradeItemId ? itemFinalWeight(subject, a.gradeItemId) : undefined;

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    set('subtasks', [...a.subtasks, { id: uid(), title: t, done: false }]);
    setNewSub('');
  };

  const save = async () => {
    if (!a.title.trim() || !sid) return;
    const status = a.status;
    await db.assignments.put({
      ...a, subjectId: sid, title: a.title.trim(),
      completedAt: status === 'entregada' ? a.completedAt ?? Date.now() : undefined,
    });
    onClose();
  };

  const remove = async () => {
    if (initial && confirm('¿Eliminar esta entrega?')) {
      await db.assignments.delete(initial.id);
      onClose();
    }
  };

  if (active.length === 0) {
    return (
      <Modal title="Nueva entrega" onClose={onClose} footer={<button onClick={onClose}>Cerrar</button>}>
        <p>Primero crea al menos una asignatura en la sección <b>Asignaturas</b>.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title={initial ? 'Editar entrega' : 'Nueva entrega'}
      onClose={onClose}
      footer={<>
        {initial && <button className="danger" onClick={remove} style={{ marginRight: 'auto' }}>Eliminar</button>}
        <button onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={save} disabled={!a.title.trim()}>Guardar</button>
      </>}
    >
      <div className="form-grid">
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Título *</span>
          <input autoFocus value={a.title} onChange={(e) => set('title', e.target.value)} placeholder="Práctica 2: listas enlazadas" /></label>
        <label className="field"><span>Asignatura</span>
          <select value={sid} onChange={(e) => setA((p) => ({ ...p, subjectId: e.target.value, gradeItemId: undefined }))}>
            {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="field"><span>Tipo</span>
          <select value={a.type} onChange={(e) => set('type', e.target.value as AssignmentType)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>Fecha y hora límite</span>
          <input type="datetime-local" value={toLocalInput(a.due)} onChange={(e) => e.target.value && set('due', fromLocalInput(e.target.value))} /></label>
        <label className="field"><span>Estado</span>
          <select value={a.status} onChange={(e) => set('status', e.target.value as AssignmentStatus)}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>Cuenta para la nota como…</span>
          <select value={a.gradeItemId ?? ''} onChange={(e) => set('gradeItemId', e.target.value || undefined)}>
            <option value="">— No vinculada —</option>
            {subject?.gradeScheme.map((c) => (
              <optgroup key={c.id} label={`${c.name} (${c.weight} %)`}>
                {c.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            ))}
          </select></label>
        <label className="field"><span>Peso en la nota final (%)</span>
          {a.gradeItemId
            ? <input disabled value={`${fmt(linkedWeight)} % (de la evaluación)`} />
            : <NumberInput value={a.weight} placeholder="p. ej. 10" onChange={(v) => set('weight', v ?? undefined)} />}
        </label>
        <label className="field"><span>Horas estimadas de trabajo</span>
          <NumberInput value={a.estimatedHours} placeholder="p. ej. 6" onChange={(v) => set('estimatedHours', v ?? undefined)} /></label>
        <label className="field"><span>Enlace (Moodle, enunciado…)</span>
          <input value={a.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="https://..." /></label>
      </div>

      <div className="form-section">
        <h3>Subtareas</h3>
        {a.subtasks.map((st) => (
          <div className="row" key={st.id} style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={st.done} onChange={(e) => set('subtasks', a.subtasks.map((x) => x.id === st.id ? { ...x, done: e.target.checked } : x))} />
            <input value={st.title} onChange={(e) => set('subtasks', a.subtasks.map((x) => x.id === st.id ? { ...x, title: e.target.value } : x))} />
            <button className="ghost sm" onClick={() => set('subtasks', a.subtasks.filter((x) => x.id !== st.id))}>✕</button>
          </div>
        ))}
        <div className="row">
          <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Nueva subtarea (Enter para añadir)"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
          <button onClick={addSub}>Añadir</button>
        </div>
      </div>

      <div className="form-section">
        <label className="field"><span>Notas</span>
          <textarea rows={3} value={a.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
      </div>
    </Modal>
  );
}
