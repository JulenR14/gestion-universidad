import { useEffect, useState } from 'react';
import { db, uid, type GradeComponent, type GradeItem, type Subject } from '../db';
import { effectiveWeights, fmt, summarizeGrades, type GradeSummary } from '../lib/grades';
import { NumberInput } from './common';

export function Verdict({ g, pass }: { g: GradeSummary; pass: number }) {
  let text: string;
  switch (g.status) {
    case 'sin_datos': text = 'Configura cómo se evalúa la asignatura para ver tus cálculos.'; break;
    case 'aprobado': text = `✅ Aprobada: llevas ${fmt(g.accumulated)} puntos sobre 10.`; break;
    case 'suspenso':
      text = g.components.some((c) => c.failsMin)
        ? '⚠️ No llegas a la nota mínima de algún bloque. Revisa si hay recuperación.'
        : `⚠️ Aunque saques un 10 en todo lo que falta, llegarías a ${fmt(g.maxReachable)}. Toca recuperación.`;
      break;
    default:
      text = g.neededToPass === 0
        ? '👍 Ya tienes los puntos para aprobar, solo cumple los mínimos.'
        : `Necesitas una media de ${fmt(g.neededToPass, 2)} en lo que falta (${fmt(g.pendingWeight, 1)} % de la nota) para llegar al ${fmt(pass)}.`;
  }
  return <div className={`verdict v-${g.status}`}>{text}</div>;
}

