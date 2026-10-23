# Plan de implementación E0 de VGV WEB

**Fecha:** 23 de octubre de 2026.

**Estado:** correcciones locales implementadas parcialmente; E0 sigue **PENDIENTE** de evidencia operacional y aceptación final. No contiene migraciones ejecutables ni autoriza operar sobre producción.

**Evidencia:** [auditoría E0](./AUDITORIA_E0_VGV.md); contexto de evolución en [plan B2B anterior](./PLAN_EVOLUCION_VGV_TIENDA.md), conservado sin cambios.

**Seguimiento local vigente:** [auditoría de compatibilidad E0](./AUDITORIA_COMPATIBILIDAD_E0_VGV.md), §10.7: baseline MongoDB local 8.0.16 real con 14 checks y 3 riesgos reproducidos; correcciones posteriores con **26 checks reales/0 fallos/0 findings**, **89 tests habituales/0 fallos**, 8 de aislamiento y lint/build ejecutados con exit 0. Complementa la evidencia histórica de este plan; no cierra E0 ni autoriza despliegues.

### Correcciones E0.1–E0.3: estado local posterior

| Entrega | Estado verificado | Puerta aún pendiente |
|---|---|---|
| E0.1 Imágenes | Corregido localmente: publicación/borrado coordinados por CAS en metadatos GridFS; solo uploads propios privados pueden eliminarse. Carreras y fallos de chunks/files probados. | Publicados/legacy/huérfanos protegidos se retienen; no GC histórico ni garantía frente a escritores directos externos. |
| E0.2 Código | Corregido localmente con índice único **solo sintético** y canonicalización compartida. Sin precondición se bloquean altas/cambios de código; otras ediciones siguen disponibles. | Diagnóstico/reconciliación histórica, respaldo/restore, índice comercial y transición de clientes requieren autorización separada. Ninguna creación automática de índice al arrancar. |
| E0.3 Parciales | Mitigado: recibo durable por batch/fila, 207 explícito, replay sin repetir confirmadas, retry selectivo y unknown bloqueado incluso desde worker nuevo. Panel conserva identidad y la vincula al informe correcto. | Recuperación manual de unknown/locks, conservación de recibos, pérdida de sesión y E2E de navegador. Sin exactly-once global ni endpoint que libere ambigüedades. |

Impactos aprobados y no desplegados: bulk requiere batchId (428 si falta); 207 no es éxito total; POST/PUT con código pueden devolver 503 por precondición y 409 por duplicidad; caracteres antes descartados ahora se rechazan; nuevas altas individuales usan ID ObjectId string sin modificar históricos. PUT conserva `_expectedUpdatedAt` y 400/409/428. Clientes externos no verificables siguen abiertos.

No se añadieron dependencias ni se modificó el esquema Product; sí metadatos técnicos GridFS y colección de recibos autorizados. Prueba de índice exclusivamente en base local desechable; **no hay migración comercial ejecutada**. La autorización comercial definitiva de campos importables sigue pendiente.

## 1. Alcance mínimo y límites

E0 protege catálogo, variantes, imágenes, stock y solicitudes existentes antes de añadir funcionalidad B2B. Mantener stack y contratos útiles; dividir en cambios pequeños revisables. La ejecución inicial usó mocks; el seguimiento posterior indicado arriba añadió pruebas contra MongoDB local real exclusivamente sintético. No se conectó a Atlas/producción ni se operó sobre datos comerciales o despliegues.

### Incluido en la propuesta

- Lecturas/readiness sin inserciones ni sincronización de muestra.
- Semilla demo explícita, no sobrescritora y sin borrado de faltantes como comportamiento ordinario.
- Cambiar disponibilidad sin modificar cantidad, preservando datos actuales.
- Escrituras de metadata por campos explícitos, conservación de variantes e imágenes y conflictos concurrentes visibles.
- Error técnico de backend sin muestra ni éxito falso en catálogo.
- Respaldo completo y recuperación ensayada; fixtures aislados y matriz de regresión.
- Baseline de seguridad/propiedad y configuración saneada antes de abrir roles/cuentas.

### Excluido

- No implementar todavía SKU/stock por variante, bodega nueva, tier/listas, fórmula de precio, roles adicionales, aprobación de cuentas, precios preliminares automáticos, pagos, despacho o ERP.
- No redistribuir stock global ni reinterpretar `confirmada` como pago/aceptación.
- No limpiar huérfanos GridFS, borrar legacy, crear índices únicos comerciales ni rehacer identificadores/URLs existentes. La excepción aprobada posterior es el índice sintético E0.2 y el formato de ID de altas individuales nuevas, detallados arriba.
- No “optimizar” cambiando paginación/búsqueda en el mismo PR.

### Reglas de negocio ya confirmadas para futuras entregas

Una bodega; Administrador/Ventas/Inventario; aprobación/rechazo manual de clientes, tier 1–5 asignado por administrador, lista por cliente, propuesta de precios revisada por Ventas; sin stock visible/cotizable y **“Fecha por confirmar”** si no hay reabastecimiento confirmado. Una solicitud origina preliminar pendiente de revisión, nunca inventario/pago/despacho.

E0 no implementa esas reglas ni habilita cuentas con verificación email como si fuera aprobación comercial. Fórmulas, descuentos, límites de permiso y parámetros no se inventan.

## 2. Puertas previas y orden de ejecución

| Paso | Objetivo | Dependencia real | Resultado para aprobar |
|---|---|---|---|
| E0-P | Evidencia saneada de entorno, backup y restore | Operador/autorización y destino de prueba aislado | Manifiesto, restore y reconciliación documentados; ninguna suposición sobre respaldo real. |
| E0-T | Base de pruebas reproducible sin servicios reales | Destino sintético identificado; E0-P antes de usar una copia con datos | Runner/fixtures con barrera contra URI/SMTP reales y baseline. |
| E0-A | Eliminar seed en lecturas/arranque; demo explícita | E0-T; decisión de uso de seed | Ninguna consulta escribe muestra; sincronización ordinaria no pisa/borra existentes. |
| E0-B | Escrituras conservadoras y errores honestos | E0-A/T | Metadata no altera variantes/imágenes/stock no enviados; conflicto visible. |
| E0-C | Separar disponibilidad y stock | E0-B/T; contrato UI aprobado | Cantidad preservada en todos los cambios de estado y altas. |
| E0-D | Error explícito de catálogo | E0-T; topología identificada | Cuatro endpoints equivalentes sin fallback exitoso ni 404 técnico falso. |
| E0-S | Barreras de autenticación, propiedad y configuración | E0-T; aprobación de cambios concretos de sesión | No activar clientes/roles ni ampliar datos; regresión de auth/DTO/eventos probada. |
| E0-Q | Endurecimiento acotado de solicitud/aviso | E0-A/B/T; política de líneas ambiguas aprobada | Backend valida pertenencia; no exige stock positivo; mensajes de recepción y correo separados. |
| E0-V | Aceptación integrada y ensayo de reversión | Todos los pasos anteriores que se aprueben; E0-P para publicar | Revisión y firma de responsables, sin despliegue automático. |

