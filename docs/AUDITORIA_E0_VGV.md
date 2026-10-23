# Auditoría E0 de VGV WEB: protección de datos

**Fecha:** 23 de octubre de 2026.

**Base revisada:** `074b9df9f1b1c3e5855b05c461d832bdf49917af`, con dos informes previos no versionados ya presentes. No se modificaron.

**Naturaleza:** revisión estática del baseline inicial, sin ejecución de módulos de aplicación en ese momento. No es certificación de producción ni prueba de penetración. La implementación local posterior, sus pruebas y el estado vigente de los riesgos están registrados en el [plan E0](./PLAN_IMPLEMENTACION_E0_VGV.md); esta auditoría conserva los hallazgos previos como referencia histórica.

## 1. Resumen ejecutivo

La aplicación puede conservarse. Hay controles útiles de autenticación, imágenes y estados de cotización, pero antes de ampliar el modelo comercial deben eliminarse efectos secundarios de lectura, sobrescrituras no intencionadas y alteraciones de stock por disponibilidad.

**Los cinco riesgos de protección de datos más importantes son:**

1. **R01:** sincronización de seed que sobrescribe campos administrados y puede eliminar documentos ausentes del seed.
2. **R03:** cambiar disponibilidad fuerza stock a cero o crea una unidad sin una operación de inventario.
3. **R04:** normalizar y reescribir la ficha completa puede alterar variantes/SKU y perder cambios concurrentes.
4. **R05:** no hay evidencia disponible de un respaldo restaurable de MongoDB, índices e imágenes.
5. **R06:** ciertos endpoints frontend sustituyen fallos por catálogo de muestra con respuesta exitosa.

R01 se clasifica **ALTO**, con impacto potencial crítico si la opción destructiva se ejecuta en una base operativa sin recuperación. Se comprobó el mecanismo, **no** que los flags estén habilitados ni que haya ocurrido pérdida real. No se asigna prioridad CRÍTICO sin evidencia del riesgo inmediato en el entorno efectivo; no se comprobó un incidente crítico activo ni un compromiso del sistema.

E0 no incluye inventario por SKU, cuentas habilitadas, tier, precios automáticos ni ofertas preliminares nuevas. Primero protege el sistema existente y prepara evidencia de recuperación. Las decisiones comerciales nuevas se registran para no reactivar después un diseño incompatible.

### Decisiones confirmadas que actualizan el plan anterior

- Una bodega; perfiles Administrador, Ventas e Inventario; aprobación/rechazo manual de clientes y tier 1–5 asignado por administrador.
- Listas diferenciadas por cliente y precios propuestos sujetos a revisión de Ventas; fórmulas/precedencias todavía pendientes.
- Productos sin stock visibles y cotizables; sin reabastecimiento confirmado, texto **“Fecha por confirmar”**.
- Solicitud genera una cotización preliminar pendiente de revisión, no una oferta comercial confirmada ni pago/despacho/movimiento.
- Sin pagos online ni ERP completo en esta etapa; futuras integraciones no justifican reescritura.

Estas decisiones no están implementadas por el hecho de aparecer aquí. La aprobación manual y el tier no existen en el esquema cliente revisado; tampoco hay reabastecimiento confirmado ni motor de listas/precios. Ya no son preguntas abiertas de negocio, pero sus contratos y parámetros requieren diseño posterior a E0.

## 2. Arquitectura encontrada y evidencia

### 2.1 Tecnologías y versiones

Se leyeron manifiestos y lockfiles como JSON; no se importó código propio ni se consultó un registro externo.

| Área | Rango declarado | Versión resuelta en lockfile | Evidencia |
|---|---|---|---|
| Svelte / SvelteKit | `^5.56.1` / `^2.63.0` | 5.56.3 / 2.70.3 | [manifiesto frontend](../catalogo-vgv/package.json), [lock frontend](../catalogo-vgv/package-lock.json) |
| Vite | `^8.0.16` | 8.0.16 | Mismos archivos |
| Express | `^4.19.0` | 4.22.3 | [manifiesto backend](../Backend/package.json), [lock backend](../Backend/package-lock.json) |
| Mongoose | `^9.9.2` | 9.9.2 | Mismos archivos |
| Nodemailer / Sharp | `^10.0.16` / `^0.35.5` | 10.0.16 / 0.35.5 | Mismos archivos |
| JWT / bcrypt | `^9.0.3` / `^6.0.0` | 9.0.3 / 6.0.0 | Mismos archivos |
| Runtime | Node 20 en Docker/CI | Node local v24.15.0 | [Dockerfile](../Dockerfile), [workflow](../.github/workflows/ci-main.yml), proceso local de solo lectura |

