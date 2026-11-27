import Dexie, { type Table } from 'dexie';

export type ID = string;

export interface ClassSlot {
  day: number; // 0 = lunes ... 6 = domingo
  start: string; // "09:00"
  end: string; // "11:00"
  room?: string;
}

/** Un elemento evaluable concreto: "Parcial 1", "Práctica 3"... */
export interface GradeItem {
  id: ID;
  name: string;
  /** Peso relativo dentro de su bloque. Si todos valen igual, deja 1. */
  weight: number;
  /** Nota obtenida (sobre maxScore). null = aún no la tienes. */
  grade: number | null;
  maxScore: number;
}

/** Un bloque de evaluación: "Parciales 60 %", "Trabajos 30 %"... */
export interface GradeComponent {
  id: ID;
  name: string;
  /** Porcentaje sobre la nota final (0-100). */
  weight: number;
  /** Nota mínima del bloque (sobre 10) para que haga media. */
  minGrade?: number;
  items: GradeItem[];
}

export interface Subject {
  id: ID;
  name: string;
  shortName?: string;
  color: string;
  professor?: string;
  email?: string;
  semester: string; // "2026-27 · 1er semestre"
  credits?: number;
  moodleUrl?: string;
  schedule: ClassSlot[];
  passGrade: number; // normalmente 5
  gradeScheme: GradeComponent[];
  attendance: {
    tracked: boolean;
    minPercent?: number; // p. ej. 80
    totalSessions?: number; // sesiones totales del semestre, si las sabes
  };
  notes?: string;
  archived: boolean;
  createdAt: number;
}

export type AssignmentType = 'practica' | 'actividad' | 'trabajo' | 'examen' | 'otro';
export type AssignmentStatus = 'pendiente' | 'en_curso' | 'entregada';

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Assignment {
  id: ID;
  subjectId: ID;
  title: string;
  type: AssignmentType;
  due: string; // ISO datetime
  status: AssignmentStatus;
  /** Peso en la nota final (%). Si está vinculada a una nota, se calcula solo. */
  weight?: number;
  /** Vínculo con un GradeItem de la asignatura. */
  gradeItemId?: ID;
  estimatedHours?: number;
  subtasks: Subtask[];
  notes?: string;
  link?: string;
  createdAt: number;
  completedAt?: number;
}

export interface DocFile {
  id: ID;
  subjectId: ID;
  name: string;
  folder: string; // "Tema 1", "Prácticas"...
  mime: string;
  size: number;
  /** Contenido en este dispositivo. Puede faltar si solo está en Drive. */
  blob?: Blob;
  url?: string; // documentos que son solo un enlace
  /** Id del archivo en Google Drive, cuando ya está subido. */
  driveFileId?: string;
  addedAt: number;
}

/** Registro de algo borrado, para propagar el borrado al sincronizar. */
export interface Deletion {
  key: string; // `${table}:${id}`
  table: SyncTable;
  id: ID;
  at: number;
  driveFileId?: string;
  driveDone?: boolean;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const SYNC_TABLES = ['subjects', 'assignments', 'docs', 'attendance'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export type AttendanceStatus = 'asistido' | 'falta' | 'justificada';

export interface AttendanceRecord {
  id: ID;
  subjectId: ID;
  date: string; // YYYY-MM-DD
  start?: string;
  status: AttendanceStatus;
}

class UniDB extends Dexie {
  subjects!: Table<Subject, ID>;
  assignments!: Table<Assignment, ID>;
  docs!: Table<DocFile, ID>;
  attendance!: Table<AttendanceRecord, ID>;
  deletions!: Table<Deletion, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('gestion-universidad');
    this.version(1).stores({
      subjects: 'id, semester, archived',
      assignments: 'id, subjectId, due, status',
      docs: 'id, subjectId, folder',
      attendance: 'id, subjectId, date, [subjectId+date]',
    });
    this.version(2).stores({
      deletions: 'key, table',
      meta: 'key',
    });
  }
}

export const db = new UniDB();

/** Todo registro sincronizable lleva la marca de su última modificación. */
export type Stamped = { id: ID; updatedAt?: number };

/**
 * Mientras se aplican datos que vienen de Drive no se tocan las marcas de tiempo
 * ni se registran borrados (ya vienen resueltos).
 */
let applyingRemote = false;
export async function withRemoteApply<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemote = true;
  try { return await fn(); } finally { applyingRemote = false; }
}

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();
/** Avisa cuando hay cambios locales (para lanzar una sincronización). */
export const onLocalChange = (fn: ChangeListener) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => setTimeout(() => listeners.forEach((l) => l()), 0);

for (const name of SYNC_TABLES) {
  const t = db.table(name);
  t.hook('creating', (_pk, obj) => {
    if (applyingRemote) return;
    (obj as Stamped).updatedAt = Date.now();
    notify();
  });
  t.hook('updating', () => {
    if (applyingRemote) return;
    notify();
    return { updatedAt: Date.now() };
  });
  t.hook('deleting', (pk, obj) => {
    if (applyingRemote) return;
    const del: Deletion = { key: `${name}:${pk}`, table: name, id: pk as string, at: Date.now() };
    const fid = (obj as DocFile | undefined)?.driveFileId;
    if (fid) del.driveFileId = fid;
    Dexie.ignoreTransaction(() => db.deletions.put(del));
    notify();
  });
}

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export const SUBJECT_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#db2777', '#7c3aed', '#2563eb', '#65a30d', '#475569',
];

export const TYPE_LABEL: Record<AssignmentType, string> = {
  practica: 'Práctica',
  actividad: 'Actividad',
  trabajo: 'Trabajo',
  examen: 'Examen',
  otro: 'Otro',
};

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  entregada: 'Entregada',
};

/** Pide al navegador que no borre los datos aunque falte espacio. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* no disponible */
  }
}