E0-D puede desarrollarse en paralelo a B/C cuando la topología esté clara. E0-S no implica una reescritura de sesión; si se decide migrar a cookie, es un PR explícito con CSRF y pruebas en ambos lados, no cambio lateral. E0-Q puede dividirse en dos PR: validación y comunicación de aviso pendiente. Outbox/idempotencia completas necesitan entrega aprobada separada si exceden el mínimo.

**Dependencias bloqueantes:** sin acceso autorizado a respaldo/restore no aprobar cambios de datos ni publicación; sin regla aprobada no activar comportamiento comercial que la requiera. Continuar con tests/documentación aislados no autoriza saltarse esas puertas.

## 3. Cambios mínimos propuestos por entrega

### E0-A — Seed explícito, lecturas sin mutaciones

**Archivos probables:** [products.store.js](../Backend/data/products.store.js), [server.js](../Backend/server.js), [sync-products.js](../Backend/scripts/sync-products.js), [smoke-dev.mjs](../scripts/smoke-dev.mjs), [package raíz](../package.json), [package backend](../Backend/package.json), [guía de despliegue](../DEPLOY_PRESENTACION.md) y pruebas backend nuevas cuando se apruebe implementar.

- **Actual:** `ensureReady` invoca `seedIfEmpty`; lista/detalle/smoke insertan en base vacía. Arranque directo puede sincronizar seed; script siempre sincroniza y opcionalmente borra faltantes.
- **Esperado:** `ensureReady` solo asegura conexión; lecturas devuelven el resultado real. Readiness consulta sin pasar por stores mutantes. Comando demo explícito requiere entorno/destino de prueba y solo inserta faltantes confirmados, sin `$set` de existentes ni `deleteMany`. No conservar una opción de borrado engañosamente “segura”.
- **Flags heredados:** si el código recibe flags que antes activaban sync destructivo, recomendación de transición: fallar con diagnóstico saneado antes de escribir; requerir revisión del operador. No ignorarlos silenciosamente ni habilitar/deshabilitar variables en esta ejecución. El tratamiento definitivo requiere aprobación para no provocar parada no planificada.
- **Riesgo:** demos vacías al quitar inicialización; despliegue anterior con flags activos puede requerir intervención. No resolverlo reintroduciendo seed en GET.
- **Regresión:** base vacía, base poblada y varias lecturas simultáneas; snapshot crudo de stock/costo/variantes/relaciones/imagen; seed repetido; `removeMissing` obsoleto rechazado sin escrituras; smoke sin seed ni correo.
- **Aceptación:** cero mutaciones de negocio en lista/detalle/readiness; ningún producto existente editado/borrado por comando ordinario; muestra solo por acción demo explícita sobre destino permitido.
- **Reversión:** revertir UI/adaptador si falla, mantener bloqueo de sync. No volver al arranque antiguo contra una base operativa ni restaurar DB por un cambio solo de código.

### E0-B — Conservar datos administrados y operaciones concurrentes

**Archivos:** store/controlador de productos; [ProductForm](../catalogo-vgv/src/lib/components/ProductForm.svelte), [save-product.js](../catalogo-vgv/src/lib/utils/save-product.js), [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte); pruebas de guardado, relaciones e imágenes.

- **Actual:** DTO normalizado puede generar/omitir variantes; `updateProductById` vuelve a normalizar/regrabar ficha completa. Formulario reenvía varios campos sin control de revisión. Error DB puede acabar como 400.
- **Esperado mínimo:** persistir solo campos explícitamente editados y validados; no sanear/reparar arrays no editados ni regenerar SKU/costo en una edición de texto. No hacer backfill automático de documentos legacy. Separar normalización de presentación de transformación persistente.
- **Concurrencia:** nunca regrabar imagen/stock/relaciones que no se editaron. Proponer comparación de revisión para edición obsoleta; el token de revisión debe cambiar también en upload/import/operaciones competidoras. Elegir contador o revisión exacta en implementación, sin suponer que un check parcial protege todo. No desplegar control que ignore writers existentes.
- **Errores:** distinguir entrada inválida, conflicto 409 e infraestructura 5xx/503, sin volcar mensajes internos al cliente; log saneado con correlación. Importación con fallo parcial no afirma rollback ni éxito total; acordar semántica de reporte/reintento antes de tocar lote.
- **Riesgo:** clientes/formulario pueden depender de defaults legacy; payload completo antiguo aún puede pisar datos si no se adapta junto al backend.
- **Regresión:** editar descripción conserva bytes/valores de variantes legacy sin medida/SKU, IDs, costo, imagen y relacionados; explicitamente editar variantes valida/rechaza sin pérdida silenciosa; edición concurrente con upload/import se preserva o rechaza 409; mantener retry de imagen sobre ID confirmado.
- **Aceptación:** campos no editados iguales en documento crudo; update de metadata no altera stock; ningún éxito aparente ante commit desconocido.
- **Reversión:** antes de escrituras nuevas, revertir UI/contrato de forma compatible; después, mantener writer seguro y corregir hacia adelante. No eliminar campos o recuperar snapshot que pisaría escrituras posteriores. Sin migración de variantes en este PR.

### E0-C — Disponibilidad independiente de cantidad

**Archivos:** `buildCreatePayload`, `buildUpdatePayload`, normalizadores del store, formulario y `toggleStatus` del dashboard. Revisar importación/seed para que no reintroduzcan cambios laterales.

- **Actual:** “sin stock” fuerza cero; “disponible” sin cantidad puede asignar 1; cantidad sola puede cambiar estado.
- **Esperado:** un patch de estado no toca stock; un patch explícito de cantidad cambia cantidad validada, no recibe una cantidad fabricada por estado. Mantener estado legacy como indicador comercial durante E0, sin migrarlo a un nuevo modelo.
- **Alta:** no descartar stock explícito por estado. Rechazar valores inválidos de cantidad de forma visible; si se requiere cantidad al alta, exigirla, no inventarla. Acordar cómo informa UI una combinación `disponible + 0` sin usarla para prometer entrega.
- **Históricos:** ningún script de “corrección” de cantidades; los ceros/unos existentes podrían ser reales o efectos de la lógica y requieren conciliación, no se pueden reconstruir por inferencia.
- **Riesgo:** UI confundía estado con inventario; cambiar backend sin etiquetas/UI coherentes mantiene error de uso.
- **Regresión:** matriz cantidad 0/18 × estados actual/destino; estado solo conserva cantidad; stock solo no cambia publicación implícitamente; ambos explícitos se respetan bajo validación; valores negativos/no numéricos rechazados; seed/import no sobrescriben stock existente.
- **Aceptación:** estado solo produce delta stock exactamente cero en todos los casos; ninguna unidad generada ni saldo puesto a cero implícitamente.
- **Reversión:** mantener separación, desactivar temporalmente el botón si la UI falla; no volver a estado que borra/inventa cantidades. Restaurar cantidad solo por conciliación aprobada y evidencia, no rollback masivo.

