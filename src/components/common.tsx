import { useEffect, type InputHTMLAttributes, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Subject } from '../db';

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Asignaturas activas (no archivadas) y un mapa por id con todas. */
export function useSubjects() {
  const all = useLiveQuery(() => db.subjects.orderBy('semester').toArray(), []) ?? [];
  const active = all.filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map<string, Subject>(all.map((s) => [s.id, s]));
  return { all, active, byId, loaded: all !== undefined };
}

export function SubjectDot({ s }: { s?: Subject }) {
  return <span className="dot" style={{ background: s?.color ?? '#999' }} />;
}

export function NumberInput({ value, onChange, ...rest }: {
  value: number | null | undefined; onChange: (v: number | null) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={value ?? ''}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        onChange(t === '' ? null : Number(t));
      }}
      {...rest}
    />
  );
}
