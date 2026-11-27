/** Cliente mínimo de la API REST de Google Drive v3 (solo fetch, sin librerías). */

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

export class DriveAuthError extends Error {}

export class Drive {
  constructor(private token: string) {}

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(init.headers ?? {}) } });
    if (r.status === 401) throw new DriveAuthError('La sesión de Google ha caducado');
    if (!r.ok) {
      let msg = `${r.status}`;
      try { msg = (await r.json()).error?.message ?? msg; } catch { /* sin cuerpo */ }
      const e = new Error(`Error de Google Drive: ${msg}`) as Error & { status?: number };
      e.status = r.status;
      throw e;
    }
    return r;
  }

  private async findOne(q: string): Promise<string | null> {
    const p = new URLSearchParams({ q: `${q} and trashed=false`, fields: 'files(id)', spaces: 'drive', pageSize: '1', orderBy: 'createdTime' });
    const r = await this.req(`${API}/files?${p}`);
    const { files } = (await r.json()) as { files: { id: string }[] };
    return files[0]?.id ?? null;
  }

  async folder(name: string, parent?: string): Promise<string> {
    const q = `name='${esc(name)}' and mimeType='${FOLDER}'` + (parent ? ` and '${parent}' in parents` : '');
    const found = await this.findOne(q);
    if (found) return found;
    const r = await this.req(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}) }),
    });
    return ((await r.json()) as { id: string }).id;
  }

  findFile = (name: string, parent: string) => this.findOne(`name='${esc(name)}' and '${parent}' in parents`);

  async readJson<T>(id: string): Promise<T> {
    const r = await this.req(`${API}/files/${id}?alt=media`, { cache: 'no-store' });
    return (await r.json()) as T;
  }

  async writeJson(name: string, parent: string, data: unknown, id?: string | null): Promise<string> {
    const body = JSON.stringify(data);
    if (id) {
      await this.req(`${UPLOAD}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      return id;
    }
    return this.upload(new Blob([body], { type: 'application/json' }), { name, parents: [parent], mimeType: 'application/json' });
  }

  /** Subida reanudable: sirve para archivos de cualquier tamaño. */
  async upload(blob: Blob, meta: { name: string; parents: string[]; mimeType?: string }): Promise<string> {
    const init = await this.req(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': meta.mimeType || blob.type || 'application/octet-stream' },
      body: JSON.stringify(meta),
    });
    const location = init.headers.get('Location');
    if (!location) throw new Error('Drive no devolvió la URL de subida');
    const r = await this.req(location, { method: 'PUT', body: blob });
    return ((await r.json()) as { id: string }).id;
  }

  async download(id: string): Promise<Blob> {
    const r = await this.req(`${API}/files/${id}?alt=media`);
    return r.blob();
  }

  /** Mueve a la papelera de Drive (recuperable 30 días). Ignora si ya no existe. */
  async trash(id: string) {
    try {
      await this.req(`${API}/files/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