**Compatibilidad comercial:** hacer visibles/cotizables todos los sin stock y “Fecha por confirmar” será una entrega comercial posterior ya acordada. E0 debe garantizar que no se pierda cantidad; no anunciar que el catálogo actual ya cumple esa regla. No crear fecha de reabastecimiento sintética.

### E0-D — Errores de catálogo sin muestra

**Archivos:** listados/detalles [products](../catalogo-vgv/src/routes/api/products/+server.js), [detalle products](../catalogo-vgv/src/routes/api/products/[id]/+server.js), [productos](../catalogo-vgv/src/routes/api/productos/+server.js), [detalle productos](../catalogo-vgv/src/routes/api/productos/[id]/+server.js); [catálogo](../catalogo-vgv/src/routes/catalogo/+page.svelte), carga de detalle y store/controller Express.

- **Actual:** respuestas de muestra exitosas; listado no-array da vacío; detalle transforma 5xx en 404.
- **Esperado:** contrato real array/detalle se conserva en éxito; vacío real es vacío; 404 solo para producto inexistente confirmado; timeout/transporte/formato de backend inválido produce error técnico explícito (502/503 según causa definida), con log saneado y UI de reintento. No fallback de muestra oculto en producción.
- **Riesgo:** catálogo deja de parecer disponible durante caída; es corrección de honestidad, no regresión que se arregle mostrando muestra.
- **Regresión:** todos los aliases y SSR/navegador donde se usen; casos éxito/array vacío/404/500/503/timeout/JSON inválido/no-array; sin cachear fallo/muestra como éxito; preservar títulos/imagen/relacionados.
- **Aceptación:** cero productos de muestra ante fallos; ninguna falla técnica convertida en “producto no encontrado” o array vacío válido. Aclarar rutas activas por adapter.
- **Reversión:** mantener contrato seguro y vista de mantenimiento/reintento; revertir solo cambios de UI si necesario. No restaurar fallback silencioso como solución operativa.

### E0-S — Seguridad y entorno antes de abrir roles

**Archivos probables:** [auth.js](../Backend/middlewares/auth.js), [auth.controller.js](../Backend/controllers/auth.controller.js), middleware seguridad/rate-limit, server/socket, customer/cotizar controllers, DTO, login/dashboard, [.dockerignore](../.dockerignore), documentación. No implica editar todos en un PR.

- **Actual:** admin con JWT localStorage y sin revocación por petición; clientes desconectados, sin aprobación manual; historial por correo; cookies externas sin CSRF explícito en rutas revisadas; Docker sin exclusiones de secretos.
- **Esperado E0:** mantener clientes desconectados y admin exclusivo; tests negativos de todas las rutas mutantes y lectura de cotizaciones; costos solo admin actual; ninguna nueva autoridad en flags/UI/cuerpo de solicitud. Corregir captura amplia que degrada fallas DB a invitado antes de usar identidad para comercio privado.
- **Antes de roles/clientes:** contrato de propiedad fuerte sin asociación automática por email; habilitación manual independiente de email; rechazo/tier/lista solo por admin; permisos de campo/objeto y segregación de eventos. Es diseño/puerta, no implementación de esos modelos en E0.
- **Sesión:** decidir explícitamente transición a cookie con HttpOnly/Secure/SameSite + token CSRF/origen y revocación persistente; si se conserva bearer transitoriamente, documentar riesgo y no convertirlo en permiso global para roles nuevos. No modificar almacenamiento del token solo en una superficie.
- **Entorno:** excluir archivos privados del contexto Docker antes de build real; prueba con centinela no secreto. Mongo de desarrollo limitado a interfaz/red aprobada, sin “arreglar” producción desde compose local. Propuesta pendiente de aprobación; ninguna configuración fue cambiada.
- **Riesgo:** cookies pueden romper orígenes separados; filtro mal diseñado bloquea cliente legítimo; cambios de CSP pueden romper hidratación/Google. Probar en staging, no rebajar controles para resolverlos.
- **Regresión:** token ausente/inválido/expirado/customer no accede a admin/cotizaciones; revocación si se implementa; costos no salen en público/relacionados/eventos; configuración con secreto ausente falla cerrada sin imprimirlo; archivo centinela no entra a build.
- **Aceptación:** no exponer nuevas rutas; baseline negativo y contrato de ampliación aprobado; no secretos en informe/logs/imagen.
- **Reversión:** cerrar funciones nuevas y revocar sesiones de transición cuando corresponda; no reabrir historial por email ni aceptar secretos default. Si falla, mantener acceso restringido.

### E0-Q — Solicitudes y notificaciones honestas

**Archivos:** [cotizar.controller.js](../Backend/controllers/cotizar.controller.js), rutas cotizar, checkout, mail, pruebas.

- **Actual:** líneas del cliente se guardan sin comprobar producto/SKU real; 202 y 200 producen mismo mensaje; no tarea de reintento durable.
- **Esperado acotado:** verificar productos/variante pertenezcan al catálogo, conservar solicitado y generar datos canónicos de servidor; SKU ambiguo/inexistente produce error por línea, no escoger primero ni cambiarlo automáticamente. Productos sin stock no se rechazan por cantidad disponible; política confirmada de cotización, no reserva.
- **Mínimos:** validar solo reglas actuales inequívocas; no inventar múltiplos/unidades futuras. Si los datos legacy no permiten validación fiable, devolver conflicto visible para revisión; aprobar tratamiento antes del PR.
- **Aviso:** mensaje de UI “solicitud registrada; notificación pendiente” ante 202; no prometer email enviado. Registro pendiente/reintento durable requiere contrato y ejecución aprobados; si queda para después, documentar limitación y procedimiento manual con responsable, sin dar E0-Q completo como outbox implementada.
- **No incluido:** cambiar estados a oferta/pago, generar precios por tier o transformar solicitudes en pedidos.
- **Riesgo:** carritos antiguos con SKU faltante pueden necesitar revisión; reintentos actuales pueden duplicar hasta implementar idempotencia aprobada.
- **Regresión:** ID inventado, SKU de otro producto, duplicados/ambigüedad, sin stock, cantidad mínima, DB caída y SMTP falso fallido; solicitud persistida antes del aviso y ninguna escritura de inventario.
- **Aceptación:** servidor no confía en nombres/SKU como autoridad; persistencia y entrega de correo se distinguen; no costo/PII ajena en errores/correos.
- **Reversión:** conservar registros recibidos; pausar envío o bloquear líneas ambiguas con error claro si hay fallo, no restaurar aceptación silenciosa de datos inválidos.