export default function GradeEditor({ subject }: { subject: Subject }) {
  const [scheme, setScheme] = useState<GradeComponent[]>(subject.gradeScheme);
  const [editing, setEditing] = useState(subject.gradeScheme.length === 0);

  useEffect(() => { setScheme(subject.gradeScheme); }, [subject.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: GradeComponent[]) => {
    setScheme(next);
    db.subjects.update(subject.id, { gradeScheme: next });
  };
  const updComp = (cid: string, patch: Partial<GradeComponent>) => save(scheme.map((c) => (c.id === cid ? { ...c, ...patch } : c)));
  const updItem = (cid: string, iid: string, patch: Partial<GradeItem>) =>
    save(scheme.map((c) => (c.id === cid ? { ...c, items: c.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) } : c)));
  const addItem = (c: GradeComponent) =>
    updComp(c.id, { items: [...c.items, { id: uid(), name: `${c.name.replace(/s$/, '')} ${c.items.length + 1}`, weight: 1, grade: null, maxScore: 10 }] });
  const addComp = () =>
    save([...scheme, { id: uid(), name: 'Nuevo bloque', weight: Math.max(0, 100 - scheme.reduce((s, c) => s + c.weight, 0)), items: [] }]);

  const g = summarizeGrades({ gradeScheme: scheme, passGrade: subject.passGrade });

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="v">{fmt(g.accumulated)}</div><div className="l">Puntos acumulados (sobre 10)</div></div>
        <div className="stat"><div className="v">{fmt(g.currentAverage)}</div><div className="l">Media de lo evaluado</div></div>
        <div className="stat"><div className="v">{fmt(g.gradedWeight, 0)} %</div><div className="l">De la nota ya evaluado</div></div>
        <div className="stat"><div className="v" style={{ color: g.status === 'suspenso' ? 'var(--danger)' : undefined }}>{g.neededToPass == null ? '—' : fmt(g.neededToPass)}</div><div className="l">Media necesaria en lo pendiente</div></div>
        <div className="stat"><div className="v">{fmt(g.maxReachable)}</div><div className="l">Nota máxima posible</div></div>
      </div>
      <Verdict g={g} pass={subject.passGrade} />

      {Math.abs(g.totalWeight - 100) > 0.01 && scheme.length > 0 && (
        <div className="verdict v-suspenso" style={{ marginTop: 10 }}>Los bloques suman {fmt(g.totalWeight)} %, no 100 %. Revisa los porcentajes.</div>
      )}

      <div className="row" style={{ margin: '18px 0 10px' }}>
        <h3 style={{ margin: 0 }}>Evaluación</h3>
        <span className="spacer" />
        <button className={editing ? 'primary' : ''} onClick={() => setEditing((v) => !v)}>{editing ? '✓ Terminar de editar' : '✎ Editar estructura'}</button>
      </div>
      {!editing && <p className="muted small">Escribe tus notas en los huecos punteados cuando las tengas. Todo se recalcula solo.</p>}

      {scheme.map((c) => {
        const cs = g.components.find((x) => x.component.id === c.id)!;
        const ew = effectiveWeights(c);
        return (
          <div className="g-comp" key={c.id}>
            <div className="row wrap" style={{ marginBottom: 8 }}>
              {editing ? (
                <>
                  <input value={c.name} onChange={(e) => updComp(c.id, { name: e.target.value })} style={{ maxWidth: 220, fontWeight: 600 }} />
                  <label className="row small muted">Peso <NumberInput className="g-input" value={c.weight} onChange={(v) => updComp(c.id, { weight: v ?? 0 })} /> %</label>
                  <label className="row small muted">Mínimo <NumberInput className="g-input" placeholder="—" value={c.minGrade} onChange={(v) => updComp(c.id, { minGrade: v ?? undefined })} /></label>
                  <span className="spacer" />
                  <button className="ghost sm danger" onClick={() => confirm(`¿Eliminar el bloque «${c.name}»?`) && save(scheme.filter((x) => x.id !== c.id))}>Eliminar bloque</button>
                </>
              ) : (
                <>
                  <b>{c.name}</b>
                  <span className="badge b-neutral">{fmt(c.weight)} %</span>
                  {c.minGrade != null && <span className="badge b-alta">mín. {fmt(c.minGrade)}</span>}
                  <span className="spacer" />
                  <span className="small muted">Media: <b style={{ color: 'var(--text)' }}>{fmt(cs.average)}</b></span>
                </>
              )}
            </div>
            {cs.neededForMin != null && cs.pendingWeight > 0 && (
              <div className={'small ' + (cs.failsMin ? 'v-suspenso' : 'muted')} style={{ marginBottom: 6, padding: cs.failsMin ? '4px 8px' : 0, borderRadius: 6 }}>
                Para llegar al mínimo de este bloque necesitas {fmt(cs.neededForMin)} de media en lo que queda.
              </div>
            )}
            {cs.failsMin && cs.pendingWeight === 0 && <div className="small v-suspenso" style={{ padding: '4px 8px', borderRadius: 6, marginBottom: 6 }}>No llegas al mínimo de este bloque.</div>}
            <table className="g-table">
              <thead><tr>
                <th>Elemento</th>
                {editing && <th>Peso relativo</th>}
                <th style={{ textAlign: 'right' }}>% final</th>
                <th style={{ textAlign: 'right' }}>Nota</th>
                <th>Sobre</th>
                {editing && <th />}
              </tr></thead>
              <tbody>
                {c.items.map((i) => (
                  <tr key={i.id}>
                    <td>{editing ? <input value={i.name} onChange={(e) => updItem(c.id, i.id, { name: e.target.value })} /> : i.name}</td>
                    {editing && <td><NumberInput className="g-input" value={i.weight} onChange={(v) => updItem(c.id, i.id, { weight: v ?? 0 })} /></td>}
                    <td style={{ textAlign: 'right' }} className="muted small">{fmt(ew.get(i.id), 1)} %</td>
                    <td style={{ textAlign: 'right' }}>
                      <NumberInput className={'g-input' + (i.grade == null ? ' empty-grade' : '')} placeholder="—" min={0} max={i.maxScore}
                        value={i.grade} onChange={(v) => updItem(c.id, i.id, { grade: v })} aria-label={`Nota de ${i.name}`} />
                    </td>
                    <td className="muted small">{editing
                      ? <NumberInput className="g-input" value={i.maxScore} onChange={(v) => updItem(c.id, i.id, { maxScore: v || 10 })} />
                      : `/ ${fmt(i.maxScore)}`}</td>
                    {editing && <td><button className="ghost sm" onClick={() => updComp(c.id, { items: c.items.filter((x) => x.id !== i.id) })}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editing && <button className="sm" style={{ marginTop: 8 }} onClick={() => addItem(c)}>+ Añadir elemento</button>}
            {c.items.length === 0 && !editing && <div className="muted small">Sin elementos. Pulsa «Editar estructura» para añadirlos.</div>}
          </div>
        );
      })}
      {editing && (
        <>
          <button onClick={addComp}>+ Añadir bloque (parciales, trabajos, prácticas…)</button>
          <p className="muted small" style={{ marginTop: 10 }}>
            <b>Cómo funciona:</b> cada bloque tiene un % de la nota final. Dentro del bloque, los elementos se reparten ese % según su peso relativo
            (si todos valen 1, cuentan igual). El «mínimo» es la nota que exige la guía docente en ese bloque para hacer media.
          </p>
        </>
      )}
    </div>
  );
}
