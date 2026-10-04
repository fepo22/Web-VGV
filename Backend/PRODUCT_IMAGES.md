# Imágenes admin: contrato e integración

## Integración del dashboard

Disponible en la pestaña **Importar imágenes** del panel. El formulario de productos incluye un selector de hasta 20 relacionados, con búsqueda; las asociaciones son unidireccionales y aparecen en la ficha pública. Se valida existencia y se retiran referencias al eliminar un producto.

- Importar `ImageBatchUpload` desde `$lib/components/ImageBatchUpload.svelte`.
- Props: `products` (lista **completa** actualizada, con `id`, `codigo`, `nombre`, `imagen`, `variantes[].sku`); `token` (Bearer admin existente, no se persiste aquí).
- Callback `onuploaded(product, result)`: merge por `String(product.id)` de `{ id, imagen }` sobre el producto existente. No reemplazar el objeto completo: el resultado no contiene costo ni relaciones. `result` incluye `imageId`, `bytes`, `width`, `height`.
- Callback `onautherror(status)`: ejecutar el flujo existente de logout para 401/403. El lote se detiene también ante 429; luego permite reintentar pendientes.
- El componente no carga productos ni crea relaciones/variantes. El integrador debe cargar la lista antes de mostrarlo y refrescarla tras 409 o fallo de red, antes de pulsar “Usar imagen actual del producto y volver a confirmar”.
- El evento socket `productUpdated` entrega solamente `{ id, imagen }`; conservar el merge existente del dashboard para no perder `precioCosto`/relaciones.
- `onrefresh`: refresca los productos tras conflictos o respuestas inciertas antes de volver a confirmar. También hay un botón de actualización manual.
- El sincronizador de seed conserva imágenes y relaciones gestionadas desde el panel; las asigna solo al insertar productos nuevos.

## Asociación y flujo

Nombre de archivo sin **última extensión**, comparado exactamente sin distinguir mayúsculas contra `codigo`, `id` y cada SKU de variante. No se quitan espacios, acentos ni se normalizan separadores o ceros. Ejemplo: `ABC-01.jpg` → `ABC-01`; `ABC-01 (1).jpg` **no** coincide. Si varios campos del mismo producto coinciden, cuenta una sola coincidencia. Si coinciden dos productos, o ninguno, selección manual obligatoria. Un SKU asocia la imagen al producto padre, no a una imagen específica de variante.

Máximo 30 archivos por selección, no se trunca silenciosamente. No se permite más de un archivo para el mismo producto en el lote; quitar el duplicado o cambiar destino. Canvas comprime secuencialmente y muestra la imagen resultante. Los inválidos se muestran aparte y no impiden guardar otros archivos válidos. Se requiere revisión global del lote y confirmación individual de cada imagen actual antes de reemplazarla. El selector de destino muestra todos los productos para resolver coincidencias ambiguas.

La subida es secuencial por XMLHttpRequest, con porcentaje de bytes enviados y estado de espera de confirmación backend. No establecer Content-Type manualmente: FormData proporciona el boundary. Solo se reintentan pendientes/errores; jamás archivos confirmados. Los errores de red/timeout pueden ocurrir después de un commit: refrescar primero, sin retry automático. Una confirmación nueva es necesaria antes de reintentar.

## API

`POST /admin/products/images`, registrado antes de `/:id`, bajo `adminLimiter` y auth admin del router. Multipart con **un** archivo en `image` y estos campos escalares:

- `productId`: ID explícito del producto existente, hasta 200 caracteres.
- `expectedImage`: valor exacto de `imagen` observado en preview, obligatorio incluso vacío, hasta 2048 bytes.
- `overwrite`: `true` para reemplazar una imagen no vacía; `false` para imagen vacía.

201: `{ product: { id, imagen }, imageId, bytes, width, height }`. Errores JSON genéricos sin secretos: 400 multipart/campos; 401/403 auth; 404 producto; 409 imagen cambió o falta confirmación; 413 original >10 MiB; 422 bytes inválidos/procesamiento; 429 rate limit/concurrencia; 500 almacenamiento/configuración. La actualización atómica compara `imagen` con `expectedImage`; solo modifica `imagen` (y timestamp Mongoose), nunca costo ni relaciones.

