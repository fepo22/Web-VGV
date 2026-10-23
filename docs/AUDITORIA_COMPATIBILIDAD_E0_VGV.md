# Auditoría local de compatibilidad E0

**Fecha:** 23 de octubre de 2026. **Resultado:** correcciones locales y evidencia automatizada; **E0 NO COMPLETADA**.

## 1. Alcance y límites

Se continuó sobre el árbol local modificado, sin revertir los cambios existentes. Se inspeccionaron consumidores, rutas, controlador, store, escritores auxiliares de Product, importación Excel y pruebas. No se consultaron Atlas, producción, registros operativos ni clientes externos. No se arrancó la aplicación completa, ejecutaron importaciones reales, migraciones, sincronizaciones, despliegues o cambios de entorno de producción.

Las pruebas sustituyen operaciones Mongoose por mocks; el test HTTP de imágenes usa un servidor efímero de loopback. Las URI de los procesos de prueba se fijaron a loopback con puerto 1 como defensa adicional, no como sustituto de los mocks. No se verificaron respaldo ni restauración.

No se modificaron esquema, índices, manifiestos ni lockfiles. La generación local de `dist` es compilación, no despliegue.

## 2. Hallazgos y evidencia

Las severidades expresan riesgo de pérdida de datos o incompatibilidad, no una clasificación de vulnerabilidades explotables.

| ID | Severidad | Evidencia concreta | Estado |
|---|---|---|---|
| C01 | Alta | El catch del panel guardaba `savedProduct` y releía la ficha incluso después de un PUT 400. Podía combinar un borrador antiguo con una versión nueva. [Panel](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte), [helper y guard de recuperación](../catalogo-vgv/src/lib/utils/save-product.js). | Corregido: errores de metadata no habilitan recuperación; una recuperación de imagen solo cambia su referencia, no la versión ni los demás campos del borrador confirmado. |
| C02 | Alta | La asociación de imágenes usaba `updateOne` con timestamps automáticos. No garantizaba avanzar más de 1 ms ni preservar una versión futura. La limpieza de relaciones al borrar tenía el mismo problema. [Store de imágenes](../Backend/data/product-images.store.js), [store de productos](../Backend/data/products.store.js). | Corregido: imagen usa CAS del store; limpieza usa pipeline atómico por documento con `max(NOW, updatedAt + 1 ms)` y timestamps automáticos desactivados. Seed no toca timestamps de existentes. |
| C03 | Alta | Los eventos públicos de productos omiten costo; los de imagen omiten también versión. El panel mezclaba esos eventos con la ficha administrativa. Una versión nueva podía acompañar costo viejo o ausente. [Panel](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte). | Corregido para `productAdded` y `productUpdated`: recarga administrativa en vez de mezclar el evento parcial. La ficha abierta conserva su snapshot. |
| C04 | Alta | Un cambio parcial de categoría del formulario podía activar la rama legacy del PUT: convertir categoría en familia y vaciar subfamilia/categoría. Un cambio de familia también vaciaba categoría omitida. [buildUpdatePayload](../Backend/controllers/products.controller.js). | Corregido: clasificación parcial conserva los campos no enviados. Cambio semántico de compatibilidad explicado en §4. |
| I01 | Alta | La normalización descartaba caracteres del identificador: `A/B` podía seleccionar `AB`. [buildImportPayload](../Backend/controllers/products.controller.js), [parser del panel](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte). | Corregido: se rechazan códigos que requieran descartar caracteres; se conservan trim, mayúsculas y espacios a guiones. |
| I02 | Media | El parser Excel eliminaba letras/símbolos: `2 unidades` podía convertirse en `2`. Coerciones numéricas aceptaban booleanos; las altas del store podían normalizar stock inválido a desconocido sin rechazarlo. [Parser numérico](../catalogo-vgv/src/lib/utils/import-number.js), [controlador](../Backend/controllers/products.controller.js), [store](../Backend/data/products.store.js). | Corregido: validación explícita en Excel, payload y store; cero explícito conserva su significado. |
| I03 | Media | El error de un lote no refrescaba el panel ni detallaba los lotes confirmados. Una respuesta de escritura sin confirmación o una relectura sin producto podían parecer exitosas. [Panel](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte), [bulkUpsertProductsByCode](../Backend/data/products.store.js). | Corregido: aviso de posible parcialidad, recarga sin reintento y rechazo de confirmaciones incompletas. |
| C05 | Media | `new Date` acepta ciertas fechas de calendario inexistentes normalizándolas, por ejemplo 30 de febrero. [updateProductController](../Backend/controllers/products.controller.js). | Corregido: valida calendario, hora, formato zonificado y fecha finita antes de consultar o escribir. |
| R01 | Alta | `codigo` tiene índice no único. Dos altas simultáneas del mismo código pueden crear documentos diferentes; códigos históricos no canónicos también pueden no coincidir con la búsqueda normalizada. [Esquema y búsqueda de importación](../Backend/data/products.store.js). | Abierto. Duplicados existentes encontrados por la consulta bloquean con 409; no se cambió índice ni se hizo backfill. |
| R02 | Media | `bulkWrite({ ordered: true })` no es transacción; un match cero no detiene operaciones posteriores. | Abierto por diseño actual: atomicidad por documento, no por archivo/lote. No hay rollback ni idempotencia del archivo. |
| R03 | Media | No hay inventario verificable de consumidores externos del PUT. Además, el catch general del PUT todavía clasifica algunos fallos de infraestructura como 400. [Controlador](../Backend/controllers/products.controller.js). | Abierto: no se cambió aquí la taxonomía general de errores ni se asumió inexistencia de integraciones. |

Las regresiones están en [protección de datos](../Backend/tests/product-data-protection.test.js) y [guardado/formulario](../Backend/tests/product-form-image.test.js).

## 3. Atomicidad y documentos antiguos

- El PUT ejecuta **un `findOneAndUpdate`** filtrado por `{ id, updatedAt: expectedVersion }` y aplica únicamente `$set` del patch más la nueva versión. `timestamps: false` evita que Mongoose sustituya la versión calculada.
- La nueva fecha es `max(Date.now(), expected + 1 ms)`. Dos escrituras con la misma versión solo pueden encontrar el documento una vez, incluso con reloj atrasado, fecha futura o mismo milisegundo. Se rechaza una versión que no permita producir otra fecha finita.
- Si no coincide, se distingue documento existente (409) de inexistente (404). No se reintenta automáticamente ni se aplica parte del patch fallido. Una edición en otro campo invalida igualmente el snapshot completo.
- La lectura previa del controlador sirve para validar entradas; **no** determina por sí sola la autorización de escritura. Esta depende del filtro atómico.
- El store de imágenes verifica la imagen observada y usa el mismo CAS. Una carrera con metadata puede producir ahora conflicto de imagen en vez de aceptar silenciosamente la operación. Se conserva la respuesta parcial de imagen, sin inventar una nueva versión en cliente.
- La limpieza de referencias por borrado mantiene avance monotónico por documento mediante pipeline. El borrado y la limpieza de otros documentos siguen sin ser transaccionales.

| Documento / entrada | Comportamiento |
|---|---|
| Campo `_expectedUpdatedAt` omitido | HTTP 428, antes de consultar o escribir. |
| `updatedAt` BSON Date | Cliente envía ISO con zona; backend lo convierte a Date y compara el instante en milisegundos. `Z` y offsets equivalentes son consistentes. |
| `updatedAt` ausente o null | GET expone null. Cliente debe enviar null explícito. El filtro Mongo `{ updatedAt: null }` contempla ausencia/null; primera escritura asigna Date, segunda con null recibe 409. |
| `updatedAt` inválido o tipo no Date persistido | No se convierte implícitamente en una versión válida para PUT/importación. Token inválido: 400; token Date que no coincide con tipo persistido, o null contra valor no nulo: 409. Importación con campos a escribir falla antes de enviar bulk. Una fila sin cambios puede no necesitar validarlo. |
| Identificador PUT inexistente | 404, sin alta implícita. |

La reparación de fechas corruptas sigue pendiente de diagnóstico y autorización; no se ejecutó. La limpieza de referencias al borrar, como escritor auxiliar, asigna fecha a registros sin Date; no constituye una migración general ni una validación de documentos antiguos.