Las versiones lockfile no prueban versiones desplegadas ni paquetes instalados. Mongo de desarrollo usa imagen `mongo:7`; no se comprobó versión/configuración del servidor real. Sintaxis aceptada por Node local no garantiza build/runtime en Node 20.

### 2.2 Responsabilidades y entradas

- [server.js](../Backend/server.js): Express, parseo limitado, middleware de seguridad, assets, rutas, fallback SPA, Socket.IO y conexión/seed al arrancar directamente. Importarlo no es una inspección inocua: prepara logger y puede crear directorio/logs; por eso no se importó.
- [products.store.js](../Backend/data/products.store.js): modelo Product, conexión, seed, normalización y CRUD.
- [customers.store.js](../Backend/data/customers.store.js): Customer, credenciales/perfil; email único, `googleSub` único sparse y versión de sesión.
- [cotizar.controller.js](../Backend/controllers/cotizar.controller.js): esquema/modelo Quotation, solicitudes, SMTP, consulta y transiciones.
- [product-images.store.js](../Backend/data/product-images.store.js): GridFS `productImages`, archivos/chunks; asociación a Product.
- [mail.js](../Backend/config/mail.js): transporte SMTP con pool. Contacto/cotización y cuentas usan ese transporte; no se hicieron envíos.
- [vite.config.js](../catalogo-vgv/vite.config.js): SvelteKit estático en modo habitual/Docker y adapter Vercel cuando se declara `VERCEL`.

### 2.3 Rutas y acceso efectivo

| Superficie | Rutas comprobadas | Protección / limitación |
|---|---|---|
| Pública | `GET /api/products`, `/api/productos` y `/:id`; `GET /api/product-images/:id` | Productos sin costo en respuesta; lectura de productos puede activar seed implícito. |
| Autenticación interna | `POST /auth/login` | Bcrypt, limitador y JWT. |
| Productos internos | `GET/POST /admin/products`, `GET/PUT/DELETE /:id`, `POST /bulk`, `POST /images` | Middleware administrativo y rol `admin`, no permisos diferenciados. |
| Cotizaciones | `POST /api/cotizar`; `GET /api/cotizar`; `PATCH /:id/estado` | Crear es público y limitado; consultar/modificar estado exige admin. |
| Contacto | `POST /api/contacto` | Limitador; ruta a controlador de correo. |
| Cliente externo | `/api/clientes/*` | **Desconectado:** 404 en Express; [página de cuenta](../catalogo-vgv/src/routes/cuenta/+page.js) redirige al inicio. |
| Salud | `GET /health` | Solo `{ok:true, service:...}`; no prueba DB, índices, GridFS o SMTP. |

Evidencia: [rutas públicas](../Backend/routes/products.public.routes.js), [internas](../Backend/routes/products.routes.js), [auth](../Backend/routes/auth.routes.js), [cotizaciones](../Backend/routes/cotizar.routes.js), [imágenes](../Backend/routes/product-images.routes.js), [contacto](../Backend/routes/contact.routes.js), [clientes conservadas](../Backend/routes/customer.routes.js) y montaje en [server.js](../Backend/server.js).

### 2.4 Despliegue

- Docker compila frontend y sirve assets estáticos mediante Express. Un endpoint SvelteKit de servidor no existe como función ejecutable en ese modo.
- [vercel.json](../vercel.json) declara frontend/backend separados y rewrites `/api/*`, `/auth/*`, `/admin/products*`, `/health` a Express. La invocación efectiva de endpoints SvelteKit por SSR o desarrollo debe validarse en staging, no inferirse para todo acceso.
- [docker-compose.yml](../docker-compose.yml) solo levanta Mongo con volumen persistente, puerto 27017 publicado y sin autenticación declarada. El volumen **no es un backup** y el binding no restringe a loopback.
- [DEPLOY_PRESENTACION.md](../DEPLOY_PRESENTACION.md) recomienda `AUTO_SYNC_SEED=true`. Esa recomendación es incompatible con preservar todos los campos administrados del store actual.
- [Dockerfile](../Dockerfile) usa `COPY . .`; [.dockerignore](../.dockerignore) no excluye `.env`/archivos privados de autenticación. Riesgo condicional de incluirlos si están en el contexto; no se inspeccionó su existencia/contenido ni se construyó una imagen.