## 4. Respaldo y restauración en pruebas: procedimiento no ejecutado

Este procedimiento es operativo, no un script ni una evidencia de respaldo. Requiere aprobación, operador con acceso y destino de pruebas. No se emiten comandos ejecutables de dump/restore con URI.

### 4.0 Inventario de recuperación respaldado por el código

Preparación operativa documental: los siguientes componentes se comprobaron leyendo sus definiciones, sin conectar con MongoDB. La existencia de un modelo no demuestra que su colección exista ni tenga documentos.

| Componente | Evidencia del repositorio / qué conservar | Confirmación necesaria del responsable de DB |
|---|---|---|
| Productos originales | [products.store.js](../Backend/data/products.store.js): Product con `_id`, `id`, código, descripción, imagen, clasificación, relacionados, costo, stock, estado y timestamps. Conservar documento BSON completo, incluidos campos legacy y tipos, no el DTO normalizado. | Nombre físico, documentos y campos existentes, inventario de referencia y anomalías previas. |
| Variantes y SKU | Array embebido con SKU, medida, mínima e identidad de subdocumento si está persistida. Stock global de producto; no hay stock por variante ni SKU único declarado. | Arrays/identificadores originales, SKU faltantes/duplicados y cantidades reales; no generar SKU ni distribuir stock al restaurar. |
| Categorías y relaciones | Clasificación dentro del producto y `relatedProductIds`; taxonomía de UI en [categorias.js](../catalogo-vgv/src/lib/data/categorias.js), preservada con el artefacto/commit. | Slugs/etiquetas y referencias reales; cualquier colección adicional de categorías debe inventariarse si existe, no se supone por el código. |
| Cotizaciones e historial | [cotizar.controller.js](../Backend/controllers/cotizar.controller.js): Quotation, `_id`, `customerId`, datos de contacto, líneas snapshot, estado, `historialEstados` con estado/fecha/actor y timestamps. | Existencia, conteos, contenido crudo e históricos, vínculos con clientes y anomalías anteriores al backup. |
| Clientes | [customers.store.js](../Backend/data/customers.store.js): Customer con perfil/PII, hashes de credenciales/tokens, fechas de expiración, Google y versión de sesión. Rutas desconectadas no implican ausencia de datos. | Existencia y alcance real; incluir documentos completos en copia restringida, nunca sus hashes/tokens en diagnóstico o Git. El ensayo no habilita cuentas ni reutiliza sesiones reales. |
| Índices y opciones | Product declara `id` único, `codigo` no único y compuesto de fecha/ID; Customer declara email único y Google único sparse; Quotation declara índices de fecha/cliente/correo, uno con collation. | Definiciones efectivamente instaladas, índices adicionales, opciones/validadores de cada colección. Declaración Mongoose no acredita creación. No hay TTL explícito declarado en estos tres esquemas; conservar cualquier TTL real encontrado. |
| GridFS e imágenes | [product-images.store.js](../Backend/data/product-images.store.js): bucket `productImages`; conservar `.files`, `.chunks`, IDs, metadatos, bytes y URL/referencia de Product, además de assets estáticos. | Colecciones/índices reales del bucket, mapa de referencias y archivos locales/externos efectivamente usados. Las URLs externas no incluyen sus bytes en un dump Mongo. |
| Servicio/configuración | Artefacto y commit, lockfiles, versiones, adapter/routing, flags seed, mapa de assets y política de orígenes/configuración no secreta, según sección 5. [auth.controller.js](../Backend/controllers/auth.controller.js) también admite configuración administrativa externa a Mongo. | Plataforma efectiva y dependencias externas. Secretos, archivo privado de usuarios y claves de recuperación requieren custodia separada; no van al manifiesto público ni se presume que estén en el dump. |

No hay cantidades esperadas disponibles desde el repositorio. El responsable debe generar un inventario privado consistente con el punto del backup; sin esa referencia solo puede evaluarse estructura/integridad del archivo, no afirmar igualdad de datos restaurados.

### 4.1 Definir alcance y consistencia

1. Identificar vendedor/sistema responsable, entorno origen, DB exacta, topología/versión y un destino nuevo aislado. Verificar sin revelar URI, contraseña, token o hostname sensible.
2. Acordar RPO (pérdida temporal máxima tolerable), RTO (tiempo máximo de recuperación), responsables, retención, cifrado y acceso. No asignar valores por suposición.
3. Elegir backup consistente soportado por topología: snapshot gestionado verificado, o dump consistente conforme a sus capacidades. Un dump de colecciones mientras hay escrituras puede mezclar puntos temporales; usar pausa autorizada de escrituras o mecanismo consistente del proveedor. No añadir `oplog` indiscriminadamente a un dump parcial.
4. Incluir colecciones Product, Customer, Quotation y cualquier colección adicional realmente existente; metadatos de índices (unique/sparse/collation/TTL), opciones/validadores, GridFS `productImages.files` y `productImages.chunks`, assets en `public`, artefacto/código exacto y configuración necesaria en custodia privada separada. Nombres físicos deben confirmarse en DB; no asumir pluralización por el nombre Mongoose.
5. No tratar Excel exportado, el catálogo normalizado ni volumen Mongo como sustitutos de backup. El DTO puede eliminar campos/variantes y excluye datos/índices.

### 4.2 Capturar manifiesto seguro