**Límite de evidencia inicial:** en esta primera etapa se verificaron filtros, opciones, patches y carreras con mocks. La validación posterior contra motor local real está registrada en §10; no valida índices comerciales ni datos históricos.

## 4. Compatibilidad del PUT administrativo

Se buscaron URLs administrativas, verbos PUT, `updateProductById`, `bulkUpsertProductsByCode` y referencias a `_expectedUpdatedAt` en código/scripts del repositorio.

| Consumidor comprobado | Versión y errores |
|---|---|
| [ProductForm](../catalogo-vgv/src/lib/components/ProductForm.svelte) → [saveProductWithImage](../catalogo-vgv/src/lib/utils/save-product.js) → [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte) | Usa copia del producto cargado al abrir la ficha, no el producto actualizado por Socket.IO. Envía solo diferencias y `_expectedUpdatedAt` de esa copia; null solo para snapshot sin versión. 400 muestra error y conserva versión/borrador; 409/428 recargan lista y exigen cancelar/reabrir, sin rebasing automático. No carga imagen tras fallo del PUT. |
| `toggleStatus` del [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte), invocado por [ProductTable](../catalogo-vgv/src/lib/components/ProductTable.svelte) | Envía estado y versión del producto representado en la tabla. 400 muestra error; 409/428 recargan la lista sin reintentar. No fuerza stock. |
| [updateProductById](../Backend/data/products.store.js) | Consumido por controlador PUT, asociación interna de imagen y pruebas. Todos los usos productivos encontrados pasan Date/null explícitos. El bulk usa su propio filtro CAS y no llama al PUT. |
| [Proxies SvelteKit](../catalogo-vgv/src/lib/utils/products-proxy.js) | Solo lectura; no son consumidores PUT. El PUT de perfil de cliente corresponde a otro recurso. |

No se encontró otro consumidor interno operativo que omita la versión. Los casos sin versión en pruebas son negativos intencionales.

**Clientes externos no verificables:** integraciones ERP, scripts privados, Postman, automatizaciones comerciales, aplicaciones fuera del repositorio y pestañas/cachés con bundles antiguos. No hay evidencia para descartarlos: no se consultaron logs, inventarios de integraciones, despliegues ni tráfico de producción.

### Contrato conservado y ajustes deliberados

- Se mantienen URL, verbo, token `_expectedUpdatedAt`, ISO zonificado/null y respuestas 400/409/428. Un cliente anterior que omite el token sigue recibiendo 428; debe leer la ficha administrativa antes de escribir y resolver conflictos manualmente.
- **Ajuste semántico necesario:** `categoria`/`categoriaSlug` en PUT son ahora campos canónicos de categoría, no aliases de familia cuando se envían solos. El formulario E0 envía diferencias; conservar la rama legacy borraba clasificación válida. Quien use esos aliases antiguos debe enviar `familia`/`familiaSlug` explícitos y los campos que realmente desee vaciar. No se puede garantizar su compatibilidad externa; requiere inventario antes de publicar.
- Los campos omitidos de clasificación ya no se vacían. Si se necesita limpiar descendientes al cambiar familia/subfamilia, el cliente debe enviar sus campos vacíos explícitamente. Nombre enviado sin slug genera su slug; slug explícito se respeta, incluso vacío.
- Se rechazan fechas de calendario inválidas que JavaScript antes normalizaba. El formato no pasa a depender de locale.
- No se modificó el esquema ni se añadió un fallback que acepte clientes sin versión.

## 5. Importación parcial

### Campos permitidos técnicamente

**Existentes:** `nombre`, `familia`, `familiaSlug`, `subfamilia`, `subfamiliaSlug`, `categoria`, `categoriaSlug`, `stock` explícito válido. Los slugs del payload HTTP se procesan asociados al nombre correspondiente. Campos textuales vacíos/ausentes se omiten; no se usan para borrar.

`codigo` identifica; no se actualiza. No se importan ID, SKU de variantes, costo, imagen, estado, variantes, descripción ni relaciones de existentes, aunque se proporcionen explícitamente.

**Nuevos:** código confiable, nombre, familia, subfamilia y costo válido son obligatorios. Se admiten clasificación y stock válido opcionales. ID se genera; imagen placeholder, estado disponible, variantes/relaciones vacías se definen por servidor. Stock desconocido permanece null, nunca cero.

**La autorización comercial definitiva de esta lista sigue pendiente.** Aceptación técnica no autoriza importaciones operativas ni cambios de inventario.

| Caso obligatorio | Resultado y cobertura |
|---|---|
| Existente con campos ausentes | Patch solo de campos autorizados presentes. Sin cambios autorizados no hay escritura; el contador actual puede contar esa fila como actualizada. |
| Stock omitido, null, vacío o espacios | Existente conserva stock; nuevo conserva desconocido/null. |
| Stock negativo, texto, booleano, objeto, array, NaN o infinito | Error de fila en validación HTTP; rechazo del store antes de escribir si se llama directamente. |
| Stock cero explícito | Se escribe 0, independiente de disponibilidad. |
| Identificador ausente o que perdería caracteres | Fila rechazada; no se infiere por nombre, número de fila o SKU de variante. |
| Producto inexistente completo/incompleto | Alta con campos requeridos; incompleto devuelve 400 del lote antes de escribir operaciones preparadas. |
| Duplicados del archivo/lote | Panel detecta repetidos globalmente, incluso entre lotes de 100. Se conserva la primera fila válida y se reportan posteriores; no hay “última fila gana” silenciosa. Llamada directa al store con códigos repetidos se rechaza antes de conectar. |
| Duplicados encontrados en BD | 409 antes de escribir; no se escoge arbitrariamente un documento. Altas simultáneas y códigos históricos no canónicos siguen abiertos. |
| Campos protegidos presentes/ausentes | Whitelist del store impide cambios de existentes; también filtra campos no autorizados en nuevas altas. |
| Error durante segunda escritura | Test simula primera aplicada y segunda fallida: HTTP 500 con aviso de parcialidad, sin contadores de éxito total. |
| Conflicto de fila | CAS protege el documento de esa fila. HTTP 409 de lote advierte que otras filas podrían haberse aplicado. |
| Respuesta de escritura incompleta o producto desaparecido al releer | 500 con posible parcialidad; no éxito ficticio. |
| Producto ausente de planilla | No se elimina. Ni importación ni seed borran por ausencia. |

El parser Excel conserva formatos numéricos documentados por pruebas (`1.000`, `1,5`, `1.234,50`, `1,234.50`), pero ya no extrae dígitos de texto ni admite símbolos monetarios en strings. Las celdas numéricas formateadas por Excel siguen siendo números. La API recibe números JSON o strings numéricos canónicos para stock, no formatos locales. Unidades en textos, moneda en strings e identificadores numéricos con ceros iniciales perdidos por Excel requieren corrección del archivo, no inferencia automática.

**No es control de versión de la planilla:** el importador obtiene `updatedAt` del servidor al comenzar el lote, no del momento en que se creó el Excel. Detecta carreras durante lectura/escritura del lote; no evita que una planilla vieja reemplace campos autorizados modificados antes de iniciarlo. No se afirmó lo contrario.

Pendientes: prueba de UI Excel de extremo a extremo, validación comercial de jerarquías parciales, política de duplicados de archivo aprobada por negocio, métricas diferenciadas de filas sin cambios y reconciliación de lotes fallidos sin reintento ciego.

## 6. Pruebas y verificaciones ejecutadas

| Validación | Línea base al inicio | Resultado final |
|---|---|---|
| `npm.cmd --prefix Backend test` | 53 pruebas, 53 pasan, 0 fallan; exit 0 | **82 pruebas, 82 pasan, 0 fallan/canceladas/omitidas/todo; exit 0** |
| `node --test Backend\tests\product-data-protection.test.js Backend\tests\product-form-image.test.js` | No medida por separado al inicio | **63 pruebas, 63 pasan, 0 fallan/canceladas/omitidas/todo; exit 0** |
| `node --check` sobre controlador, stores productos/imágenes, ambos tests y utils save-product/import-number | No medida por separado | **7 archivos válidos; exit 0**. Controlador/test se repitieron después del último ajuste de clasificación. |
| `npm.cmd --prefix catalogo-vgv run lint` | Exit 1: Prettier rechazaba dashboard; ESLint no se ejecutaba por `&&` | **Exit 0**, Prettier y ESLint correctos. También se ejecutó ESLint directamente: 0 errores/advertencias en esa pasada. |
| `npm.cmd --prefix catalogo-vgv run build` | **Ejecutado, exit 0**, adapter-static | **Ejecutado, exit 0**, SSR/cliente y sitio en `dist`. Advertencia de chunk cliente mayor a 500 kB, máximo aproximado 929,91 kB; información de tiempos de plugins no bloqueante. No desplegado. |
| `git --no-pager diff --check` | No medida por separado | Exit 0; avisos LF→CRLF, sin errores de whitespace. |
| Diff de manifiestos y lockfiles de raíz/backend/frontend | Sin cambios iniciales en estos archivos | Exit 0 de `git diff --exit-code`: sin modificaciones. |

