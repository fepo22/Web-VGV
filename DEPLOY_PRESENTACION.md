# Deploy Completo Para Presentacion

Este proyecto puede publicarse completo (frontend + backend + auth + sockets) desde GitHub usando un solo servicio Docker y MongoDB en la nube.

## Opcion recomendada

1. Crear una base MongoDB Atlas (free tier).
2. En el proveedor (Render, Railway o similar), crear un servicio desde este repo usando el `Dockerfile` de la raiz.
3. Configurar variables de entorno:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `MONGO_URI=<uri de atlas>`
   - `MONGO_DB_NAME=vgv`
   - `AUTO_SYNC_SEED=true` (sincroniza el seed a Mongo al iniciar)
   - `AUTO_SYNC_REMOVE_MISSING=false` (opcional: elimina en Mongo lo que no exista en seed)
   - `JWT_SECRET=<secreto largo>`
   - `JWT_EXPIRES_IN=8h`
   - `CLIENT_ORIGIN=<url publica del servicio>`
4. Publicar.

Con esta configuracion, el backend sirve:
- API en `/api/*`
- Login admin en `/auth/login`
- Dashboard admin en `/admin/*`
- Front catalogo estatico compilado

## Verificacion rapida post deploy

1. `GET /health` responde `{ "ok": true }`
2. Navegar a `/admin/login`
3. Iniciar sesion y entrar a `/admin/dashboard`
4. Probar CRUD y actualizacion en tiempo real

## Notas

- GitHub Pages no sirve backend Node, por eso no alcanza para demo completa.
- Este flujo evita separar frontend y backend para la presentacion.

## Vercel Services (alternativa)

Crear un proyecto Vercel con raiz en el repositorio (`.`) y habilitar Services (beta). El archivo `vercel.json` publica SvelteKit en `/` y Express en `/api/*`, `/auth/*`, `/admin/products*` y `/health`. El frontend usa el binding interno `BACKEND_URL` para llamadas de servidor; no configurarlo manualmente ni exponerlo como variable `VITE_*`. Las llamadas del navegador usan el mismo dominio publico.

Configurar en Vercel las variables del backend `MONGO_URI` (MongoDB accesible desde Vercel), `JWT_SECRET`, `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS`. Si usas la integracion MongoDB Atlas de Vercel, esta inyecta `MONGODB_URI` y no necesitas definir `MONGO_URI` manualmente. Si ambas existen, `MONGO_URI` tiene prioridad: comprueba que apunten a la base deseada. Configura `MONGO_DB_NAME=vgv` para usar esa base. Opcionales: `SMTP_PORT`, `SMTP_SECURE`, `SMTP_TO_QUOTES`, `SMTP_TO_CONTACT` y `CLIENT_ORIGIN`. Sin MongoDB no funcionan productos ni el historial de cotizaciones; sin SMTP no se envian solicitudes. No se deben subir credenciales al repositorio.

El frontend genera funciones SSR con `adapter-vercel` solo en Vercel; el build Docker conserva `adapter-static`. Socket.IO necesita un servidor persistente: en Vercel el dashboard consulta las actualizaciones cada 30 segundos y mantiene la actualizacion manual. Para probar las rutas y bindings localmente: `npx vercel dev -L` (requiere MongoDB y SMTP para pruebas completas de datos y envio).