- Identificador de backup, hora/punto consistente, versión de servidor/herramienta, colecciones/índices incluidos, conteos y checksums por archivo; no incluir secretos ni PII en repositorio.
- Manifiesto privado de IDs/referencias, stock/costos/variantes crudos y relación producto→imagen. Protegerlo como dato real, no adjuntarlo al PR.
- Copias cifradas con custodia aprobada; ensayar que se dispone de claves y permisos de recuperación sin publicarlos.
- No borrar backups previos ni “limpiar” documentos/huérfanos para facilitar el ensayo.
- Generar una copia nueva con identificador único en un destino de respaldo aprobado; si el nombre ya existe, detenerse sin sobrescribir. Registrar autorización, responsable, origen mediante alias privado inequívoco, zona horaria, inicio/fin, punto consistente, método, alcance/exclusiones y resultado.
- Calcular un checksum criptográfico, por ejemplo SHA-256, del archivo final cifrado y de todas sus partes. Registrar el manifiesto por un canal protegido; recalcular tras transferencia y antes de restaurar. Comprobar descifrado y lectura del formato en aislamiento; un checksum coincidente no prueba consistencia lógica ni recuperación del servicio.
- Fuera de Git deben quedar dumps/snapshots, copias de assets con datos privados, inventarios por documento, logs de herramientas sin sanear, configuración privada, credenciales y claves. El informe compartido solo incluye alias no sensibles, IDs de evidencia, resultados y discrepancias agregadas; excluir URI, hosts sensibles, PII, costos por producto, hashes de contraseña/tokens y payloads reales. Revisar también mensajes de error de las herramientas antes de compartirlos.

### 4.3 Restaurar en aislamiento

1. Operador comprueba destino desechable y permite escritura únicamente allí. Nunca usar URI inferida por defaults; no usar `drop` sobre origen o una base cuyo propietario no esté confirmado.
2. Restaurar usando herramientas compatibles y recuperar metadatos/índices. Si un índice único falla, registrar el fallo y revisar duplicados; no degradarlo a no-único para declarar éxito.
3. No arrancar la aplicación restaurada con credenciales de producción. Bloquear egress SMTP/OAuth/servicios reales; usar transporte falso y contexto de prueba. Antes de E0-A, ni una lectura API es garantía de read-only.
4. Cotizaciones/clientes restaurados contienen PII/hashes: restringir acceso, usar anonimización controlada para pruebas funcionales o fixtures sintéticos cuando no se necesite la copia. No enviar notificaciones a direcciones restauradas.
5. Ejecutar verificaciones primero con lector crudo autorizado sin store mutante ni autocreación de índices por arranque de app. Comprobar índices antes de dejar que Mongoose los cree y oculte un backup incompleto.

**Prueba de aislamiento previa a cualquier restore:** el responsable debe aportar identificación de proyecto/cuenta/instancia y DB destino, distinta del origen y validada contra su inventario privado de producción; comprobar también red, volúmenes y permisos para descartar almacenamiento compartido. Un nombre con sufijo `test`, `localhost` o un contenedor no es evidencia suficiente. Usar cuenta de destino restringida a esa instancia/base, sin permisos sobre origen, y verificar privadamente resolución del destino y reglas de red. No probar aislamiento intentando escribir en producción. Separar el acceso usado para obtener la copia del contexto de restauración, donde no deben estar disponibles credenciales de producción.

Registrar la evidencia saneada y la aprobación del propietario antes de habilitar la operación. Si identidad, permisos, volumen o bloqueo de egress no pueden acreditarse, **no restaurar ni arrancar la aplicación**. Esta sesión no ha comprobado que el entorno local cumpla esas condiciones.

### 4.4 Verificar integridad y servicio

- Igualdad de conjuntos `_id`/`id`, conteos y tipos de campos relevantes con el manifiesto.
- SKU/variantes/minimos/costos/stock no transformados; no reasignar cantidades.
- Referencias relacionadas y producto→GridFS; `files.length`, orden/completitud de chunks y hash de los bytes recuperados. Assets públicos también por checksum. Conservar huérfanos sin eliminarlos en el ensayo.
- Igualdad de definición de índices y opciones, no solo cantidad; comprobar consultas representativas con datos sintéticos.
- Comparar por colección contra el inventario del mismo punto consistente, no contra conteos supuestos ni una base origen que siguió cambiando. Productos: `_id`/`id`, códigos, arrays de variantes e IDs embebidos, campos/tipos de costo, stock, estado, clasificación y relacionados deben coincidir sin normalización.
- Cotizaciones: conservar `_id`, propietario, líneas snapshot y orden/contenido/fechas/actor de `historialEstados`, estado actual y timestamps. Clientes: comparar documentos/vínculos originales mediante evidencia privada; no mostrar PII ni hashes. Señalar referencias rotas, SKU duplicados y archivos huérfanos como discrepancias preexistentes o nuevas según el manifiesto, sin repararlas durante el ensayo.
- Cuando E0-A esté aplicado, iniciar aplicación **solo contra destino probado**, sin seed ni SMTP real; comprobar catálogo/detalle, login sintético, DTO público sin costo, GridFS y lectura administrativa. Cualquier CRUD de aceptación utiliza fixtures sintéticos aparte, no modifica el snapshot de referencia.
- Simular indisponibilidad DB y comprobar que salud de proceso no equivale a readiness; no emitir correos reales.
- Registrar tiempos de recuperación y discrepancias. Aprobación escrita técnica y de negocio si RPO/RTO y datos cumplen. Si falla, **backup no validado**, detener publicación.

### 4.5 Recuperación de producción futura

No autorizada aquí. Ante incidente: pausar escritores afectados con aprobación; preservar evidencia y hechos posteriores al backup; elegir corrección hacia adelante o restore controlado más reproducción conciliada. No reemplazar DB completa perdiendo nuevas cotizaciones/ediciones sin decisión expresa. Restaurar en instancia separada y validar antes de cambiar tráfico cuando la plataforma lo permita.

## 5. Configuración efectiva sin revelar secretos

**Ahora:** se verificó configuración declarada, no variables privadas del proceso/proveedor.

**Comprobación futura por propietario**, sin exportar `.env`, `printenv`, `Get-ChildItem Env:`, CLI de secretos ni logs completos:

| Aspecto | Evidencia mínima saneada | Bloqueo |
|---|---|---|
| Entorno y destino | Identificador aprobado de entorno/base y confirmación de coincidencia con inventario privado; no URI | Destino desconocido o fallback no aprobado. |
| Mongo variables | Presente/ausente, fuente preferida `MONGO_URI` sobre `MONGODB_URI`, conflicto sí/no; nombre DB validado privadamente | Dos destinos discrepantes o URI/base no confirmada. |
| Seed | Flags parseados habilitado/deshabilitado; ejecución CLI planificada sí/no | Cualquier automatismo mutante sobre datos reales sin excepción aprobada. |
| JWT/credenciales | Configurado/no configurado, procedencia aprobada, política y ausencia de valores de ejemplo, sin imprimir hash/longitud sensible innecesaria | Secretos ausentes/default, archivo no disponible o credenciales en contexto público. |
| Dominio/orígenes | Same-origin o cross-origin; allowlist aprobada; flags cookie Secure/HttpOnly/SameSite | HTTP no aprobado, CORS ambiguo o sesión incompatible. |
| SMTP/Google | Configuración completa sí/no; transporte de prueba aislado sí/no | Egress real en pruebas; no usar envío real como comprobación aquí. |
| Despliegue/runtime | Commit/artefacto, runtime objetivo, rutas efectivas, plataforma y soporte Socket | Artefacto distinto o topología desconocida. |
| Backup | ID/manifiesto y resultado de restauración en custodia | Solo existencia de volumen/script sin restore. |