**Fallos diferenciados:** el fallo inicial de formato era previo. Dos errores ESLint `preserve-caught-error` fueron introducidos durante esta auditoría y corregidos preservando `cause`; lint/build se repitieron con éxito. No quedan fallos introducidos conocidos en estas verificaciones.

Hubo intentos de comando no válidos que no cuentan como pruebas ejecutadas: PowerShell bloqueó `npm.ps1`; un `npm.cmd test` desde raíz no encontró script; un intento de formato desde raíz no encontró archivos y avisó de instalación temporal de Prettier. La ejecución válida posterior usó exclusivamente el binario ya instalado del frontend; no se añadieron dependencias al proyecto. No se certifica el estado de la caché global de npm. No se utilizaron esos intentos para afirmar resultados.

## 7. Archivos modificados por esta auditoría

1. [Controlador de productos](../Backend/controllers/products.controller.js): clasificación parcial, validación de versión, identificadores y números.
2. [Store de productos](../Backend/data/products.store.js): validación/protección de importación y confirmaciones, versiones auxiliares, seed sin tocar existentes.
3. [Store de imágenes](../Backend/data/product-images.store.js): reutilización del CAS.
4. [Pruebas de protección](../Backend/tests/product-data-protection.test.js): ampliación del archivo local ya existente no rastreado.
5. [Pruebas de formulario](../Backend/tests/product-form-image.test.js): rechazos PUT y recuperación.
6. [Helper de guardado](../catalogo-vgv/src/lib/utils/save-product.js): guard explícito de recuperación.
7. [Parser numérico de importación](../catalogo-vgv/src/lib/utils/import-number.js): nuevo helper puro y probado.
8. [Panel administrativo](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte): recuperación conservadora, eventos, números, códigos y fallos parciales; formateo del archivo.
9. [Plan E0](./PLAN_IMPLEMENTACION_E0_VGV.md): enlace a este informe vigente.
10. Este informe.

Otros cambios locales anteriores no se atribuyen a esta auditoría ni se revirtieron. No se creó commit.

## 8. Riesgos abiertos y próximo paso seguro

1. Inventariar consumidores externos y bundles antiguos, y comunicar requisito de versión y semántica canónica de clasificación **antes de publicar**.
2. Acordar comercialmente campos importables, tratamiento de duplicados y jerarquías. No habilitar una importación operativa por el solo resultado de estas pruebas.
3. Preparar una base **local desechable**, con fixtures sintéticos, para ejecutar carreras reales de PUT/importación/imagen y pipeline de referencias. Verificar versión de motor e índices sin consultar Atlas. Añadir pruebas UI de archivo y recuperación; no usar datos de producción.
4. Diseñar, por separado, unicidad/canonicalización de código y prevención de altas simultáneas. No se justifica aplicar un índice único sobre datos desconocidos sin diagnóstico/plan.
5. Definir reconciliación y eventual idempotencia/transaccionalidad de importación. Lotes ya confirmados y filas aplicadas no se deshacen automáticamente; no reintentar el archivo completo a ciegas.
6. Aislar posteriormente errores de infraestructura del PUT (hoy algunos son 400) con contrato documentado y pruebas específicas.
7. Respaldo/restauración, índices/GridFS reales, datos antiguos efectivos y compatibilidad de runtime desplegado continúan **sin verificar**. Ninguna evidencia local cierra E0 ni autoriza despliegue.

## 9. Intento de validación con motor real: entorno no disponible

**Fecha:** 23 de octubre de 2026, seguimiento posterior a la auditoría anterior.

**Resultado: BLOQUEADO antes de cualquier escritura. Pruebas ejecutadas contra MongoDB real: 0. Versión del motor: no obtenida. E0 continúa NO COMPLETADA.** Los resultados de §6 corresponden a la ejecución anterior con mocks, no a una integración real ni a una nueva ejecución de esas pruebas.

### 9.1 Inspección local efectivamente realizada

Se usaron comprobaciones de solo lectura y un intento TCP sin autenticación ni comandos de base:

| Comprobación | Resultado |
|---|---|
| `Get-Command mongod,mongosh,docker` | Ninguno disponible en PATH. No se ejecutaron `mongod --version`, `docker version` ni `docker ps` al no existir esos comandos. |
| `Get-NetTCPConnection -LocalPort 27017` | Sin listener/conexiones reportados. |
| Intento TCP a IPv4 loopback, puerto 27017 | No accesible. No fue una conexión Mongo ni una escritura. |
| Servicios Windows con nombre/display name Mongo | Ninguno reportado. |
| Procesos con nombre exacto `mongod.exe` | Ninguno reportado. No se inspeccionaron argumentos de procesos. |
| Directorio habitual del servidor bajo Program Files | Ausente. |
| Ejecutable habitual de Docker Desktop bajo Program Files | Ausente. |
| Directorios MongoDB/Docker bajo LocalAppData Programs | Ausentes. |
| `podman` | No encontrado. |
| `wsl --list --quiet` | El ejecutable Windows existe, pero informó que WSL no está instalado. No se arrancó ninguna distribución. |

Esto demuestra que **no se dispone de un candidato verificable mediante las comprobaciones realizadas**, no que se haya inventariado todo el disco o cada puerto de la máquina. No se escanearon redes ni se buscaron credenciales. No se consultaron valores de variables de producción ni se leyeron archivos de entorno.

No se instalaron herramientas o dependencias, iniciaron servicios ni crearon productos, bases, imágenes, contenedores, volúmenes o índices. No hubo recursos sintéticos de esta ejecución que limpiar.

### 9.2 Configuración de pruebas inspeccionada

- [Store de productos](../Backend/data/products.store.js): captura `MONGO_URI` o `MONGODB_URI` al importar el módulo, acepta `MONGO_DB_NAME` como override y, sin esas variables, utiliza una base ordinaria de desarrollo. **Ese fallback no es una base desechable autorizada.** No debe usarse en integración por omisión.
- [Pruebas de protección](../Backend/tests/product-data-protection.test.js): reemplazan `mongoose.connect` y métodos del modelo; no validan el motor.
- [Prueba HTTP de imágenes](../Backend/tests/product-images-http.test.js): escucha en loopback y prueba entradas que se rechazan antes de acceder a Mongo. No acredita persistencia GridFS.
- [Manifiesto backend](../Backend/package.json): `node --test` no establece por sí solo un destino Mongo aislado.
- [Docker Compose existente](../docker-compose.yml): utiliza base/volumen persistentes de desarrollo y publica el puerto sin binding explícito a loopback. **No se ejecutó ni se considera un entorno desechable de esta validación.**

La configuración de aplicación permite conexiones no locales: el store no es una barrera contra Atlas. El uso previo de mocks y de variables de proceso apuntando a loopback no convierte automáticamente futuras pruebas de integración en seguras. Por ello no se importó el store ni se llamó a sus funciones de persistencia en este seguimiento.

### 9.3 Resultados solicitados: todos pendientes de motor real