## 3. Trazas de datos e inventario

### 3.1 Seed explícito e implícito

```text
GET productos o detalle
  -> controller
  -> listProducts/getProductById
  -> ensureReady
  -> conexión Mongo + seedIfEmpty
  -> countDocuments == 0 ? insertMany(seed normalizado) : sin insert

npm run dev
  -> Docker Compose
  -> smoke-dev.mjs
  -> listProducts
  -> misma inicialización mutante si la base está vacía

Arranque directo con AUTO_SYNC_SEED habilitado
  -> syncSeedProducts
  -> ensureReady
  -> updateOne/upsert por ID con $set de campos del seed
  -> removeMissing habilitado ? deleteMany(ID no incluido) : sin borrado

sync:seed / sync-products.js [opción --remove-missing]
  -> carga dotenv/config
  -> mismo syncSeedProducts
```

Evidencia: [store](../Backend/data/products.store.js), funciones `seedIfEmpty`, `ensureReady`, `syncSeedProducts`; [script seed](../Backend/scripts/sync-products.js); [smoke](../scripts/smoke-dev.mjs); [scripts raíz](../package.json).

La sincronización excluye `imagen` y `relatedProductIds` del `$set` de existentes, **no** nombre, descripción, clasificación, costo, stock, estado o variantes. `AUTO_SYNC_REMOVE_MISSING` requiere que se llame al sync para producir el borrado; no basta definirlo aisladamente. El script tiene su propia opción de CLI. Ninguna de estas operaciones se ejecutó.

### 3.2 Estado, stock y variantes

- Stock está en Product como Number global; variantes contienen SKU/medida/mínimo, sin cantidades ni unicidad declarada. No hay libro de entradas/salidas/ajustes en los flujos revisados.
- [products.controller.js](../Backend/controllers/products.controller.js), `buildCreatePayload`: estado “sin stock” devuelve stock cero aunque llegue cantidad; “disponible” exige cantidad positiva.
- `buildUpdatePayload`: “sin stock” fuerza cero; “disponible” sin stock explícito asigna stock actual si positivo o `1`; enviar solo stock también deriva estado. [Dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte), `toggleStatus`, envía solo estado y alcanza ese comportamiento.
- `normalizeVariantes` genera SKU de fallback, descarta variantes sin medida y redondea mínimo; usa variantes del seed si no recibió un array. El DTO también pasa por ese normalizador.
- `updateProductById` lee ficha, mezcla patch y normaliza todo, luego `$set` de esa ficha, sin comparación de versión; `versionKey:false`. Una modificación de descripción puede persistir cambios de normalización en variantes/otros campos o pisar una imagen actualizada entre lectura y escritura.
- [ProductForm](../catalogo-vgv/src/lib/components/ProductForm.svelte), `syncForm`/`handleSubmit`, carga la salida normalizada y reenvía múltiples campos; no sirve para extraer un inventario fiel de documentos crudos.
- `id` tiene índice único declarado; `codigo` solo índice no único, SKU ninguno. **No se comprobó que los índices estén creados en la DB real**. Crear con máximo numérico + 1 no es atómico.

No se puede deducir stock por variante de un único stock de producto. La evolución a una bodega/SKU requiere inventario crudo y conciliación aprobada; no se propone reparto automático ni copia de la cantidad total a cada variante.

### 3.3 Imágenes, operaciones parciales y eliminación

- Carga autenticada, Multer en memoria y Sharp validan bytes, dimensiones y formato; guardan WebP en GridFS y luego asocian con filtro `id + expectedImage`. Conservar estos controles.
- `associateProductImage` cambia solo imagen; tiene comparación útil contra carrera entre cargas. Esto no protege contra el escritor general de productos que reescribe una ficha completa antigua.
- Si la asociación se rechaza, hay intento de limpieza del nuevo archivo; si el commit es incierto se conserva para no borrar una imagen potencialmente asociada. `saveProductImage` intenta abortar si falla el upload. No hay prueba de que existan huérfanos, solo caminos que pueden dejarlos.
- No hay limpieza de imágenes anteriores en una sustitución exitosa ni de imágenes en `deleteProductById`; no recomendar borrarlas automáticamente en E0.
- `deleteProductById` hace borrado y luego limpieza de relaciones en una segunda operación sin transacción. Puede borrar el documento y fallar limpiando referencias; las cotizaciones conservan sus líneas snapshot.
- Importación usa `bulkWrite(ordered:true)` sin transacción: un error posterior no revierte operaciones previas. El 500 de importación no informa qué parte quedó confirmada. Upsert por código presupone correspondencia inequívoca que el índice no garantiza.
- Alta/edición atrapan cualquier excepción como 400 y pueden devolver el mensaje técnico; errores de infraestructura no deben parecer entrada inválida.
- [save-product.js](../catalogo-vgv/src/lib/utils/save-product.js) conserva el producto confirmado si falla la imagen y reintenta sobre el mismo ID: garantía que debe mantenerse.