El control debe inspeccionar configuración, no importar `server.js` o llamar a stores que escriben. No publicar fingerprints de contraseñas ni copiar credenciales en documentación de “evidencia”.

## 6. Pruebas necesarias y criterios globales

### Base reproducible propuesta

- Mantener runner `node:test` existente; no añadir dependencias sin necesidad aprobada.
- Para unit tests: respuestas/repositorios/SMTP falsos, datos sintéticos y sin modificar variables reales. Suite actual de configuración modifica variables del proceso del test: aislarla de servidor y entorno compartido.
- Para integración mutante futura: Mongo de prueba confirmado, nombre único explícito, cuenta restringida y transporte falso; ningún fallback a URI de producción. Si el destino no se reconoce como permitido, abortar antes de conectar/escribir.
- No `npm run dev` ni `sync:seed` como setup de tests; no importar server con logs/side effects innecesarios. App factory/inyección mínima solo si hace falta para aislar casos aprobados.
- Instalar/build solo en área aislada y con autorización futura; CI de sintaxis/test no implica permiso para tocar datos operativos.

| Caso | Criterio medible |
|---|---|
| Lecturas/readiness | Cero productos/variantes/stock/costo modificados; base vacía sigue vacía. |
| Seed demo | Cero existentes actualizados/borrados; ejecución duplicada no altera registros administrados. |
| Disponibilidad | Cambio de estado conserva exactamente stock anterior; cero unidades fabricadas. |
| Metadata | Igualdad cruda de campos no editados, incluyendo variantes, imagen y relaciones. |
| Concurrencia | Imagen/stock actualizado en paralelo no se pierde; conflicto notificado cuando hay edición obsoleta. |
| Catálogo | Error de transporte/formato/5xx nunca responde muestra o vacío exitoso; 404 solo real. |
| Imagen | Preservar validaciones actuales y reintento sobre producto confirmado; hash/referencia restaurados iguales. |
| Seguridad | 401/403/404 según contrato sin datos reservados; nunca costo en API pública/eventos generales/cliente. |
| Cotización | Catálogo y pertenencia validados; 202 significa registrada/aviso pendiente; cero movimiento de inventario. |
| Recuperación | Backup restaurado con IDs/índices/GridFS verificados y RPO/RTO aprobados. |
| Regresión | Pruebas anteriores siguen pasando en entorno aislado; nuevos tests cubren cada riesgo corregido. |

Las comprobaciones actuales fueron **solo lectura documental, versiones y sintaxis de 34 JS**; no se reclama ninguno de estos tests nuevos como ejecutado.

## 7. Reversión por fase y criterios de parada

- PR pequeño y commit identificable por objetivo; no refactor masivo ni migración comercial mezclada. No se creó ningún commit en esta ejecución.
- Antes de aprobar despliegue, capturar artefacto previo y estado/configuración en custodia privada, sin secretos en Git.
- Revertir código no revierte datos. E0 busca no transformarlos: cualquier cambio inesperado de stock/variantes/imagen detiene escritores y exige conciliación.
- No restaurar una versión con seed automático, estado mutante o fallback engañoso solo para recuperar “verde”. Mantener modo seguro de error/reintento o acceso restringido.
- Si ya hubo escrituras posteriores al backup, preservar y conciliar ese intervalo antes de restaurar; autorización expresa para cualquier pérdida.
- **Parar** ante falta de backup probado, destino ambiguo, diferencia de IDs/stock/referencias, coste público, acceso ajeno, escritura implícita detectada, índice perdido o mensaje de éxito sin persistencia.
- Esta documentación no autoriza pausar servicios, rotar secretos, cambiar flags ni restaurar producción. Esas acciones requieren aprobación operacional separada.

## 8. Decisiones y accesos que requieren aprobación

| Decisión / acceso | Confirmado o pendiente | Qué bloquea / recomendación |
|---|---|---|
| Política seed | Pendiente: conservar demo o importar faltantes | E0-A; sugerir demo explícita sin overwrite/borrado y flags obsoletos rechazados visiblemente. |
| Acceso staging/copia y propietario DB | Pendiente | E0-P/integraciones; no tocar DB sin destino validado. |
| RPO/RTO, retención/cifrado y restore | Pendiente | Publicación; no considerar volumen como respaldo. |
| Contrato de disponibilidad legacy | Pendiente detalle UI; separación de cantidad es objetivo E0 | E0-C; permitir estado sin modificar stock, no recomponer históricos. |
| Visibilidad sin stock y reabastecimiento | Confirmada | Etapa comercial posterior: visible/cotizable y “Fecha por confirmar”; sin fecha supuesta. |
| Identidad/revisión para concurrencia | Pendiente opción técnica | E0-B; cubrir todos los writers y no imponer índice o backfill no aprobado. |
| Sesión admin, CSRF y revocación | Pendiente alcance de cambio E0-S | No abrir roles antes de resolver; si cookie, cambiar cliente/servidor juntos. |
| Aprobación clientes, tier/listas y perfiles | Confirmada en negocio, no implementada | Mantener desconectado hasta entrega que cumpla habilitación/rechazo, propiedad y permisos detallados. |
| Líneas ambiguas/mínimos legacy | Pendiente tratamiento comercial | E0-Q; error por línea o revisión manual explícita; nunca elegir SKU arbitrario. |
| Avisos pendientes/idempotencia | Pendiente extensión de E0-Q | Aprobar incremental; no fingir outbox si solo existe mensaje/log. |
| Precios, descuentos, jerarquía de listas/tramos | Pendiente | Automatización posterior; no bloquea proteger datos ni recibir solicitudes sin precio confirmado. |
| Plataforma y soporte de runtime | Pendiente evidencia efectiva | Ensayo de build/routing en aislamiento; Node local 24 no valida Node 20 desplegado. |

## 9. Aceptación de la propuesta y siguiente autorización

**Primer cambio de código recomendado:** E0-A, desacoplar lectura de seed y retirar sincronización automática destructiva, con tests de conservación; la corrección local está implementada, pero su publicación queda condicionada a E0-P y aprobación operacional. No cambiar datos ni flags para “probarlo”.