| Área | Resultado de esta ejecución |
|---|---|
| PUT: dos escrituras de misma versión y solo una ganadora | No ejecutado contra Mongo. |
| PUT: conflicto controlado, ausencia de patch parcial y conservación de otro campo | No ejecutado contra Mongo. |
| `updatedAt` ausente, null, inválido y futuro | No ejecutado contra Mongo. |
| GridFS: guardar/recuperar bytes sintéticos y comparar contenido exacto | No ejecutado. |
| Asociación concurrente de imagen | No ejecutada contra Mongo. |
| Pipeline real de limpieza de referencias | No ejecutado. |
| Fallo de imagen que conserve archivos todavía referenciados | No ejecutado contra Mongo. |
| Producto/referencia/archivo inexistentes | No ejecutado contra Mongo. |
| Altas simultáneas del mismo código | No ejecutadas: **no se demostró que persistan duplicados**. La falta de índice único sigue siendo evidencia estática de riesgo, no resultado experimental. |
| Índices de una base sintética | No examinados: no se creó ni conectó una base sintética. |
| Primera fila aplicada y segunda fallida, respuesta HTTP y mensajes | No ejecutado contra Mongo. |
| Reintento de importación, stock desconocido y ausencia de borrados | No ejecutado contra Mongo. |

### 9.4 Habilitación segura del entorno y siguiente ejecución

Procedimiento pendiente; **no ejecutado**:

1. Instalar o facilitar un binario `mongod` compatible con Windows y registrar su versión, sin instalar un servicio permanente para esta prueba. No sustituirlo por Atlas. La alternativa Docker requiere habilitar primero Docker y diseñar un contenedor aislado, no reutilizar el Compose de desarrollo.
2. Crear un directorio vacío exclusivo de la ejecución fuera de los datos de aplicación, con identificador aleatorio y marcador de propiedad. Iniciar un proceso `mongod` propio con ese `dbPath`, `--bind_ip 127.0.0.1` y un puerto dedicado disponible. Registrar PID, ruta ejecutable, versión, puerto y directorio; no adoptar un listener preexistente desconocido.
3. Antes de escribir, comprobar que ese PID sigue vivo y es dueño del listener loopback. Leer `buildInfo`, `hello` y configuración de arranque del proceso local; verificar versión, bind, puerto y `dbPath` esperado. Crear un nombre de base exclusivo `vgv_e0_integration_<identificador>` y comprobar que no existe previamente. No publicar URI completa ni credenciales.
4. Lanzar el runner en un proceso limpio sin cargar `.env`, preloads de `NODE_OPTIONS` ni configuración comercial. Construir la conexión internamente desde host literal loopback, puerto verificado y base generada; no aceptar una URI arbitraria heredada. Establecer **ambas** variables Mongo y `MONGO_DB_NAME` solo en ese proceso, antes de cualquier import dinámico del store. Rechazar SRV, hosts múltiples, credenciales, redirecciones, nombre de base distinto o cualquier destino no permitido; usar `directConnection` y timeout corto. No imprimir la URI en errores.
5. Configurar Mongoose antes de importar modelos con `autoIndex: false` y `autoCreate: false`; no ejecutar `init`, `syncIndexes`, `createIndexes` ni migraciones. Examinar los índices reales de la colección sintética sin añadir los del esquema. Una colección nueva puede tener únicamente su índice implícito `_id`; eso debe registrarse y **no** extrapolarse como inventario de índices comerciales. GridFS puede crear sus índices internos al primer upload: mantenerlos exclusivamente en esta instancia/base desechable y distinguirlos de cambios de índice de Product.
6. Escribir el harness de integración con barreras explícitas y timeouts. No usar sleeps como única sincronización ni sustituir operaciones DB por mocks. Para PUT, retener ambas solicitudes después de leer el mismo snapshot y antes del CAS; liberar juntas. Para altas por código, retener ambas importaciones después de la búsqueda por código y antes del bulk real. El resultado debe incluir lectura directa final de los documentos y conteo de ganadores/perdedores.
7. Para importación parcial, inyectar el fallo únicamente en la segunda operación de datos sintéticos, por ejemplo con un fixture que viole una restricción real ya existente y previamente comprobada. No provocar caída del servidor, manipular datos ajenos ni crear un índice nuevo para forzar el caso. Registrar estado previo/posterior por ID y código, respuesta HTTP y efecto del reintento explícito. La respuesta actual no identifica por sí sola todas las filas confirmadas/fallidas: no atribuirle esa capacidad sin demostrarla.
8. Para GridFS usar bytes de imagen generados localmente; comparar bytes originales con descarga directa. En la ruta que transforma la imagen, comparar la descarga con los bytes procesados, no con el PNG/JPEG original. Verificar referencia y existencia del archivo antes y después de carreras/fallos; no llamar al helper de borrado sobre archivos referenciados para “probar” una limpieza.
9. Cerrar HTTP, cursores y conexiones. Verificar marcador/propiedad antes de limpiar únicamente los datos generados o el directorio aislado. Detener solo el PID iniciado por el runner. Si la propiedad no puede acreditarse, detener la limpieza y reportar los recursos pendientes; nunca borrar bases o volúmenes por patrón.

No se añadió un harness de integración sin poder ejecutarlo: hacerlo y presentarlo como validado dejaría sin comprobar sus barreras de aislamiento y limpieza. Una vez disponible el motor, debe implementarse y verificarse junto con sus controles de seguridad antes de contar resultados de integración.

### 9.5 Opciones de unicidad y riesgos abiertos

Sin tocar esquema ni índices en esta ejecución:

- **Auditar primero:** identificar códigos duplicados/no canónicos en una copia autorizada, definir identidad comercial y resolver ambigüedades con trazabilidad, nunca borrar o fusionar históricos automáticamente.
- **Índice único global posterior:** solo si el diagnóstico y la política de normalización permiten garantizarlo; requiere un cambio separado, autorizado y con recuperación prevista.
- **Unicidad para altas nuevas:** una clave canónica o mecanismo de reserva único podría preservar códigos históricos, pero introduce diseño/esquema y necesita aprobación; no se implementó.
- **Serializar importaciones:** puede reducir carreras si todos los escritores cooperan, pero un mutex de proceso no garantiza unicidad entre múltiples instancias ni sustituye una restricción de base.

Permanecen abiertos la reproducción real de duplicados, BSON/CAS/pipeline, preservación GridFS bajo fallos, reconciliación de lotes/reintentos, inventario externo y autorización comercial de importación. Tampoco se han verificado respaldo/restauración. El próximo paso es **habilitar un motor local con propiedad demostrable**, no desplegar ni operar sobre datos comerciales.

## 10. Preparación portátil e integración real: seguimiento

**Fecha:** 23 de octubre de 2026. Esta sección registra una ejecución posterior; §9 conserva el bloqueo histórico y no describe la disponibilidad actual del binario. **E0 permanece NO COMPLETADA.**

### 10.1 Preparación efectivamente realizada

Se verificó Windows 11 x64, sin elevación administrativa, con permiso de escritura temporal y más de 250 GB libres. No había servidor Mongo, Docker o Podman disponibles ni listeners en los puertos inspeccionados. No se reutilizó el Compose, su volumen ni la base de desarrollo.

Se descargó el ZIP **oficial MongoDB Community 8.0.16 para Windows x64** desde `fastdl.mongodb.org`, junto con su SHA256 publicado. No se transmitió código del repositorio ni información comercial. Se extrajo exclusivamente `mongod.exe`, sin instalar servicio, modificar PATH/registro o añadir paquetes al proyecto.

| Elemento | Evidencia |
|---|---|
| ZIP oficial | `mongodb-windows-x86_64-8.0.16.zip`, 792.329.900 bytes anunciados por HTTPS HEAD |
| SHA256 ZIP esperado y calculado | `34EB6795860E29BDF8E5CC9CB4CBBA2C73295A25C60204667029D5F3614FE807`, coincidencia exacta antes de ejecutar |
| Ejecutable extraído | 76.595.200 bytes |
| SHA256 ejecutable | `4502859B9EEB9C8348C89E9E58C43AE7AC56B7783A4397120EE5C1D1FF6C9827` |
| Authenticode | `NotSigned`; no se afirma firma de editor verificada. La integridad se comprobó contra el SHA256 publicado por el distribuidor oficial mediante HTTPS. |
| Versión ejecutada | `mongod.exe --version`: `v8.0.16`, Windows x64, exit 0 |
| Ubicación portátil | `%LOCALAPPDATA%\Temp\vgv-e0-mongodb-8.0.16-4e0c1ece\mongod.exe` |

Se eliminaron solo el ZIP y checksum descargados por esta tarea. El ejecutable se conserva para repetir la validación; no contiene datos de base. Tener un binario verificado no demuestra por sí solo aislamiento de una instancia: las verificaciones de proceso, directorio, puerto y conexión son requisitos independientes del harness.