## 4. Catálogo, autenticación y cotizaciones

### 4.1 Catálogo

Las dos rutas de listado SvelteKit ([products](../catalogo-vgv/src/routes/api/products/+server.js), [productos](../catalogo-vgv/src/routes/api/productos/+server.js)) responden muestra con 200 ante excepciones/backend no exitoso; forma inesperada no-array produce array vacío exitoso. Los dos detalles ([products](../catalogo-vgv/src/routes/api/products/[id]/+server.js), [productos](../catalogo-vgv/src/routes/api/productos/[id]/+server.js)) convierten backend no exitoso en 404 y usan muestra ante excepciones.

La [página catálogo](../catalogo-vgv/src/routes/catalogo/+page.svelte) tiene error y reintento, pero no puede distinguir muestra exitosa. Carga todo, filtra taxonomía y oculta productos sin cantidad positiva/estado disponible. Backend público entrega todos los productos sin costo; admin recibe costo. No hay paginación/búsqueda de servidor en esas rutas.

La política futura de mostrar sin stock está confirmada, pero **no se cambia en esta auditoría**. La corrección E0 de stock no debe presentarse como si ya entregara esa funcionalidad comercial.

### 4.2 Autenticación y seguridad antes de roles

- [auth.controller.js](../Backend/controllers/auth.controller.js) usa archivo externo o variables privadas, bcrypt y JWT con expiración configurable; falta de configuración falla cerrada. No se leyó archivo de usuarios ni valor efectivo de credenciales.
- [auth.js](../Backend/middlewares/auth.js) exige secreto en producción/Vercel, firma válida y rol admin; no consulta usuario activo ni revocación después de emitir token. Desactivar el usuario de origen no revoca por sí mismo el JWT ya emitido.
- [login](../catalogo-vgv/src/routes/admin/login/+page.svelte) guarda JWT en localStorage. En modo frontend servido por Express, CSP permite inline scripts; no se encontró/reprodujo una XSS. Exposición del token es un riesgo condicionado a ejecución maliciosa en ese origen, no acceso público demostrado.
- [security.middleware.js](../Backend/middlewares/security.middleware.js) configura Helmet, CORS con credentials, sanitización y límites; [rateLimit.js](../Backend/middlewares/rateLimit.js) cuenta en memoria por instancia. Bloquear user-agent no es autenticación ni defensa suficiente.
- Cookie cliente conservada tiene HttpOnly, Secure en producción/Vercel, SameSite=Lax y audiencia propia. Hay verificación email, reset y versión de sesión, pero no aprobación manual, rechazo ni tier. Google tampoco los añade.
- [customer.controller.js](../Backend/controllers/customer.controller.js), `getCustomerFromRequest`, captura fallos incluidos los de DB/secreto y devuelve `null`, confundiendo infraestructura con invitado. El alta/reset limita caracteres, no los 72 bytes de bcrypt.
- No se encontró control CSRF explícito en middleware/rutas de clientes revisados. No afirmar que CORS o SameSite son sustitutos. Mantener clientes desconectados hasta validar políticas de origen, propiedad, aprobación manual y CSRF; no se propone reactivarlos en E0.
- Socket valida admin al conectar y [socket.js](../Backend/realtime/socket.js) emite globalmente a conexiones autenticadas; no revalida expiración en cada evento. Al añadir roles deberá segregar suscripciones y datos.
- HTTPS/terminación TLS y orígenes efectivos no se comprobaron. API admin actual no debe abrirse a Ventas/Inventario simplemente cambiando una condición de rol: devuelve costo y permite stock/escrituras amplias.

### 4.3 Cotizaciones

Joi valida nombre/contacto y 1–100 líneas con cantidades enteras positivas. El backend confía en ID, nombre y SKU del navegador sin resolver existencia/pertenencia; no valida mínimos reales. No recibe/aplica un precio comercial en su esquema: campos extra se eliminan. No hay ofertas preliminares con importes, listas/tier ni versiones de oferta implementadas.