`GET /api/product-images/:id`: ID ObjectId GridFS de 24 hex, no ID de producto. Entrega exclusivamente bytes WebP, `Content-Type: image/webp`, `Cache-Control: no-store`, `nosniff` y CORP cross-origin para poder mostrar en frontend separado. No expone metadata, nombres originales ni credenciales. 404 inexistente/inválido y 503 si Mongo no está disponible. Cada subida genera un ObjectId nuevo; no sobrescribe los bytes antiguos.

## Límites y seguridad

- Original cliente/servidor hasta 10 MiB; servidor recibe únicamente la salida comprimida cuando se usa el componente.
- JPEG, PNG, WebP; **no SVG**. Cliente comprueba extensión y firma antes de canvas; servidor comprueba bytes reales con sharp, no confía en MIME ni extensión. Canvas puede aplanar formatos animados; el backend rechaza archivos originales multipágina.
- Máximo 40 millones de píxeles al decodificar; EXIF rotado y metadata eliminada. Sin ampliación, lados ≤1600; WebP calidades 82/65/45/25 hasta lograr ≤1 MiB, de lo contrario rechazo.
- Multer memory: 1 archivo, 3 campos, 4 partes, valores ≤2048 bytes. Hasta dos subidas concurrentes por proceso para acotar memoria. Rate limit admin existente: 60 solicitudes/minuto (incluye consultas del dashboard).
- express.json/urlencoded globales de 10 KiB **no** parsean multipart, no elevarlos. xss/mongoSanitize globales corren antes de multer, por eso hay validación estricta post-multer de nombres/tipos/valores y queries construidas con valores escalares; no usar req.body como filtro Mongo.
- Se mantienen auth, Helmet, CORS, bloqueo de agentes y rate limits existentes. CSP permite `blob:` para previews y `https:` para imágenes del backend separado (`http:` solo fuera de producción). Smoke HTTP con cliente Node/agente navegador; el backend bloquea curl/wget/python para POST.

## Mongo y despliegue

Reutiliza `connectProductsDatabase` y la conexión Mongoose existente, con `MONGO_URI`/`MONGODB_URI` y opcional `MONGO_DB_NAME`. GridFS crea `productImages.files` y `productImages.chunks` en **la misma DB**. La cuenta Mongo necesita leer/escribir/crear índices en esas colecciones y actualizar productos. No disco local ni proveedor externo.

Para frontend Vercel y backend separado:

- Frontend: `VITE_BACKEND_URL=https://backend.example` al construir, siguiendo backend-url.js.
- Backend: `PUBLIC_BACKEND_URL=https://backend.example` (origen público HTTP(S) sin credenciales; no añadir prefijo de ruta); `CLIENT_ORIGIN=https://frontend.example`; `JWT_SECRET` y conexión Mongo existentes.
- Las URLs persistidas de imagen son **absolutas del backend**, no relativas a Vercel. Si falta PUBLIC_BACKEND_URL se utiliza origen de la petición al backend (requiere proxy/Host confiable). No guardar URL de localhost en producción ni usar el frontend como origen backend.
- Requiere desplegar backend con multer/sharp, binarios sharp compatibles y acceso Mongo. Vercel frontend por sí solo no sirve GridFS. Un backend serverless/proxy puede tener un límite de petición inferior a 10 MiB: el componente envía ≤1 MiB, pero clientes directos están sujetos a ese límite de infraestructura. Configurar límites/timeouts acordes donde aplique.

Los archivos anteriores se conservan para no romper lectores con URLs previas. Los nuevos sin asociación se eliminan cuando se confirma el conflicto; si hay una respuesta Mongo incierta se conservan para no borrar una imagen cuyo commit pudo completarse. No hay transacción entre GridFS y producto, ni política de retención/GC: una futura limpieza debe comprobar referencias antes de borrar, respetando un periodo de gracia. La eliminación de producto tampoco borra imágenes en esta feature.

## Verificación

Pruebas sin servidor Mongo: `node --test tests/product-images*.test.js` desde Backend. Cubren matching, ambigüedad, duplicados, límites, entradas maliciosas, bytes reales, SVG, rotación, resize, WebP, metadata, URL pública y evento mínimo. También verifican HTTP real con auth y los middlewares existentes: multipart >10 KiB atraviesa el parser JSON; archivos múltiples, límites de bytes/campos e inyección post-sanitize son rechazados. Smoke persistente pendiente con Mongo real: subir, descargar desde origen frontend, confirmar conflicto concurrente y verificar recuperación tras reinicio/backend deploy.