### 10.2 Harness implementado y aislamiento comprobado

Archivos nuevos, sin modificaciones a lógica comercial, esquema o dependencias:

- [Runner local](../Backend/scripts/validate-e0-local.mjs).
- [Suite de integración real](../Backend/integration/e0-local.mjs).
- [Controles de aislamiento y barreras](../Backend/integration/e0-support.mjs).
- [Pruebas auxiliares de seguridad sin DB](../Backend/integration/e0-support-check.mjs).

El runner solo acepta `--mongod` y `--help`; no acepta una URI, base, puerto ni directorio externos. Genera proceso, directorio y nombre de base propios. Un proceso hijo limpio recibe `E0_INTEGRATION_CONFIG`; descarta configuración heredada y fija la conexión antes de importar la aplicación. No utiliza `.env`, `server.js`, seed ni el Compose. La configuración normal de producción no se reemplazó.

Se comprobaron el PID del motor, listener loopback, configuración de arranque, `dbPath`, `buildInfo`, `hello` y ausencia inicial de la base. `autoIndex` y `autoCreate` se desactivaron antes de importar modelos. No se crearon índices Product: el único existente fue `_id_`, implícito del motor. GridFS creó sus índices internos exclusivamente en esta base sintética; no se alteró ningún entorno comercial.

La concurrencia usa barreras con timeout que esperan ambas operaciones antes de ejecutar el CAS/bulk **real**. Los wrappers de instrumentación no sustituyen Mongo por respuestas prefabricadas. La inyección del fallo parcial modifica únicamente el `_id` de la segunda operación sintética para obtener un error real del índice implícito ya existente.

| Evidencia de repetición independiente | Valor |
|---|---|
| Run ID | `9340acb580602a8e03b479f555a4a284` |
| Base exclusiva | `vgv_e0_integration_9340acb580602a8e03b479f555a4a284` |
| Motor | MongoDB Community **8.0.16**, standalone Windows x64 |
| Bind y puerto | IPv4 loopback, puerto **51966** |
| PID iniciado y verificado | **21080** |
| Directorio de datos nuevo | `%LOCALAPPDATA%\Temp\vgv-e0-9340acb580602a8e03b479f555a4a284-xh1BTm\db` |
| Resultado global | `passed-with-findings`, exit **0**: **14 checks pasan, 0 fallan, 3 hallazgos reproducidos** |

El implementador también ejecutó una corrida previa satisfactoria: base `vgv_e0_integration_4ee6e1b9ad48fcbafcee6d2f71b48bf5`, PID 8648, puerto 51932. Los conteos anteriores corresponden a cada corrida por separado, no a 28 pruebas distintas.

### 10.3 Resultados contra MongoDB real

| Check | Resultado observado |
|---|---|
| Limpieza de worker antes de imports | Pasa; configuración heredada sintética descartada. |
| PID/listener/configuración/versión/base inicialmente ausente | Pasa; escrituras habilitadas solo tras verificar instancia propia. |
| HTTP con autenticación sintética | Pasa en servidor efímero loopback. No acredita autenticación administrativa comercial. |
| PUT normal, sin versión, inválido, obsoleto, inexistente y relación inexistente | Pasa; verificaciones de respuestas y persistencia. |
| Versiones BSON ausente, null, corrupta y futura | Pasa. Ausencia/null se versionan; datos corruptos no se convierten silenciosamente; fecha futura avanza. |
| Dos PUT HTTP, mismo snapshot, campos distintos | **200 y 409**. Solo el patch ganador persistió; el documento no contenía una combinación parcial del perdedor. |
| GridFS exactitud e índices internos | **786.512 bytes** sintéticos recuperados exactamente; índices files `_id_`, `filename_1_uploadDate_1`; chunks `_id_`, `files_id_1_n_1`. |
| Dos uploads HTTP concurrentes | **409 y 201**; quedó un archivo ganador asociado, bytes exactos, limpieza del perdedor sin borrar el ganador. |
| Pipeline real de referencias | Pasa sobre **4 documentos** con versiones futura, ausente, null y corrupta. Se quitaron las referencias y verificaron versiones. No es transacción multidocumento. |
| Borrar archivo todavía referenciado | **Se reprodujo una limitación**, no una garantía de seguridad: el helper borró archivo/chunks y dejó la referencia del producto. Solo datos propios sintéticos. |
| Dos altas por importación con el mismo código | **200 y 200**, persistieron **2 IDs distintos** con el mismo código; nueva importación del código devolvió **409**. |
| Importación parcial por filas válidas/inválidas | **1 creado, 1 actualizado**, fila **22** rechazada. Stock null/0, campos omitidos/protegidos y producto ausente del archivo se conservaron según assertions. |
| Error real en segunda operación de bulk y reintento | HTTP **500**, error Mongo **11000**: primera fila aplicada, segunda no persistida. Reintento explícito HTTP **200**, **1 creado y 1 actualizado**, versión de la primera fila avanzó otra vez. |
| Índices Product sin cambios | Solo `_id_`. No se llamó a sincronización/creación de índices de Product. |

**Interpretación de “pasa”:** los checks de riesgos verifican que la observación se reproduzca, no que el comportamiento sea seguro. Por eso el runner informa `passed-with-findings` y no una certificación E0.

### 10.4 Hallazgos reales y severidad

| ID | Severidad | Evidencia real | Estado |
|---|---|---|---|
| REAL-01 | Alta | `deleteUnlinkedImage` no comprueba referencias. Después de llamarlo sobre un archivo propio asociado: referencia persistente, **0 files y 0 chunks**. | Abierto. El nombre del helper no es una precondición ejecutable. Requiere revisión separada del contrato de borrado, de todos sus consumidores y de carreras referencia/borrado; una consulta previa aislada tampoco garantiza atomicidad. No se cambió comportamiento comercial. |
| REAL-02 | Alta | Ambas altas de importación respondieron 200 y persistieron dos documentos con el mismo código, IDs `6adbaa0aa55a438231630a3e` y `6adbaa0aa55a438231630a3f`. Una importación posterior quedó bloqueada por 409. | Duplicación demostrada en la base sintética sin índice único de código. No se infieren los índices actuales de producción. Opciones de reconciliación/normalización y unicidad futura en §9.5, sin aplicarlas. |
| REAL-03 | Media | Bulk ordenado aplicó fila 1 y falló en fila 2; el 500 no identificó filas confirmadas. Lecturas por ID/código permitieron distinguirlas. Reintento volvió a escribir fila 1 y creó fila 2. | Sin atomicidad de lote ni idempotencia por archivo. La UI no reintenta automáticamente, pero el operador puede repetirlo manualmente. Se necesita reconciliación explícita y reporte por fila antes de simplificar esta operación. |

El fallo 11000 fue inducido **en datos sintéticos** modificando la segunda operación antes de enviar el bulk original al motor; no significa que un Excel pueda proporcionar `_id` al endpoint normal. El objetivo fue comprobar el manejo de un error real después de una escritura confirmada, sin alterar índices ni detener el servidor.

**Comprobación adicional del archivo referenciado:** después de reproducir REAL-01 se añadió GET HTTP sobre la misma URL que permanecía en el producto. Se verificó **404** y body exacto `{"error":"Imagen no encontrada."}`. Corrida final con ese check: run `f50f1f87bf5a6c94f181f32bde4ea0ab`, base `vgv_e0_integration_f50f1f87bf5a6c94f181f32bde4ea0ab`, Mongo 8.0.16, PID **14120**, puerto **56628**, **14 pasan / 0 fallan / 3 hallazgos**, exit 0. Esos 14 checks incluyen esta ampliación; no se añade una prueba duplicada al conteo.

### 10.5 Verificaciones adicionales y diferencias de alcance

- Suite habitual backend ejecutada: **82/82**, 0 fallos, exit 0. Utiliza mocks y tests HTTP de validación; **no se suma** a los checks de motor real.
- Pruebas auxiliares de aislamiento: **8/8**, 0 fallos, exit 0; sin DB.
- Frontend lint **ejecutado**, exit 0; frontend build **ejecutado**, exit 0. Advertencia no bloqueante de chunks mayores a 500 kB.
- Sintaxis de los cuatro archivos nuevos comprobada por el implementador; verificaciones posteriores adicionales se registran al cierre.
- `git diff --check`: exit 0, avisos LF→CRLF sin error de whitespace.
- Se inspeccionó el diff rastreado completo, además del estado de archivos nuevos. Manifiestos/lockfiles de raíz, backend y frontend: sin diferencias.