**Primera acción operacional recomendada:** autorizar al responsable a identificar un destino aislado y ensayar respaldo/restauración conforme a sección 4, sin usar credenciales/servicios reales desde esta sesión.

E0 se considera implementada solo después de evidencia de aceptación de los cambios y restauración ensayada. La autorización recibida cubre únicamente cambios locales del repositorio y pruebas aisladas; no autoriza acceso a datos, variables o despliegues de producción.

### 9.1 Lista de aprobación operativa de E0-A

Los cambios locales no conceden autorización de backup, restore ni despliegue. Antes de cualquier operación de recuperación o publicación, presentar:

1. **Respaldo verificado:** autorización, manifiesto del punto consistente, alcance completo, checksums comprobados, custodia y disponibilidad de claves de recuperación.
2. **Restauración satisfactoria:** evidencia de restore en destino aislado, comparación con inventario privado de documentos/índices/GridFS, discrepancias resueltas o aceptadas expresamente y RPO/RTO aprobados. La comprobación cruda no debe depender de aplicar E0-A ni arrancar el servidor actual.
3. **Entorno de pruebas inequívoco:** identificación y aislamiento comprobados según 4.3, permisos exclusivos del destino y ausencia de credenciales/egress operativos.
4. **Pruebas de lectura:** casos definidos para base vacía/poblada, lista/detalle/readiness y concurrencia, comparando documentos crudos antes/después y detectando operaciones mutantes aunque dejen valores iguales. La implementación candidata debe demostrar cero inserciones, actualizaciones o borrados; no basta igualdad de conteos.
5. **Pruebas de seed:** fixtures sintéticos con producto editado, producto fuera del seed, variantes/costos/stock/imagen/relaciones propios; ejecución repetida conserva íntegros todos los existentes y nunca elimina faltantes. Flags/opciones heredadas peligrosas se rechazan antes de escribir.
6. **Reversión aprobada:** artefacto seguro de retorno o corrección hacia adelante, responsables y parada; nunca reactivar seed destructivo ni restaurar una copia que pierda escrituras posteriores sin conciliación autorizada.
7. **Decisión y autorización explícitas:** tratamiento del seed demo/flags heredados y alcance del PR; la aprobación de esta documentación no equivale a aprobar implementación.

**Estado operacional: pendiente.** No se ha aportado evidencia de backup/restore, integridad de GridFS, validación de lectura sobre producción ni procedimiento de reversión aprobado. Las pruebas de código ejecutadas en esta tarea usan mocks y no sustituyen esas evidencias. No se relaja esta puerta ni se presenta una prueba futura como pasada.

### 9.2 Registro de ejecución local E0

**Alcance de ejecución:** lectura del código y pruebas locales aisladas. No se conectó a Atlas ni a otra base de datos real, no se cambiaron variables productivas y no hubo despliegues. No se ejecutaron scripts de seed/importación/sincronización.

| Riesgo | Estado | Evidencia local y límite |
|---|---|---|
| R01 — Sincronización destructiva | **PARCIAL**; política local implementada, pendiente aprobación comercial | `syncSeedProducts` usa `$setOnInsert`, rechaza `removeMissing` antes de conectar y no borra productos ausentes. La importación de productos existentes usa una lista permitida y actualizaciones parciales con comparación de `updatedAt`; no borra por ausencia ni cambia ID, código/SKU, precio de costo, imagen, estado o variantes. Solo acepta nombre, clasificación (familia/subfamilia/categoría y slugs) y stock explícito válido. No se actualiza stock ausente, vacío o nulo. La selección de campos importables necesita aprobación comercial antes de producción. |
| R02 — Inicialización automática | **CORREGIDO** en código local | Lecturas solo conectan y consultan; se eliminó `seedIfEmpty`. El comando de seed exige un URI local y entorno no productivo; la sincronización también aplica la misma barrera. Las pruebas mock verifican lista vacía sin escrituras, detalle/lista por IDs y error de conexión como HTTP 500. |
| R03 — Estado altera stock | **CORREGIDO** en las operaciones revisadas | `stock` desconocido se representa como `null`; el schema permite `null` y el valor predeterminado aplica solo a nuevos documentos. Cambiar `estado` no genera ni altera stock. El formulario omite el campo no editado, tabla/exportación distinguen desconocido y el catálogo filtra por estado comercial, no por cantidad. |
| R04 — Normalización/reemplazo | **PARCIAL**; control optimista implementado | `updateProductById` aplica `$set` parcial condicionado a `updatedAt`; si la versión dejó de coincidir, responde conflicto HTTP 409 en vez de sobrescribir. El formulario envía campos realmente modificados y la versión cargada; ante conflicto requiere cancelar/reabrir antes de reintentar. Las importaciones existentes también comparan la versión capturada. No se agregan campos al esquema ni dependencias. El control es conservador a nivel de documento (un cambio en cualquier campo puede exigir refrescar); variantes siguen reemplazándose como lista completa solo ante una edición explícita y exitosa. |
| R05 — Respuesta ficticia | **CORREGIDO** para rutas proxy de listado/detalle | Las cuatro rutas `/api/products`, `/api/productos` y sus detalles no sustituyen errores por ejemplos. Un fallo upstream responde 502; detalle inexistente conserva 404; lista válida vacía conserva 200 con `[]`. La pantalla de catálogo ya diferencia carga/error/vacío. |

#### Archivos y funciones revisados o modificados

- Backend: `Backend/data/products.store.js` (`ensureReady`, `listProducts`, `getProductById`, `getProductsByIds`, `syncSeedProducts`, `bulkUpsertProductsByCode`, `updateProductById`); `Backend/server.js` (arranque); `Backend/scripts/sync-products.js` (restricción de seed local); `Backend/controllers/products.controller.js` (creación, importación y cambios de stock/estado); `Backend/middlewares/adminAuth.js` (eliminación del token de fallback); pruebas nuevas `Backend/tests/product-data-protection.test.js`, `Backend/tests/products-proxy.test.js`, `Backend/tests/admin-auth-fallback.test.js`.
- Frontend: `catalogo-vgv/src/lib/utils/products-proxy.js`; cuatro endpoints proxy `/api/products`, `/api/productos` y `[id]`; `fetchproductos.js`; `save-product.js` (`buildProductPatch`); `ProductForm.svelte`; `ProductTable.svelte`; `catalogo-vgv/src/routes/catalogo/+page.svelte`; `catalogo-vgv/src/routes/admin/dashboard/+page.svelte`.
- Configuración y documentación: `.gitignore`, `.dockerignore`, `Backend/.env.example`, `DEPLOY_PRESENTACION.md` y este plan.
- Se verificaron consumidores de rutas y que las rutas administrativas de productos usan el middleware JWT con rol admin. `Backend/middlewares/adminAuth.js` no tiene consumidores/rutas reales; quedó fail-closed sin token predeterminado. Sigue pendiente una revisión funcional de autenticación completa antes de habilitar nuevos roles.
- `.gitignore` ahora ignora `.env` y `.env.*` con excepciones `.env.example` y `.env.test`; `.dockerignore` excluye `.env*` en el contexto completo. No se imprimieron valores de credenciales.

