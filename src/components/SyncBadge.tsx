import { useNavigate } from 'react-router-dom';
import { syncNow, useSyncState } from '../lib/sync';
import { getClientId } from '../lib/google-auth';

export function ago(ts: number | null) {
  if (!ts) return 'nunca';
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : new Date(ts).toLocaleDateString('es-ES');
}

/** Indicador de sincronización. `compact` para la cabecera del móvil. */
export default function SyncBadge({ compact = false }: { compact?: boolean }) {
  const s = useSyncState();
  const nav = useNavigate();
  if (!getClientId() || s.status === 'off') {
    return compact ? null : (
      <button className="ghost sm sync-badge" onClick={() => nav('/ajustes')} title="Activar sincronización con Google Drive">☁️ Sincronizar con Drive</button>
    );
  }
  const map = {
    idle: { ico: '✅', text: `Sincronizado ${ago(s.lastSync)}`, cls: '' },
    syncing: { ico: '🔄', text: s.detail ?? 'Sincronizando…', cls: '' },
    needs_auth: { ico: '🔑', text: 'Toca para sincronizar', cls: 'warn' },
    error: { ico: '⚠️', text: 'Error al sincronizar', cls: 'err' },
    offline: { ico: '📴', text: 'Sin conexión', cls: '' },
    off: { ico: '', text: '', cls: '' },
  }[s.status];
  return (
    <button
      className={`ghost sm sync-badge ${map.cls}${compact ? ' compact' : ''}`}
      title={s.error ?? map.text}
      disabled={s.status === 'syncing'}
      onClick={() => (s.status === 'error' ? nav('/ajustes') : syncNow(true))}
    >
      <span className={s.status === 'syncing' ? 'spin' : ''}>{map.ico}</span>
      {(!compact || s.status === 'needs_auth') && <span>{map.text}</span>}
    </button>
  );
}