La integración monta controllers HTTP con autenticación sintética; **no** prueba `server.js`, autenticación real, middleware comercial completo, navegador/Excel de extremo a extremo, datos históricos, índices desplegados, escenarios de réplica o caídas de red inciertas. El borrado de documentos relacionados y la asociación/limpieza de archivos no se vuelven operaciones multidocumento atómicas por pasar estas pruebas.

Los ocho checks auxiliares cubren entorno limpio, rechazo de conexiones Mongoose heredadas, rechazo de parámetros de conexión arbitrarios del runner, destino loopback/base/capacidad exclusivos, barrera de dos participantes, timeout sin permitir escritura, restauración de instrumentación y rechazo de marcadores de directorio alterados. Los timeouts de barrera son 10 segundos; HTTP usa límites de 20 segundos y uploads de 25 segundos.

Cierre: los **4 archivos nuevos** pasaron `node --check` y no tienen whitespace final ni marcadores de conflicto. La validación precisa de enlaces Markdown encontró **44 destinos relativos, 0 rotos**; un primer regex excesivamente amplio contó dos expresiones de código como enlaces inexistentes y fue corregido, sin modificar destinos.

Fallos intermedios del harness corregidos antes del resultado final: sintaxis de un guard, opción `--nounixsocket` no compatible con Windows, búsqueda de fixture con minúsculas después de normalización a mayúsculas y representación de la unicidad implícita de `_id_`. No fueron fallos comerciales ni se modificaron índices para hacer pasar la suite.

### 10.6 Limpieza comprobada y reproducción

La corrida de repetición terminó con:

- `products`, `productImages.files` y `productImages.chunks`: **0 documentos**.
- `ownedResourcesRemoved: true`, `databaseEmpty: true`.
- Proceso detenido: **PID 21080 inexistente** en comprobación posterior; puerto **51966 sin listener**.
- Directorio de datos propio eliminado. Se conservó el ejecutable portátil, no los datos de prueba.

La corrida final ampliada reportó también las tres colecciones vacías y directorio eliminado. Comprobación externa posterior: **PID 14120 ausente**, **puerto 56628 sin listener** y **ningún directorio temporal con prefijo del run final**.

Propiedad: fixtures registrados por ID/código con prefijo del run; algunos incluyen `e0RunId`. Las altas de importación conservan ID generado y se registran en memoria, sin exigir campos ajenos al esquema comercial. Todos los uploads sintéticos reciben `metadata.e0RunId` mediante instrumentación del stream original; chunks se validan por `files_id` registrado. Antes del primer borrado se inspeccionan las tres colecciones conocidas y se rechazan recursos ajenos; los filtros de borrado usan IDs propios, nunca `dropDatabase`/`dropCollection`. Después se cuentan todas las colecciones: una adicional no vacía impide eliminar el directorio. No es una protección transaccional frente a otro proceso que escriba durante cleanup.

El directorio se elimina solo tras detener el proceso propio, verificar ruta real hija de temporales, ausencia de symlinks, prefijo y marcador exacto `{runId, nonce, runnerPid}`. Un fallo de propiedad/limpieza conserva el directorio para investigación.

No se eliminaron documentos, imágenes o carpetas ajenos. No se accedió a Atlas ni se leyeron credenciales para construir la conexión. No hubo despliegue, commit ni migración.

Desde la raíz del repositorio, con el mismo binario verificado disponible:

```powershell
$env:NODE_OPTIONS = $null
$env:NODE_PATH = $null
node .\Backend\scripts\validate-e0-local.mjs --mongod "$env:LOCALAPPDATA\Temp\vgv-e0-mongodb-8.0.16-4e0c1ece\mongod.exe"
node .\Backend\integration\e0-support-check.mjs
```

Estos cambios de variables son del proceso de PowerShell local, no de producción. El runner inicia, verifica y detiene **su propio** Mongo. No iniciar otro servidor previamente ni pasarle una URI. Registrar el JSON de cada nueva corrida porque nombres, PID, puerto y directorio cambian.

**Archivos modificados en este seguimiento:** los cuatro archivos nuevos de harness/suite/soporte, este informe y el enlace de seguimiento en el [plan E0](./PLAN_IMPLEMENTACION_E0_VGV.md). Los cambios comerciales anteriores se conservaron sin atribuirlos a esta ejecución.

**Estado final:** E0 **NO COMPLETADA**. Próximo paso: revisar por separado el borrado de archivos referenciados, definir reconciliación de duplicados históricos y contratos de importación parcial, ampliar pruebas de UI/autenticación y validar compatibilidad histórica con procedimiento autorizado. Respaldo, restauración verificable, integridad GridFS comercial y rollback continúan pendientes; ninguna prueba local autoriza desplegar.

### 10.7 Correcciones E0.1–E0.3: baseline y decisiones aprobadas

Este seguimiento se ejecuta después de aprobar un plan específico; las observaciones anteriores no se sobrescriben como si fueran pruebas posteriores a la corrección.

**Baseline repetido antes de editar código:** MongoDB 8.0.16, run `c7607b5923cc65f329463d67708ca14d`, base `vgv_e0_integration_c7607b5923cc65f329463d67708ca14d`, PID 23560, puerto loopback 53501; exit 0, **14 checks / 0 fallos / 3 riesgos reproducidos**. Se reprodujeron borrado de imagen referenciada y GET 404, dos documentos de igual código y fila aplicada antes de 500/11000 con nueva escritura en el reintento. Cleanup reportó tres colecciones vacías, proceso detenido y directorio propio eliminado.

El binario se volvió a verificar por ruta absoluta y SHA256. Dos intentos iniciales de la herramienta delegada de ejecución no proporcionaron resultados; no se contabilizan como corridas. La repetición válida fue ejecutada directamente con el runner existente.

**Causas raíz confirmadas por inspección y motor:**

1. El borrado GridFS no comparte un protocolo de ciclo de vida con quienes escriben referencias Product. El CAS de Product no hace atómica la existencia del archivo; consultar referencias antes de borrar sigue dejando una carrera.
2. No hay una restricción de unicidad efectiva verificada sobre código. Consulta e inserción separadas permiten la carrera; tampoco basta el atributo del modelo. POST/PUT e importación difieren al descartar/rechazar caracteres.
3. Bulk ordenado no es transacción; catch global elimina información por fila y no existe identidad durable de lote. El cliente pierde evidencia del resultado parcial y reenviar aplica otra vez las filas confirmadas.

**Decisiones explícitamente aprobadas para la implementación:**

- Publicar una imagen la protege permanentemente. Se acepta retener huérfanos como costo conservador; no se implementa GC de archivos previamente publicados ni históricos.
- Solo se consideran eliminables uploads propios nunca publicados, con coordinación atómica de metadatos entre asociación y borrado.
- Códigos nuevos/editados: trim, mayúsculas y espacios a guiones; rechazar caracteres que se descartaban. No normalizar ni reconciliar automáticamente históricos.
- Preparar/probar índice único exclusivamente en base sintética y bloquear altas/cambios de código sin su precondición verificada. No construir índice automáticamente al arrancar producción.
- Exigir `batchId` estable, recibos durables por fila, no repetir confirmadas y bloquear replay de resultados ambiguos hasta reconciliación.
- Documentar incompatibilidad de clientes antiguos sin `batchId` (428), índices comerciales pendientes y límites de recuperación. Ninguna de estas decisiones autoriza desplegar o migrar.

#### 10.7.1 Resultado por riesgo: correcciones locales, no aprobación comercial