`sendQuotation` guarda primero y luego notifica por SMTP. Sin SMTP o con fallo devuelve 202 `ok:true`; existe solicitud, **no** envío confirmado ni tarea durable de reintento. El [checkout](../catalogo-vgv/src/routes/checkout/+page.svelte) trata ambos éxitos igual y vacía el carrito. No hay clave idempotente: un reintento tras perder la respuesta puede duplicar solicitudes.

`getQuotations` devuelve últimas 100 para admin. Cambios de estado validan transición y estado esperado en DB, con historial: conservar ese control. La UI pregunta por pago para `confirmada` y entrega de pedido para `completada`; no implementa cobro/despacho. No se deben reinterpretar estados históricos como evidencia de aceptación/pago.

`getCustomerQuotations`, actualmente desconectado, incluye `customerId` propio **o** registros sin dueño cuyo correo coincida. Eso no acredita pertenencia comercial ni futura cartera compartida. Debe resolverse antes de habilitar historial; no hay acceso externo activo demostrado por ese camino.

## 5. Matriz de riesgos

**Tipos:** C = mecanismo confirmado estáticamente; P = escenario potencial no reproducido; NV = dato operativo no verificable con este acceso. Una fila puede contener C y P sin afirmar que ocurrió el incidente. Prioridad no equivale a vulnerabilidad explotada.

| ID | Prioridad | Tipo | Hallazgo | Recomendación / puerta |
|---|---|---|---|---|
| R01 | ALTO | C/P/NV | Seed sobrescribe y, opcionalmente, borra productos operativos; impacto potencial crítico. | Quitar automatismo; seed explícito no destructivo. Antes de despliegues con datos. |
| R02 | ALTO | C/P | Lecturas y smoke pueden inicializar una base vacía con muestra. | Lecturas sin seed y prueba con base vacía. |
| R03 | ALTO | C/P | Disponibilidad altera cantidad sin operación inventariable. | Separar cambios; no reparar históricos automáticamente. |
| R04 | ALTO | C/P | Normalización completa y carreras pueden alterar SKU/variantes/imagen. | Escritura por campos explícitos y conflicto/revisión controlada. |
| R05 | ALTO | NV | Recuperación Mongo/GridFS/índices sin evidencia. | Ensayo restauración y manifiesto antes de escrituras nuevas. |
| R06 | ALTO | C/P/NV | Muestra exitosa/404 falso oculta falla del backend. | Contratos de error explícitos en cuatro endpoints; verificar topología. |
| R07 | ALTO | C/P | Solicitudes no validan catálogo/variantes; correo pendiente no durable. | Validación acotada y estados de recepción/aviso; no inventar precio. |
| R08 | ALTO antes de reactivar | C/P | Historial por email y ausencia de aprobación/tier en clientes conservados. | Mantener desconectado; propiedad fuerte y habilitación manual antes de versión nueva. |
| R09 | ALTO antes de roles | C/P | Sesión admin sin revocación persistente/permiso por objeto y token local. | Baseline auth, contratos de permiso/campo, decisión de sesión; no ampliar roles aún. |
| R10 | MEDIO | C/P | Importaciones/borrados parciales, códigos ambiguos e ID max+1 concurrente. | Ensayos de fallo, errores honestos y diseño de idempotencia/concurrencia. |
| R11 | MEDIO | C/P/NV | Imágenes antiguas/huérfanas posibles; falta inventario de referencias. | Preservar bytes/referencias; inventario y backup, no garbage collection automática. |
| R12 | MEDIO | C/NV | Consulta completa y salud que no representa DB. | Separar readiness read-only; medir antes de optimizar/paginar. |
| R13 | ALTO condicional | C/P/NV | Docker copia contexto sin excluir secretos locales; Mongo local expuesto. | Revisar contexto y red en entorno aislado, exclusiones explícitas; no presumir filtración. |
| R14 | MEDIO | C/NV | Versiones/runtime y rutas distintas entre CI, Docker y Vercel. | Construcción reproducible posterior en aislamiento y mapa de rutas efectivo. |

### 5.1 Fichas de evidencia, fallo, impacto y verificación

Cada ficha complementa prioridad/recomendación de la matriz e identifica dependencias y prueba necesaria.

