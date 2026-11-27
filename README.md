# Gestión Universidad

App para gestionar asignaturas, entregas, documentos, notas y asistencia.
Sin servidores ni cuentas: todo se guarda en el navegador (IndexedDB).

## Uso

```powershell
npm install
npm run dev      # abre http://localhost:5173
npm test         # tests de cálculo de notas y prioridad
npm run build    # genera dist/ (app instalable / PWA)
```

## Estructura

- `src/db.ts` — modelo de datos (Dexie / IndexedDB)
- `src/lib/grades.ts` — cálculo de nota acumulada, media necesaria y mínimos por bloque
- `src/lib/priority.ts` — prioridad inteligente (fecha + peso en la nota + trabajo restante)
- `src/lib/backup.ts` — exportar / importar copia de seguridad
- `src/components/` — formularios, lista de entregas, notas, documentos, asistencia
- `src/pages/` — Inicio, Entregas, Calendario, Asignaturas, Notas, Ajustes

## PC + móvil

Sincronización gratuita con tu Google Drive y publicación en GitHub Pages: ver [SINCRONIZACION.md](SINCRONIZACION.md).

- `src/lib/google-auth.ts` — inicio de sesión con Google (sin servidor, permiso `drive.file`)
- `src/lib/drive.ts` — cliente de la API de Drive
- `src/lib/merge.ts` — fusión de cambios entre dispositivos (gana el más reciente; los borrados se propagan)
- `src/lib/sync.ts` — motor de sincronización automática