#### Pruebas y verificaciones ejecutadas

- `npm.cmd --prefix Backend test`: **47 pasaron, 0 fallaron** en la suite completa. La ejecución enfocada de los seis archivos E0 ejecutó **43 pruebas, 43 pasaron y 0 fallaron**. Las pruebas reemplazan `mongoose.connect` y métodos del modelo; no conectan a una base. Incluyen regresiones para importación parcial/no destructiva y control optimista en el panel (descripción sin sobrescribir precio concurrente, conflicto por versión antigua, preservación de ID/SKU/stock desconocido/variantes/referencia de imagen).
- `node --check` en `Backend/data/products.store.js`, `Backend/controllers/products.controller.js`, `Backend/tests/product-data-protection.test.js` y `Backend/tests/product-form-image.test.js`: **4/4 correctos** en esta ejecución.
- `npm.cmd --prefix catalogo-vgv run lint`: **correcto**; Prettier y ESLint finalizaron sin diagnósticos.
- `git diff --check`: **correcto**, sin errores de whitespace.
- En Windows, `npm` fue bloqueado por la política de PowerShell al intentar ejecutar `npm.ps1`; se usó `npm.cmd` equivalente y las pruebas y lint finalizaron correctamente.
- El formato requerido se ejecutó solo sobre archivos frontend modificados. No se ejecutó build completo porque lint y pruebas enfocadas cubren esta ronda; queda para aceptación integrada.

#### Política de importación, concurrencia, stock y migraciones

La política para registros existentes es deliberadamente explícita. La importación puede actualizar `nombre`, `familia`, `familiaSlug`, `subfamilia`, `subfamiliaSlug`, `categoria`, `categoriaSlug` y `stock` únicamente cuando el valor está presente y es válido. El stock solo se acepta si la fila proporciona una cantidad numérica válida (incluido `0`); su ausencia, cadena vacía o `null` no se incluye en `$set`. El emparejamiento es por `codigo`, pero la importación no modifica el código/SKU ni el identificador persistido. No actualiza `precioCosto`, `imagen`, `estado`, `variantes`, referencias de imagen ni campos ajenos a la lista permitida. Al crear un producto nuevo, el archivo debe aportar código, nombre, clasificación y costo válidos; no se inventa stock y se usa la imagen placeholder vigente.

Precio de venta no es un campo del esquema actual. Esta decisión no concede a la importación autoridad sobre otros campos comerciales; cualquier cambio fuera de la lista permitida requiere edición explícita del panel. La lista permitida y la autoridad sobre nombre/clasificación/stock requieren aprobación comercial antes de operar importaciones reales.

La edición del panel requiere `_expectedUpdatedAt`. El backend compara la marca temporal enviada dentro del filtro de actualización atómica, escribe únicamente el patch y devuelve 409 cuando la ficha cambió desde su lectura. El formulario genera un patch comparando el borrador con la ficha cargada; el guardado y el cambio de estado envían la versión observada. Ante un 409 de edición, el panel explica que hay que cancelar y reabrir; ante un 409 al cambiar estado, refresca la lista y solicita reintentar sobre el valor actual. El `updatedAt` existente funciona como versión optimista; no se añade una clave ni se exige migración. Si documentos legacy carecen de `updatedAt`, la versión explícita `null` compara con el campo ausente de MongoDB; debe verificarse en una restauración aislada antes de uso productivo. La estrategia tiene granularidad de documento: cualquier edición concurrente puede requerir refrescar incluso si afecta otro campo. No se reintenta automáticamente sobre datos frescos.

Los scripts o clientes externos que usen el endpoint administrativo `PUT` deben enviar `_expectedUpdatedAt`; el consumidor frontend inspeccionado lo hace. La compatibilidad de clientes no incluidos en el repositorio debe comprobarse antes de desplegar.

`null` representa stock desconocido; `0` representa cantidad confirmada cero y los valores numéricos positivos representan cantidades conocidas. En una edición manual, borrar explícitamente la cantidad la establece en `null`; entradas inválidas se rechazan, no se convierten a cero. En importación, stock ausente, vacío o nulo se omite para preservar el valor existente; solo una cantidad explícita y válida se aplica. Mongoose admite `null` en `Number` y el test local verifica el default `null` sin escribir datos.

**Migración requerida:** no se implementó ni ejecutó una migración. Los documentos antiguos sin `stock` se leen como desconocidos (`null` en el DTO) sin ser reescritos. El cambio del default solo aplica al crear documentos nuevos. Cualquier backfill de documentos históricos queda explícitamente fuera de alcance y requeriría aprobación, respaldo y prueba aislada.

#### Riesgos abiertos, tareas manuales y aceptación pendiente

1. **Pendiente:** copia de seguridad verificable de MongoDB Atlas.
2. **Pendiente:** prueba de restauración aislada con reconciliación de colecciones/índices.
3. **Pendiente:** confirmar integridad y recuperación de ambas colecciones GridFS (`productImages.files` y `productImages.chunks`) y referencias.
4. **Pendiente:** validación operacional de que las lecturas no modifican producción; la prueba mock no satisface esta evidencia.
5. **Pendiente:** procedimiento de reversión aprobado, incluidos responsables y tratamiento de escrituras posteriores.
6. **Pendiente:** validación final firmada de E0 antes de autorizar cualquier cambio en producción.
7. **Pendiente:** aprobación comercial de la lista permitida de importación y confirmación de que nombre, clasificación y stock explícito pueden actualizarse desde planillas.
8. **Pendiente:** revisar clientes externos al repositorio para confirmar que envían `_expectedUpdatedAt` antes de desplegar el nuevo requisito del `PUT`.
9. **Pendiente:** validar el control de concurrencia en entorno aislado restaurado, incluyendo documentos legacy sin `updatedAt` y conflictos en importaciones en lote.

**Criterio final:** E0 permanece **NO COMPLETADA**. Los cambios y pruebas locales son evidencia parcial de código; no demuestran recuperación ni autorizan despliegues. Los cambios deliberadamente no realizados incluyen migraciones, backfills, cambios de esquema en producción, sincronizaciones/importaciones reales, backup/restore operativo, alteraciones de índices/GridFS, habilitación de roles/clientes y funcionalidades E1–E6.
