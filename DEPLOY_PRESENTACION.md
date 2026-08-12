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