**R01 — Seed:** [products.store.js](../Backend/data/products.store.js), `syncSeedProducts`; [server.js](../Backend/server.js), flags/arranque; [sync-products.js](../Backend/scripts/sync-products.js). **Escenario:** reinicio con auto-sync pisa stock/costo/variantes; `removeMissing` borra productos agregados fuera del seed. **Impacto:** catálogo comercial e inventario incorrectos o perdidos. **Dependencias:** confirmar flags efectivos y destino sin revelar valores; respaldo probado y decisión sobre seed demo. **Prueba futura:** fixtures con producto modificado y extra; sync repetido conserva ambos, variantes e imagen; modo ordinario no borra.

**R02 — Lectura:** mismo store, `ensureReady` → `seedIfEmpty`; [smoke](../scripts/smoke-dev.mjs). **Escenario:** base equivocada/vacía recibe datos de ejemplo al consultar. **Impacto:** contaminación oculta y diagnóstico falso de recuperación. **Dependencias:** separar readiness de inicialización y aislar credenciales de prueba. **Prueba futura:** snapshot crudo y conteo antes/después de lista/detalle/smoke, incluyendo varios procesos; cero mutación de negocio.

**R03 — Stock:** [controlador](../Backend/controllers/products.controller.js), `buildCreatePayload`/`buildUpdatePayload`; [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte), `toggleStatus`. **Escenario:** cantidad 18 → ocultar/sin stock → 0 → activar → 1. **Impacto:** pérdidas ficticias y promesas erróneas. **Dependencias:** aprobar contrato de disponibilidad independiente y comunicar cambio UI. **Prueba futura:** cambios de estado con cantidades 0 y positivas conservan exactamente cantidad; ajustes explícitos siguen validados.

**R04 — Normalización y carrera:** [store](../Backend/data/products.store.js), `normalizeVariantes`, `normalizeEstado`, `updateProductById`; [ProductForm](../catalogo-vgv/src/lib/components/ProductForm.svelte). **Escenario:** editar texto vuelve a guardar variante omitida/generada por DTO; dos operadores pisan campos/imagen sin saberlo. **Impacto:** pérdida de identidad SKU, costo o referencias administradas. **Dependencias:** fixtures crudos, campos originales preservados y estrategia de control de concurrencia aprobada. **Prueba futura:** variantes legacy sin medida/SKU, IDs de subdocumento y campo no editado permanecen idénticos; update de descripción no pisa imagen concurrente; ediciones obsoletas producen 409.

**R05 — Recuperación:** [compose](../docker-compose.yml) declara volumen; búsqueda de scripts no encontró backup/restore ni migraciones propias en alcance. **Escenario:** corrupción/borrado y única copia no recuperable. **Impacto:** parada y pérdida de catálogo/cotizaciones/PII. **Dependencias:** operador, topología, acceso autorizado a copia, RPO/RTO y custodia privada. **Prueba futura:** restauración independiente de colecciones, índices, GridFS/assets y comprobación de identidades/checksums en staging; no basta dump o volumen existente.

**R06 — Catálogo:** cuatro endpoints SvelteKit citados en 4.1. **Escenario:** caída DB/API devuelve muestra o 404 que parece “no existe”. **Impacto:** cotizaciones basadas en datos falsos y falla no detectada. **Dependencias:** mapa real de routing por despliegue, UI existente de error. **Prueba futura:** backend 500/503, timeout, JSON inválido/forma no-array, 404 real y éxito; jamás muestra/array vacío exitoso por fallo técnico. API Express y cliente normal mantienen contrato.

**R07 — Solicitudes:** [cotizar.controller.js](../Backend/controllers/cotizar.controller.js), `sendQuotation`; checkout citado. **Escenario:** SKU inventado/mínimo incorrecto, reintento duplicado o SMTP fallido sin seguimiento. **Impacto:** trabajo manual erróneo y solicitud sin respuesta. **Dependencias:** política de líneas legacy ambiguas y notificación pendiente. **Prueba futura:** resolver ID/SKU en backend sin exigir stock positivo; límites y pertenencia; error DB no da éxito; correo falso que falla conserva solicitud e informa aviso pendiente. Idempotencia/outbox completas pueden ser entrega siguiente.