| Riesgo original | Severidad | Corrección y evidencia posterior | Estado |
|---|---|---|---|
| REAL-01: borrar GridFS todavía referenciado | Alta | CAS de ciclo de vida en `files` antes de publicar/reclamar borrado. Caso original bloqueado y bytes intactos; compartidas, dos borrados, ambas órdenes asociación/borrado, POST/PUT y fallos de chunks/files probados. | Corregido localmente para escritores participantes; no es un GC ni protege escrituras directas que evadan el protocolo. |
| REAL-02: altas simultáneas con igual código | Alta | Índice real único sintético: dos imports dejan un documento; cinco POST equivalentes producen un 201 y cuatro 409; tres códigos distintos producen tres 201. PUT a código existente conserva el código anterior. | Corregido localmente con precondición verificada. Altas/cambios de código comerciales quedan bloqueados hasta diagnóstico e índice autorizados. |
| REAL-03: parcialidad sin evidencia y repetición de confirmadas | Alta | Recibo durable; segunda fila falla realmente con 11000 y devuelve 207 por fila. Replay no avanza la primera versión; retry explícito de la fallida termina 200. Ack perdido y fallo de confirmación conservan bloqueo incluso desde un worker nuevo. | Mitigado con evidencia durable y bloqueo seguro. No hay exactly-once global ni resolución automática/manual asistida por un endpoint de override. |

**E0.1 — Imágenes:** cada upload nuevo recibe `metadata.e0Lifecycle` con propietario aleatorio y estado `private`. La capacidad de borrado solo existe en el proceso que creó el upload; no se acepta un propietario del cliente. El guard compartido cambia atómicamente `private/protected → protected` antes de escribir Product. El borrado solo puede reclamar `private → deleting` con capacidad propia. Una vez protegido, nunca se vuelve privado, aunque el CAS Product pierda o cambie posteriormente la referencia.

La consulta de referencias Product es una defensa adicional posterior al claim, no la garantía contra carreras. Si detecta una referencia, conserva el archivo y lo protege. Se borran chunks antes de `files`; un fallo deja marcador no publicable y error explícito, incluso cuando los chunks ya fueron retirados. Dos borrados solo tienen un ganador. Legacy/sin capacidad, publicados y huérfanos protegidos se retienen. El pipeline real de limpieza de relaciones Product sigue siendo multidocumento, no transaccional.

El protocolo cubre asociación multipart, POST, PUT y seed explícito; importación nueva usa placeholder estático y la existente no autoriza imagen. No autoriza borrar imágenes comerciales, backfill de metadatos ni recuperar capacidades después de reiniciar. El costo conservador es retención de archivos y eventual limpieza manual por un procedimiento separado.

**E0.2 — Código:** helper compartido aplica trim, mayúsculas y espacios a guiones; acepta únicamente 1–80 caracteres ASCII `A-Z`, `0-9`, `_`, `-`. Rechaza, no elimina, caracteres ambiguos. Lecturas no normalizan históricos. `diagnoseProductCodes` informa inválidos, no canónicos y colisiones sin modificar documentos.

La precondición exacta es índice llamado `e0_codigo_unique`, clave `{ codigo: 1 }`, `unique: true`, comparación binaria simple, sin `sparse` ni `partialFilterExpression`. El harness lo crea **solo** después de verificar su base sintética. No se agregó `unique:true` al esquema, `syncIndexes`, migración ni constructor de índices al arranque. Se inspecciona el índice efectivo en cada alta/cambio de código; además, cualquier código histórico no canónico bloquea esas operaciones con 503. La consulta exige tipo string y anclas absolutas PCRE: también se probaron arrays y salto de línea final, evitando que coincidencias parciales acrediten canonicalidad. Otras ediciones no requieren ese índice. Seed explícito tampoco lo elude. El helper bulk interno valida duplicados después de canonicalizar, sin mutar la entrada; no es el consumidor HTTP del nuevo contrato.

Preparación comercial pendiente, **no ejecutada**: inventario autorizado de índices/datos; diagnóstico de inválidos, códigos faltantes y colisiones canónicas; decisión del responsable sobre cada identidad histórica sin fusionar/borrar automáticamente; respaldo y restauración ensayados; ventana y aprobación explícitas del índice; verificación posterior con `listIndexes`; transición de clientes. Un índice binario por sí solo no resuelve equivalencias históricas por mayúsculas/espacios. Alternativas como una clave canónica separada requieren diseño/migración aprobados y no se implementaron.

Las altas individuales nuevas usan ID ObjectId serializado en lugar de `max(id)+1`, cuya carrera permitía colisiones adicionales. Los IDs existentes no se reescriben. Clientes que supongan IDs numéricos necesitan adaptación; su existencia fuera del repositorio no es verificable.

#### 10.7.2 Contrato de importación y compatibilidad

Se añade únicamente la colección técnica `productImportReceipts`: `_id=batchId` usa la unicidad implícita de MongoDB. Guarda hash SHA256 determinista del contenido, intención/precondición y resultado por posición, payload mínimo validado para retry y lock sin expiración automática. No almacena el archivo Excel, tokens ni credenciales. No hay TTL/purga automática; autorización de conservación pendiente.

| Operación/resultado | HTTP y efecto |
|---|---|
| PUT administrativo | Mantiene `_expectedUpdatedAt`: 428 ausente, 400 versión inválida, 409 conflicto atómico. Código/imagen añaden guards; no se relaja CAS. |
| POST administrativo | 201 alta; 409 código duplicado; 503 falta índice o histórico no canónico; 400 código inválido. |
| POST bulk sin identidad | 428 `BATCH_ID_REQUIRED`, sin escrituras Product. |
| Envelope/batch/retry inválidos | 400; entre 1 y 100 filas, `batchId` de 16–100 caracteres alfanuméricos, `_` o `-`. |
| Mismo batchId con otro contenido | 409 `BATCH_CONTENT_MISMATCH`, sin ejecutar el contenido nuevo. |
| Lote completo/parcial | 200 solo si todas son `created/updated/unchanged`; 207 en otro caso, con informe por fila. `response.ok` no basta. |
| Repetición sin `retryRows` | Consulta el recibo, no reejecuta confirmadas ni otras filas. |
| Retry explícito | Posiciones internas de filas `pending/failed/conflict`; confirmadas, rechazadas y desconocidas no se reejecutan. Relee versión actual bajo CAS; no es retry automático. |
| Error de código/versión/precondición de una fila | Se refleja en 207, con `code`, `httpStatus`, estado y acción por fila; no se disfraza como rollback del lote. |
| Fallo de servicio/resultado global no confirmable | 503 y batchId para consulta; no autoriza reenviar con identidad nueva. |
| GET administrativo `/bulk/:batchId` | 200 informe durable; 404 si no se encuentra; 400 identidad inválida; 503 servicio no disponible. |

Cada fila informa posición estable, número original, código/ID y versión esperada cuando se conocen, intentos, estado, motivo saneado y recomendación. Conteos: recibidas, procesadas conocidas, intentadas, confirmadas y categorías terminales/no intentadas. `attempted` se superpone intencionadamente con confirmadas/fallidas/desconocidas; no debe sumarse a ellas. `applying` se presenta como `unknown`, nunca como fallo reintentable.

Intención durable precede a la escritura Product. Ack verificable precede a la confirmación durable. Si falla esa confirmación, se conserva el lock y el resultado incierto. Un 11000 sin evidencia de rechazo de la operación concreta tampoco se considera prueba de no aplicación. Lectura con valores iguales no acredita causalidad. El caso de conflicto seguido de retry explícito sin cambios no avanza versión ni conserva mensajes de error obsoletos.

Consulta/lectura reconciliadora disponible: informe por batchId y GET administrativo del producto identificado para contrastar versión y estado con la entrada conservada. Si eso no prueba el resultado, mantener bloqueo y escalar a revisión manual autorizada. **No existe endpoint que libere un lock/unknown ni procedimiento de reparación automática; esa recuperación operativa sigue pendiente.**

El dashboard conserva `{batchId, products}` en `sessionStorage` antes de enviar, consulta el recibo y ofrece retry solo de posiciones conocidas. Detiene los siguientes grupos del archivo ante 207/error y nunca anuncia el parcial como completado. Se invalida el informe anterior al iniciar otro grupo; recuperación/cierre exigen que el informe corresponda al mismo batchId. Esto evita archivar accidentalmente un grupo ambiguo usando el informe exitoso anterior. El cierre revisado está bloqueado si hay procesamiento/unknown.

Si se pierde `sessionStorage`, la pestaña o la identidad, no se promete reconocer el archivo como el mismo lote; un batchId nuevo es una operación nueva. Tampoco se persisten automáticamente los grupos posteriores que nunca se enviaron: reanudar un archivo largo exige separar filas ya confirmadas y revisar las pendientes. No reenviar el archivo entero.

