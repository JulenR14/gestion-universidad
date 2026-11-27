/**
 * Inicio de sesión con Google sin servidor (Google Identity Services, flujo de token).
 * Solo pide acceso a los archivos que crea esta app en tu Drive (drive.file).
 * El token dura ~1 hora; al caducar hay que volver a tocar «Sincronizar».
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const LS_TOKEN = 'gdrive-token';
const LS_CLIENT = 'gdrive-client-id';
const LS_CONNECTED = 'gdrive-connected';

interface StoredToken { token: string; expiresAt: number }

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: {
      initTokenClient: (cfg: {
        client_id: string; scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    } } };
  }
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};

export function getClientId(): string {
  return ls.get(LS_CLIENT) || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
}
export function setClientId(id: string) {
  if (id.trim()) ls.set(LS_CLIENT, id.trim()); else ls.del(LS_CLIENT);
  client = null;
}

export const isConnected = () => ls.get(LS_CONNECTED) === '1';

function storedToken(): string | null {
  try {
    const t = JSON.parse(ls.get(LS_TOKEN) ?? 'null') as StoredToken | null;
    return t && t.expiresAt - 60_000 > Date.now() ? t.token : null;
  } catch { return null; }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => { gisPromise = null; rej(new Error('No se pudo cargar el inicio de sesión de Google (¿sin conexión?)')); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Precarga el script para que el popup se abra al instante al tocar el botón. */
export const preloadGoogle = () => { if (getClientId()) loadGis().catch(() => {}); };

let client: TokenClient | null = null;
let pending: { res: (t: string) => void; rej: (e: Error) => void } | null = null;

/**
 * Devuelve un token válido. Si no hay y `interactive` es true, abre la ventana de Google
 * (debe llamarse desde un clic del usuario para que el navegador no la bloquee).
 */
export async function getToken(interactive: boolean): Promise<string | null> {
  const t = storedToken();
  if (t) return t;
  if (!interactive) return null;
  const clientId = getClientId();
  if (!clientId) throw new Error('Falta configurar el Client ID de Google en Ajustes');
  if (!window.google?.accounts?.oauth2) await loadGis();
  client ??= window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (r) => {
      const p = pending; pending = null;
      if (!p) return;
      if (r.error || !r.access_token) return p.rej(new Error(r.error_description || r.error || 'Acceso denegado'));
      ls.set(LS_TOKEN, JSON.stringify({ token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }));
      ls.set(LS_CONNECTED, '1');
      p.res(r.access_token);
    },
    error_callback: (e) => {
      const p = pending; pending = null;
      p?.rej(new Error(e.type === 'popup_closed' ? 'Se cerró la ventana de Google' : e.message || e.type));
    },
  });
  return new Promise<string>((res, rej) => {
    pending?.rej(new Error('Cancelado'));
    pending = { res, rej };
    client!.requestAccessToken({ prompt: isConnected() ? '' : 'consent' });
  });
}

/** El token guardado dejó de valer (p. ej. lo revocaste): se olvida. */
export const invalidateToken = () => ls.del(LS_TOKEN);

export function disconnect() {
  const t = storedToken();
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t);
  ls.del(LS_TOKEN);
  ls.del(LS_CONNECTED);
  client = null;
}