**R08 — Clientes desconectados:** [customer.controller.js](../Backend/controllers/customer.controller.js), [modelo](../Backend/data/customers.store.js), `getCustomerQuotations` en controlador de cotizaciones. **Escenario:** montar rutas sin revisión concede acceso con solo email verificado y liga históricos por correo. **Impacto:** exposición comercial y clientes no autorizados. **Dependencias:** contrato aprobación/rechazo/tier y vínculo de históricos; no es permiso para habilitar cuentas ahora. **Prueba futura:** dos clientes, correo de un tercero, mismo RUT declarado, pendientes/rechazados; nunca acceso ajeno ni condiciones privadas antes de habilitación.

**R09 — Sesión interna:** auth/login/middleware, [seguridad](../Backend/middlewares/security.middleware.js), servidor/socket citados. **Escenario:** token robado o usuario deshabilitado conserva autoridad hasta expirar; ampliar rol entrega datos completos. **Impacto:** cambios de catálogo y lectura de PII/costos. **Dependencias:** elegir cookie/CSRF o transición de bearer, revocación y matriz aprobada. **Prueba futura:** ausente/expirado/rol externo → denegado; desactivación revoca; DTO/eventos/exportación no filtran costo/PII; CSRF si cookie. No se reprodujo robo de token.

**R10 — Escrituras parciales:** store `bulkUpsertProductsByCode`, `createProduct`, `deleteProductById`; controlador importación. **Escenario:** batch falla en fila posterior con previas aplicadas; delete elimina pero falla limpieza; altas coinciden. **Impacto:** reintentos confusos, relaciones rotas, duplicidad/errores de catálogo. **Dependencias:** política de lote/idempotencia y unicidad validada en datos crudos. **Prueba futura:** inyección de fallo solo en DB sintética, reporte preciso, reintento controlado y conservación de IDs; no agregar índice único sin inventario.

**R11 — Archivos:** [store imágenes](../Backend/data/product-images.store.js), [controlador imágenes](../Backend/controllers/product-images.controller.js). **Escenario:** imagen guardada con resultado de asociación incierto, o reemplazada/borrada su ficha; archivo queda sin referencia o referencia queda inválida. **Impacto:** almacenamiento acumulado o imagen rota; limpieza apresurada puede borrar imagen usada. **Dependencias:** inventario Product→URL→GridFS y backup. **Prueba futura:** integridad de chunks y hashes tras restaurar; conflictos de carga preservan referencias; no borrar huérfanos no confirmados.

**R12 — Salud/volumen:** `listProducts`, `/health` y catálogo citados. **Escenario:** servicio responde salud pero DB falla; crece catálogo y aumenta transferencia. **Impacto:** monitoreo falso/latencia. **Dependencias:** métricas y contratos de health. **Prueba futura:** DB falsa inaccesible diferencia liveness/readiness sin seed; paginación solo cuando se apruebe objetivo medible, no en esta auditoría.

**R13 — Entorno:** Dockerfile/.dockerignore/compose citados. **Escenario condicional:** archivo privado presente entra al build o Mongo local escucha en red compartida. **Impacto:** exposición de secretos/datos. **Dependencias:** revisión local del propietario sin imprimir contenidos y diseño de red. **Prueba futura:** build aislado con archivo centinela sintético debe excluirlo; comprobación de binding privado. No se construyó, escaneó imagen ni inspeccionó secretos reales.

**R14 — Publicación:** workflow, Dockerfile, vite/vercel y scripts raíz citados. **Escenario:** resultado en Node 24 se supone válido en Node 20; falla copy/postbuild de raíz en Windows; rutas servidor/estático no equivalentes. **Impacto:** despliegue fallido/catálogo inaccesible. **Dependencias:** runtime objetivo y plataforma activos. **Prueba futura:** CI con lockfiles/runtime objetivo, build en área desechable y ruta efectiva por entrada pública/SSR; sin cambios de dependencias no aprobados.

## 6. Estado de pruebas y comprobaciones ejecutadas

### 6.1 Pruebas existentes inspeccionadas, no ejecutadas

| Archivo/área | Garantía contemplada | Límite |
|---|---|---|
| [admin-auth-config.test.js](../Backend/tests/admin-auth-config.test.js) | Falta de configuración, bcrypt y prioridad de contraseña | Modifica variables del proceso durante el test; no prueba revocación ni roles nuevos. |
| [product-form-image.test.js](../Backend/tests/product-form-image.test.js) | Guardar ficha/imagen, fallos y reintento con HTTP falso | No prueba Mongo real ni concurrencia persistente. |
| [product-images-http.test.js](../Backend/tests/product-images-http.test.js) | Auth, multipart y límites | Levanta un servidor loopback; las ramas probadas evitan Mongo. No se ejecutó. |
| [product-images.test.js](../Backend/tests/product-images.test.js) | Formatos, compresión, dimensiones, matching y evento sin costo | No valida respaldo/recuperación GridFS. |
| [related-products.test.js](../Backend/tests/related-products.test.js) | Normalización y validación de relaciones | No valida atomicidad de borrado y limpieza. |
| [hooks.server.test.js](../catalogo-vgv/src/hooks.server.test.js) | Headers anti-frame | No prueba HTTPS real ni CSP de todos los despliegues. |

