# Usar la app en el PC y en el móvil (gratis)

- **La app** se publica gratis en **GitHub Pages**.
- **Tus datos y documentos** se guardan en **tu propio Google Drive**, en la carpeta «Gestión Universidad».

La app solo puede ver los archivos que ella misma crea, nada más de tu Drive. No hay servidores intermedios.

Se hace **una sola vez** y lleva unos 15 minutos.

---

## Parte 1 · Publicar la app en GitHub Pages

1. Crea una cuenta en <https://github.com> si no tienes.
2. Crea un repositorio nuevo (botón **New**):
   - Nombre: `gestion-universidad`
   - Visibilidad: **Public**. Las Pages gratis lo requieren; solo se ve el código, nunca tus datos.
   - No marques «Add README».
3. En la carpeta del proyecto, ejecuta (cambia `TU_USUARIO`):

   ```powershell
   git init -b main
   git add .
   git commit -m "Primera versión"
   git remote add origin https://github.com/TU_USUARIO/gestion-universidad.git
   git push -u origin main
   ```

4. En GitHub, ve al repositorio → **Settings** → **Pages** → **Build and deployment** → **Source: GitHub Actions**.
5. Ve a la pestaña **Actions** y espera a que termine «Publicar en GitHub Pages» (aparece un ✓ verde; tarda unos 2 minutos).
   - Si falló porque Pages aún no estaba activado, pulsa **Re-run all jobs**.
6. Tu app ya está en: `https://TU_USUARIO.github.io/gestion-universidad/`

Cada vez que se haga `git push`, se vuelve a publicar sola.

## Parte 2 · Crear el acceso a Google Drive (Client ID)

1. Entra en <https://console.cloud.google.com> con tu cuenta de Google.
2. Arriba, en el selector de proyectos, elige **Nuevo proyecto** → nombre `Gestion Universidad` → **Crear**. Asegúrate de que queda seleccionado.
3. Activa la API de Drive:
   - Menú → **APIs y servicios** → **Biblioteca**
   - Busca **Google Drive API** → **Habilitar**
4. Configura la pantalla de permisos:
   - Menú → **APIs y servicios** → **Pantalla de consentimiento de OAuth** (o **Google Auth Platform**) → **Comenzar**.
   - Nombre de la app: `Gestión Universidad`. Correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Información de contacto: tu correo → acepta y **Crear**.
5. Añade el permiso que usa la app:
   - **Acceso a datos** → **Agregar o quitar permisos**
   - Busca `drive.file` («Ver, editar, crear y borrar solo los archivos de Drive que usas con esta app») → márcalo → **Actualizar** → **Guardar**.
6. Publica la app:
   - **Público** → **Publicar app** → Confirmar.
   - El permiso `drive.file` no es sensible, así que Google no pide verificación. Si la dejas en «Prueba», tendrías que añadirte como usuario de prueba y el permiso caduca cada 7 días.
7. Crea el Client ID:
   - **Clientes** (o **Credenciales**) → **Crear cliente** → Tipo: **Aplicación web** → Nombre: `Web`.
   - En **Orígenes autorizados de JavaScript** añade:
     - `https://TU_USUARIO.github.io`
     - `http://localhost:5173` (para usarla en local)
   - En **URI de redireccionamiento** no hace falta nada.
   - **Crear** → copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

   El Client ID **no es secreto**: identifica a la app, no da acceso a tus datos.

## Parte 3 · Poner el Client ID en la app

Para que funcione en todos tus dispositivos sin escribirlo cada vez:

1. En GitHub → tu repositorio → **Settings** → **Secrets and variables** → **Actions** → pestaña **Variables** → **New repository variable**.
2. Nombre: `GOOGLE_CLIENT_ID`. Valor: el ID que copiaste.
3. Ve a **Actions** → «Publicar en GitHub Pages» → **Run workflow** para republicar.

Para usarla en local con `npm run dev`, crea un archivo `.env.local` en la carpeta del proyecto con:

```
VITE_GOOGLE_CLIENT_ID=tu-id.apps.googleusercontent.com
```

Este archivo no se sube a GitHub. También puedes pegar el ID directamente en **Ajustes** de la app.

## Parte 4 · Conectar los dispositivos

1. **En el PC**, abre `https://TU_USUARIO.github.io/gestion-universidad/`.
   - Los datos que tienes en `localhost` no se pasan solos, porque cada dirección tiene su propio almacenamiento. Antes de empezar:
     1. En la versión de `localhost`: **Ajustes** → **Copia completa**.
     2. En la nueva dirección: **Ajustes** → **Restaurar copia**.
   - Otra opción: conecta Drive también en `localhost`. Sincronizará con la misma carpeta.
2. **Ajustes** → **Conectar con Google Drive** → elige tu cuenta → **Permitir**.
3. **En el móvil**, abre la misma dirección:
   - **Android (Chrome):** menú ⋮ → **Instalar app** / **Añadir a pantalla de inicio**.
   - **iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.
4. En el móvil, ve a **Ajustes** → **Conectar con Google Drive**. Tus asignaturas, entregas, notas y asistencia aparecerán solas.

## Cómo funciona en el día a día

- Se sincroniza sola:
  - al abrir la app,
  - al volver a ella,
  - unos segundos después de cada cambio,
  - y cada 5 minutos.
- El acceso de Google **dura 1 hora** (es la forma de hacerlo gratis y sin servidor). Cuando caduca, aparece **🔑 Toca para sincronizar**; un toque y sigue.
- Si cambias lo mismo en dos dispositivos, **gana el cambio más reciente**. Los borrados también se sincronizan.
- **Documentos:**
  - Se suben a `Gestión Universidad/Documentos/<Asignatura>/` en tu Drive.
  - En otro dispositivo se descargan **cuando los abres** (marcados como «☁️ solo en Drive»).
  - En el móvil puedes usar **Liberar espacio** para no guardar copias.
- Si borras un documento en la app, en Drive va a la **papelera**, donde se puede recuperar durante 30 días.

## Si algo falla

| Problema | Solución |
|---|---|
| «Error 400: redirect_uri_mismatch» u «origin not allowed» | Falta el origen exacto en el paso 2.7. Escribe `https://TU_USUARIO.github.io` sin barra final ni ruta. |
| «Acceso bloqueado: la app no está verificada» | La app sigue en modo «Prueba»: publícala (paso 2.6) o añádete como usuario de prueba. |
| En el iPhone, desde el icono instalado, no se abre la ventana de Google | Ábrela una vez en Safari y conecta desde ahí. Si sigue fallando, usa la app desde Safari. |
| El ícono muestra ⚠️ | En **Ajustes** aparece el mensaje de error. |