**Consumidores:** dashboard adaptado para bulk; consumidores internos PUT mantienen snapshot/400/409/428 según §2. Helpers internos sin HTTP no son clientes externos. Scripts, integradores, pestañas antiguas y clientes ajenos al repositorio son **desconocidos/no verificables**, no descartados. Bulk antiguo sin batchId ahora es incompatible (428); debe adoptar consulta, 207 y retry selectivo. POST/PUT con código dependen del índice; códigos antes “saneados” pueden ahora rechazarse. Transición y comunicación previas a cualquier publicación.

**Campos importables, autorización comercial definitiva pendiente:** en existentes, nombre, clasificación y sus slugs, stock explícito válido. Código solo identifica; no modifica ID/SKU/código, costo, imagen, estado, variantes ni relaciones. Campos ausentes/vacíos/nulos no borran los existentes; stock cero sí se conserva. Nuevos requieren código confiable, nombre, familia, subfamilia y costo; stock desconocido queda `null`, imagen placeholder, estado disponible y variantes/relaciones vacías. Filas inválidas o duplicadas se rechazan individualmente. No hay borrado por ausencia en el archivo.

Documentos antiguos: PUT acepta `_expectedUpdatedAt:null` para versión ausente/nula; la primera escritura establece fecha y la segunda con el mismo snapshot pierde con 409. BSON/fechas inválidos se bloquean, no se reparan automáticamente. Fechas futuras válidas se comparan por instante y la versión siguiente es estrictamente mayor; no se usan formatos locales. Archivos legacy se retienen y códigos históricos no se corrigen automáticamente.

#### 10.7.3 Aceptación ejecutada y limpieza

Corrida final: run `39711848c5ecc8715c03dc3cb439c605`, MongoDB **8.0.16**, base exclusiva `vgv_e0_integration_39711848c5ecc8715c03dc3cb439c605`, listener **127.0.0.1:64631**, PID **28092**. Worker limpio, sin dotenv/preloads ni variables comerciales; URI generada internamente y comprobada exactamente, sin imprimirla. Se cotejaron listener/PID, ejecutable, opciones del motor, versión y ausencia inicial de base. Ninguna alternativa Atlas.

| Verificación realmente ejecutada | Resultado final |
|---|---|
| `npm.cmd --prefix Backend test` | Exit 0; **89 tests, 89 pass, 0 fail, 0 cancelled, 0 skipped**. Incluye guard de identidad/retry del panel. |
| `node --test .\Backend\integration\e0-support-check.mjs` | Exit 0; **8 tests, 8 pass, 0 fail** de aislamiento, barreras y propiedad. |
| Runner MongoDB real existente con `--mongod` absoluto | Exit 0, `status: passed`; **26 checks, 26 pass, 0 fail, 0 findings**. No se suman mocks a estas cifras. |
| `node --check` en 14 archivos JS/MJS del alcance | Exit 0 en todos. |
| `npm.cmd --prefix catalogo-vgv run lint` | Exit 0; Prettier y ESLint. |
| `npm.cmd --prefix catalogo-vgv run build` | Exit 0; SSR/cliente y adapter-static en `dist`. VERCEL/NODE_ENV retiradas solo del proceso hijo. Advertencia no bloqueante de chunks >500 kB ya registrada en baseline; no desplegado. |
| Manifiestos/locks raíz, Backend y frontend | Sin cambios; no se instalaron dependencias. |
| `git diff --check` y revisión de espacios de archivos nuevos del alcance | Exit 0 del diff; sin espacios finales detectados en nuevos archivos. Avisos de conversión LF/CRLF, no errores. |

Los 26 checks incluyen: CAS PUT con barrera 200/409 y solo patch ganador; fechas ausente/null/corrupta/futura; **786.512 bytes** GridFS exactos; uploads 201/409 con ganador intacto y huérfano protegido retenido; limpieza de relaciones en cuatro documentos con versiones heterogéneas; caso original de imagen referenciada; doble borrado con barrera; ambas órdenes publicación/borrado; fallos de chunks y finalización files; guards POST/PUT; índice ausente/duplicados sintéticos/histórico no canónico; concurrencia de altas; parciales/stock/protegidos/ausencia; error real 11000 en segunda fila; conflicto CAS de importación sincronizado; ack perdido; falla de recibo y recuperación desde **otro proceso Node nuevo** con entorno limpio que consulta MongoDB real y no repite la escritura.

Los estados del motor no se simularon. Fault injection intercepta los límites documentados para provocar fallos de ack/recibo/limpieza; el 11000 de segunda fila viene del motor real. No equivale a ensayar una partición de red, caída física, replica set o failover comercial.

Fallos intermedios de esta implementación, no atribuidos al baseline: expectativas unitarias del contrato antiguo sin batchId ajustadas a 428; fixture minúsculo bloqueado correctamente por histórico no canónico; fixture del retry “sin cambios” carecía de slugs y realmente necesitaba actualizarlos (run `2ccd57d9d9465204c4cbe19ae1202263`: **22 pass/1 fail**, exit 1). Se corrigieron los fixtures, sin relajar guards ni assertions. Las corridas finales no tienen fallos. No se cuentan como pruebas ejecutadas los intentos de herramienta sin terminal disponible.

Cleanup final: `products`, `productImportReceipts`, `productImages.files` y `productImages.chunks` **0 documentos**, recursos propios eliminados, proceso detenido y directorio propio retirado. La capacidad/registro de ownership se amplió a recibos y nuevas altas; se rechazan recursos ajenos antes del primer borrado. No `dropDatabase`/`dropCollection`. Comprobación externa posterior: **PID 28092 ausente**, **puerto 64631 sin listener** y directorio temporal propio `vgv-e0-39711848c5ecc8715c03dc3cb439c605-PhfqKI` **inexistente**. También se comprobaron las corridas intermedias, incluida la fallida del fixture. Se conserva solo el binario portátil para futuras pruebas, no una instancia activa.

**Archivos de esta corrección, sin atribuir cambios previos ajenos:**

- [product-code.js](../Backend/utils/product-code.js), [image-lifecycle.js](../Backend/utils/image-lifecycle.js): validación/precondiciones y guard común.
- [products.store.js](../Backend/data/products.store.js), [product-images.store.js](../Backend/data/product-images.store.js), [product-imports.store.js](../Backend/data/product-imports.store.js): protocolos de escritura y recibos.
- [products.controller.js](../Backend/controllers/products.controller.js), [products.routes.js](../Backend/routes/products.routes.js): contrato y consulta administrativa.
- [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte), [import-recovery.js](../catalogo-vgv/src/lib/utils/import-recovery.js): reconciliación, identidad y acciones seguras.
- [e0-protocols.test.js](../Backend/tests/e0-protocols.test.js), [product-data-protection.test.js](../Backend/tests/product-data-protection.test.js), [e0-local.mjs](../Backend/integration/e0-local.mjs), [validate-e0-local.mjs](../Backend/scripts/validate-e0-local.mjs): cobertura/runner existente ampliados.
- Este informe y [plan E0](./PLAN_IMPLEMENTACION_E0_VGV.md).

#### 10.7.4 Riesgos y próximo paso seguro

Continúan pendientes: diagnóstico/reconciliación de datos e índices históricos; transición de clientes externos; autorización comercial de campos importables; políticas de conservación/capacidad para recibos e imágenes retenidas; costo del escaneo de códigos históricos en cada alta/cambio y de referencias en limpieza privada; recuperación manual de estados unknown/locks y limpiezas incompletas; E2E de navegador, auth y middleware reales; crash/failover; integridad GridFS comercial; respaldo, restauración y rollback verificables. No hay garantía frente a escritores directos externos ni atomicidad multidocumento.

Próximo paso: revisión del diff y aprobación de contratos/procedimiento manual de reconciliación sobre fixtures, seguida de E2E aislado. Solo después, plan operativo separado y autorizado para diagnóstico histórico, respaldo/restore y eventual índice comercial. No activar estas precondiciones sobre un entorno desconocido.

**E0 NO COMPLETADA.** No se conectó a Atlas/producción, no se ejecutaron importaciones reales ni migraciones, no se tocaron variables/índices comerciales, no hubo deploy ni commit. Respaldo y restauración **no verificados**.