La auditoría anterior registra 30 pruebas backend, una prueba de headers y lint aprobados. **Son resultados históricos, no nuevas ejecuciones.** El workflow actual sí ejecuta tests backend, lint/build frontend y una lista parcial de syntax checks; no se consultó el resultado de ningún run remoto.

### 6.2 Comprobaciones realizadas en esta ejecución

Antes de usar terminal se clasificaron los comandos como lectura o análisis sin ejecución de aplicación:

1. `git status --short --untracked-files=all`, `git rev-parse HEAD`, `git ls-files`: estado/commit/inventario, sin modificar historial.
2. `Get-ChildItem` y `Get-FileHash`: existencia previa de documentos y huellas SHA-256 para verificar preservación.
3. Lecturas con `view` y búsquedas `rg` en código/configuración/tests; búsqueda focalizada de backup/restore/migraciones, sin leer logs/usuarios/secretos.
4. Parseo de lockfiles con Node y módulo nativo `fs`, leyendo únicamente JSON: versiones de 9 dependencias y Node local.
5. `node --check` sobre **34 archivos JS backend versionados**: todos aceptados, código de salida exitoso. Solo parsea; no importa ni ejecuta módulos ni inicializa DB/logger.
6. Revisión documental final: enlaces locales, formato, estado Git y hashes de informes anteriores.

Incidencias inocuas de herramientas: el primer parseo PowerShell de lockfile falló por conversión JSON; el segundo intento de Node inline falló por comillas. Ambos sin escrituras ni ejecución de aplicación. Se resolvió pasando script de lectura por stdin a Node, sin crear archivos auxiliares.

**No ejecutado:** `npm test`, `npm run dev`, smoke, seed, build, instalación, lint con herramientas que pudieran generar caché, Mongo/Docker, importaciones, migraciones, HTTP a servicios ni SMTP. No se inspeccionaron credenciales ni logs. No se cambió ninguna variable de entorno.

## 7. Incertidumbres, recuperación y recomendaciones

### Evidencia aún requerida

- Configuración efectiva de flags seed/destino Mongo, índices reales y datos; no se puede decir que se haya borrado o alterado inventario en producción.
- Backup existente, antigüedad, cifrado, política de acceso y ensayo de restore; no inferirlo de Atlas ni de volumen Docker.
- SKU/código duplicados, stock negativo/decimal, campos crudos/IDs de variante y referencias de imagen reales.
- Sesiones, dominio/TLS, CORS/CSRF, CSP, proveedor activo, accesibilidad de Mongo local y resultado de CI/build.
- Entrega SMTP y solicitudes que quedaron sin aviso; no se envió correo para comprobarlo.
- Capacidad de restaurar índices únicos/colaciones/TTL y GridFS con integridad. El procedimiento de prueba está en el [plan E0, sección 4](./PLAN_IMPLEMENTACION_E0_VGV.md#4-respaldo-y-restauración-en-pruebas-procedimiento-no-ejecutado).

### Orden recomendado

1. Autorizar preparación de staging, inventario de configuración saneado y respaldo/restauración probada como puerta operacional.
2. Autorizar primer cambio de código E0-A: retirar seed implícito/automático y hacer inicialización demo explícita no destructiva; sin alterar datos actuales.
3. Corregir escrituras por campos/errores y disponibilidad-stock con pruebas de preservación y concurrencia.
4. Corregir contratos de error de catálogo en todas las rutas equivalentes.
5. Establecer baseline de seguridad/propiedad sin activar cuentas/roles; preparar la validación de solicitudes y avisos sin rehacer comercio.
6. Ejecutar aceptación aislada y recuperar ante fallo antes de aprobación de despliegue.

El inventario por SKU, habilitación manual, tier/listas y cotización preliminar con revisión de Ventas son posteriores a esta protección. Ningún hallazgo autoriza por sí mismo ejecutar una migración, limpiar imágenes ni cambiar configuración real.
