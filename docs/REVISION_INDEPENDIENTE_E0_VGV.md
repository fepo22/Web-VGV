# Revision independiente de E0.1-E0.3

Fecha: 23 de octubre de 2026.

**Estado actual: RI-01 a RI-04 corregidos y verificados localmente en el alcance
de la seccion 9. E0 NO COMPLETADA.**

Las secciones 1 a 8 conservan la revision original y sus resultados historicos;
sus referencias a defectos pendientes/no corregidos describen ese momento.
La seccion 9 registra las correcciones posteriores y la decision actual.

## Resumen ejecutivo

Se identificaron **cuatro defectos funcionales: uno de severidad alta y tres
media**. No se identifico un defecto critico en el alcance inspeccionado. Las
pruebas existentes pasan, pero no cubren los escenarios de interaccion de
formulario, recuperacion del panel y variantes que originan estos hallazgos.

Los protocolos backend revisados mejoran la preservacion conservadora de datos:
coordinacion de imagenes, unicidad condicionada a indice efectivo y recibos que
no repiten operaciones confirmadas/ambiguas. Eso no demuestra compatibilidad
con los datos comerciales, que no se consultaron.

**Decision:** se pueden iniciar pruebas funcionales integrales exclusivamente
aisladas y diagnosticas, comenzando por reproducir los hallazgos de este
informe. **No esta listo para aceptacion funcional integral ni para pruebas con
la base protegida de VGV; tampoco para instalacion comercial o despliegue.**
Corregir y verificar estos defectos es requisito previo a esa aceptacion.

## 1. Alcance y metodo

Revision del estado local de VGV, no de una instalacion comercial ni de un
despliegue. Se separaron la inspeccion read-only del diff/codigo y la ejecucion de
pruebas. No se introducen correcciones funcionales en esta revision.

Referencias historicas:

- [Auditoria de compatibilidad](./AUDITORIA_COMPATIBILIDAD_E0_VGV.md), especialmente
  seccion 10.7.
- [Plan E0](./PLAN_IMPLEMENTACION_E0_VGV.md).

La base real de VGV no se consulto. No hubo acceso a Atlas, migraciones,
importaciones comerciales, cambios de indices comerciales, credenciales,
variables de produccion, Vercel, despliegues, instalaciones ni commits.

## 2. Estado inicial y atribucion

- `git status`: 22 archivos tracked modificados y 19 archivos untracked
  enumerados individualmente. Los directorios agrupados de `status --short`
  no equivalen al numero de archivos.
- Diff tracked: 22 archivos, 1014 inserciones y 523 eliminaciones.
- Los seis manifests/locks de raiz, Backend y frontend estan tracked y sin
  diferencias.
- `git diff --check`: exit 0; solo advertencias informativas LF/CRLF.
- Tras las pruebas, los 22 archivos y las cifras del diff tracked continuaban
  iguales. No se revirtieron cambios ni se agregaron cambios funcionales.

El diff contra HEAD mezcla etapas anteriores: auditoria de proteccion de datos,
consumidores PUT, proxies, autenticacion, formularios y herramientas de
integracion. El checkpoint previo y el informe historico identifican esa
procedencia. La ultima etapa E0.1-E0.3 afecto stores y helpers de imagen/codigo,
recibos, controlador/rutas, dashboard/recuperacion, pruebas y documentacion.

**Limite de atribucion:** no existe un commit o snapshot Git separado entre esas
etapas. No puede reconstruirse con exactitud linea por linea la autoria temporal
solo desde el diff actual; el seguimiento historico no equivale a esa prueba.
Los defectos se atribuyen al estado local revisado, no automaticamente a la
ultima etapa.

## 3. Pruebas independientes ejecutadas

| Comando o comprobacion | Resultado |
|---|---|
| `npm.cmd --prefix Backend test` | Exit 0; 89 tests, 89 pass, 0 fail, 0 skipped. |
| `node --test .\Backend\integration\e0-support-check.mjs` | Exit 0; 8 tests, 8 pass, 0 fail, 0 cancelled, 0 skipped. |
| `npm.cmd --prefix catalogo-vgv run lint` | Exit 0; Prettier y ESLint. |
| `npm.cmd --prefix catalogo-vgv run build` | Exit 0; adapter-static genero `dist`; VERCEL y NODE_ENV retiradas solo del proceso hijo. Informacion no bloqueante de tiempos de plugins. |
| `node --check` en 14 archivos JS/MJS del alcance | Exit 0 en todos. |
| `git diff --check` antes y despues de pruebas | Exit 0; sin errores de whitespace. |
| Manifests y lockfiles | Seis archivos sin cambios. |

No existe script `test` frontend declarado. La cobertura del helper de
recuperacion incluida en los 89 tests no es una prueba de navegador. No se
ejecutaron E2E visuales, autenticacion administrativa real ni middleware del
servidor comercial. No se declara type-check independiente: no se ejecuto uno.

Sintaxis comprobada:

- [product-images.store.js](../Backend/data/product-images.store.js)
- [products.store.js](../Backend/data/products.store.js)
- [product-imports.store.js](../Backend/data/product-imports.store.js)
- [image-lifecycle.js](../Backend/utils/image-lifecycle.js)
- [product-code.js](../Backend/utils/product-code.js)
- [products.controller.js](../Backend/controllers/products.controller.js)
- [products.routes.js](../Backend/routes/products.routes.js)
- [product-data-protection.test.js](../Backend/tests/product-data-protection.test.js)
- [e0-protocols.test.js](../Backend/tests/e0-protocols.test.js)
- [e0-local.mjs](../Backend/integration/e0-local.mjs)
- [e0-support.mjs](../Backend/integration/e0-support.mjs)
- [e0-support-check.mjs](../Backend/integration/e0-support-check.mjs)
- [validate-e0-local.mjs](../Backend/scripts/validate-e0-local.mjs)
- [import-recovery.js](../catalogo-vgv/src/lib/utils/import-recovery.js)

### Probes adicionales de los defectos

Se ejecuto un probe Node ESM sin servidor, `.env` ni DB, importando las funciones
reales (no copias) de [save-product.js](../catalogo-vgv/src/lib/utils/save-product.js)
y [import-recovery.js](../catalogo-vgv/src/lib/utils/import-recovery.js):

| Entrada | Resultado observado |
|---|---|
| `shouldRefreshSavedProduct({ status:409, imageFailed:true, savedProduct:{id:"synthetic-confirmed",imagen:"/placeholder.svg"} })` | `false`: descarta recuperacion aun con metadata confirmada. |
| `importRecoveryState({batchId:"synthetic-stable-batch",products:[{codigo:"SYNTH"}]},null)` | `{"retryRows":[],"canRetry":false,"canArchive":false}`. |
| `[5,0,null].map(value => value.trim())` | TypeError en el primer elemento (`5`). Es reproduccion de la expresion incompatible, no prueba del componente ni de los tres valores por separado. |

El probe termino con exit 0 porque sus assertions reproducen el comportamiento
defectuoso observado; **no representa una correccion aprobada**. El bloqueo de
flujo completo y el binding real del componente se sustentan adicionalmente en
la inspeccion de consumidores; faltan pruebas de navegador.

### MongoDB real, exclusivamente sintetico

Antes de escrituras se verificaron las barreras del runner: URI generada
internamente para loopback, base aleatoria exclusiva, entorno limpio sin
dotenv/preloads ni variables comerciales, PID/listener/configuracion/ausencia de
base y ownership. El runner deshabilita autoIndex/autoCreate y no inicia
`server.js`.

Binario portatil existente: MongoDB **8.0.16**. SHA256 cotejado:
`4502859B9EEB9C8348C89E9E58C43AE7AC56B7783A4397120EE5C1D1FF6C9827`.
No se descargo ni instalo nada en esta revision.

Ejecucion:

```powershell
node .\Backend\scripts\validate-e0-local.mjs --mongod 'C:\Users\Usuario\AppData\Local\Temp\vgv-e0-mongodb-8.0.16-4e0c1ece\mongod.exe'
```

- Exit 0, `status: passed`.
- **26 checks aprobados, 0 fallos, 0 findings de la matriz ejecutada.**
- Run: `61d535a8dd8992cd40a359344317edbe`.
- Base: `vgv_e0_integration_61d535a8dd8992cd40a359344317edbe`.
- Listener: `127.0.0.1:61181`; PID 9132.
- Directorio propio: `vgv-e0-61d535a8dd8992cd40a359344317edbe-HTzmxF`.
- Products, recibos, files y chunks terminaron con **0 documentos**.
- Comprobacion externa posterior: PID ausente, puerto sin listener y directorio
  propio eliminado.

La matriz prueba CAS, GridFS y errores de ack/recibos instrumentados sobre
MongoDB real. No prueba todas las intercalaciones, replica set, failover, cortes
fisicos de red, navegador ni instalacion comercial. **Cero findings de esa
matriz no equivale a cero defectos del codigo.**

## 4. Hallazgos funcionales

Las ubicaciones corresponden al estado local revisado. No se modifico codigo
funcional ni se relajaron pruebas para esta revision.

| ID | Severidad | Defecto | Ubicacion principal |
|---|---|---|---|
| RI-01 | Alta | Introducir o vaciar stock impide guardar la ficha por `.trim()` sobre number/null. | [ProductForm.svelte:150](../catalogo-vgv/src/lib/components/ProductForm.svelte#L150), tambien linea 173. |
| RI-02 | Media | Upload 409 posterior a alta confirmada pierde recuperacion del ID y permite otro POST desde la ficha. | [save-product.js:12](../catalogo-vgv/src/lib/utils/save-product.js#L12), [dashboard:807](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L807). |
| RI-03 | Media | Importacion rechazada antes de crear recibo deja la pestana sin accion recuperable. | [dashboard:680](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L680), [import-recovery.js:2](../catalogo-vgv/src/lib/utils/import-recovery.js#L2). |
| RI-04 | Media | Variantes conservadas sin SKU llegan a selector/carrito cuya identidad depende del SKU. | [fetchproductos.js:23](../catalogo-vgv/src/lib/utils/fetchproductos.js#L23), [ficha publica:116](../catalogo-vgv/src/routes/producto/[id]/+page.svelte#L116). |

### RI-01 - Stock numerico no compatible con el guardado

**Evidencia:** [binding del formulario, linea 293](../catalogo-vgv/src/lib/components/ProductForm.svelte#L293)
usa `type="number"` con `bind:value`. Svelte convierte el input a numero y el
vacio a null; se verifico la implementacion instalada del binding, no solo una
suposicion sobre HTML. El formulario llama `stock.trim()` en altas (linea 150)
y ediciones (linea 173).

**Escenario:** introducir stock 5 o 0 al crear/editar una ficha, o vaciar una
cantidad existente, y guardar. La excepcion ocurre antes del HTTP; no equivale
a una validacion comercial ni a un conflicto CAS. Impide las cantidades
explicitas y la conversion a cantidad desconocida desde ese flujo.

**Recomendacion:** manejar number/null de forma explicita y comparar valores
normalizados, preservando cero y desconocido sin coerciones silenciosas.
Agregar pruebas del componente con eventos de input para positivo, cero,
vacio y cantidad sin editar. No cambiar el parser backend para ocultar el error.

### RI-02 - Conflicto de imagen posterior a metadata confirmada

**Evidencia:** [error de upload, linea 169](../catalogo-vgv/src/lib/utils/save-product.js#L169)
conserva `savedProduct` y `imageFailed:true`, pero `shouldRefreshSavedProduct`
excluye cualquier 409/428. El [dashboard, linea 807](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L807)
solo adopta la ficha confirmada si ese helper lo permite; luego aplica la
[rama generica de conflicto, linea 832](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L832).
El probe de la funcion real confirma el descarte.

**Escenario:** POST metadata 201, cambio concurrente antes de asociar imagen,
upload 409, guardar otra vez desde el formulario abierto. La ficha sigue
tratandose como nueva y vuelve a intentar POST. Con el indice vigente, la
unicidad suele frenar ese POST con otro 409; no se afirma que necesariamente
cree un duplicado. Se pierde el flujo de recuperacion de imagen y el mensaje
confunde rechazo de metadata con fallo posterior.

**Recomendacion:** distinguir conflicto de metadata de fallo posterior de
imagen; conservar el ID confirmado en este ultimo sin adoptar automaticamente
metadata concurrente ni relajar CAS. Probar POST 201 -> upload 409 -> nuevo
intento, verificando que no se emita otro POST.

### RI-03 - Lote sin recibo no recuperable desde el panel

**Evidencia:** el dashboard persiste la identidad antes del POST y, ante 401,
ejecuta [logout, linea 201](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L201)
sin eliminar el lote de sessionStorage. Eso es conservador y no es por si solo
un defecto. Pero [consulta, linea 448](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L448)
trata el 404 solo como error; sin informe coincidente el helper inhabilita
retry/cierre. El [guard de archivo nuevo, linea 481](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L481)
continua bloqueando otra importacion.

**Escenario:** POST 401 por sesion expirada, nuevo login en la misma pestana,
GET recibo 404. Tambien puede ocurrir con 429 previo al controlador o fallo
antes de insertar recibo. Recargar la misma pestana no lo resuelve.

**Recomendacion:** ofrecer recuperacion explicita con el mismo batchId y
contenido conservado mediante el protocolo idempotente existente. No usar 404
como prueba suficiente de que se puede crear una identidad distinta, ni
desbloquear unknown/locks existentes. Probar 401/429 -> login -> 404, respuesta
perdida y recibo realmente existente/ambiguo.

Este defecto no es el limite aprobado de mantener bloqueado un unknown durable:
la UI tampoco ofrece recuperacion cuando no se creo ningun recibo.

### RI-04 - Identidad ambigua de variantes conservadas

**Evidencia:** el [controlador, linea 68](../Backend/controllers/products.controller.js#L68)
acepta SKU vacio cuando hay medida; el mapper conserva esas variantes. La ficha
publica usa SKU como clave del each y para [cantidades/seleccion, linea 41](../catalogo-vgv/src/routes/producto/[id]/+page.svelte#L41).
El [carrito, linea 116](../catalogo-vgv/src/lib/stores/carrito.js#L116)
deriva la identidad del producto cuando falta SKU.

**Escenario sintetico:** dos variantes con `{sku:"",medida:"20 mm",minima:1}` y
`{sku:"",medida:"25 mm",minima:1}`. Las filas comparten clave y cantidad; puede
fallar el render keyed y, si se procesa seleccion, las medidas comparten
identidad comercial. No se afirma que existan estos datos en VGV: no se
consulto la base real.

**Recomendacion:** conservar los documentos historicos sin inventar SKU, pero
adaptar presentacion y bloquear explicitamente seleccion ambigua. Validar
identidades en escrituras explicitas de variantes sin alterar las omitidas.
Probar SKU vacio, duplicado, legacy incompleto y persistencia inalterada tras
editar solo metadata.

## 5. Garantias y compatibilidad

| Area | Clasificacion | Evidencia o limite |
|---|---|---|
| CAS PUT y fechas legacy | Verificada en escenarios sinteticos | Misma version produce un ganador y 409; ausente/null/corrupta/futura cubiertas. No certifica todos los documentos reales. |
| Imagenes de escritores internos soportados | Verificada por inspeccion y matriz sintetica | Guard previo a referencia; claim previo a borrar; bytes exactos, reemplazo y fallos cubiertos. |
| Referencias antiguas validas | Probable, no demostrada integralmente | Legacy sin lifecycle se retiene; no se hizo inventario de URLs/metadatos comerciales ni prueba visual real. |
| Lectura de catalogo/proxies | Verificada en alcance de tests/inspeccion | Sin seed en lecturas ni fallback de muestra; DTO publico excluye costo. No verifica contenido comercial actual. |
| Unicidad | Verificada con precondicion sintetica | Indice exacto y guard de historicos; no demuestra indice o ausencia de duplicados en VGV. |
| Importacion existente | Verificada en matriz sintetica | Allowlist, stock desconocido/cero, parciales y no borrado por ausencia. Autorizacion comercial definitiva pendiente. |
| Confirmadas/ambiguas | Verificada en matriz sintetica | Replay no repite; fallo de ack/confirmacion bloqueado incluso desde proceso nuevo. No exactly-once global. |
| Panel completo | Incompatibilidad funcional confirmada por trazas y probes | RI-01, RI-02 y RI-03; falta reproduccion E2E de cada flujo. |
| SKU y variantes | Riesgo condicional identificado | RI-04; no consta si el catalogo comercial contiene identidades ambiguas. |
| IDs actuales | Preservacion por codigo, no inventario comercial | No se reescriben; nuevas altas individuales usan ObjectId string. |
| Clientes bulk antiguos | Incompatibilidad confirmada y deliberada | Sin batchId reciben 428; deben manejar 207 y consulta/retry. |
| Codigos antes saneados / IDs nuevos numericos | Incompatibilidad deliberada | Caracteres descartados pasan a rechazarse; no mantener supuesto de ID numerico. |
| Altas/cambios de codigo en VGV | Desconocida y potencialmente bloqueante | 503 si falta indice exacto o hay historicos no canonicos; no se verifico en base protegida. |
| Escritores/integradores externos | Desconocida | No se inventan consumidores ni se supone que no existan. |

### Imagenes y persistencia: limites que no se reportan como bugs nuevos

- Publicados, legacy y huerfanos protegidos se retienen permanentemente por
  decision aprobada; no es GC completo.
- Un fallo de limpieza conserva marcador no publicable y error, no un exito
  ficticio; no existe recuperacion automatica de todas las limpiezas.
- El pipeline de limpieza de referencias de productos es multidocumento y no
  transaccional. No se promete atomicidad global.
- Proteccion acotada a escritores participantes, no a escrituras directas
  externas que eludan el protocolo.
- Recibos sin TTL y locks sin takeover por vencimiento son decisiones
  conservadoras aprobadas; requieren politica operativa, no replay ciego.

### Panel, autenticacion y accesibilidad basica

Inspeccion estatica: rutas administrativas protegidas por JWT/rol, botones
nativos con texto, labels/fieldsets, deshabilitacion durante operaciones,
seccion de reconciliacion nombrada y pestanas con aria-pressed. El formulario
usa role=status/alert para algunos mensajes. El componente de imagenes por lote
contiene labels, disabled y feedback.

El [feedback general del panel, linea 1184](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte#L1184)
usa parrafos sin role/aria-live; no se acredita anuncio automatico de cambios
asincronos al lector de pantalla. Se recomienda revisarlo junto con foco tras
error y cambios de vista. No se verificaron teclado real, contraste,
zoom/reflow, arbol accesible ni lector de pantalla; no se presenta como
certificacion a11y.

El tratamiento explicito de 207 evita anunciar un parcial como completo.
409/428 tienen ramas visibles de conflicto, pero RI-02 demuestra que la
clasificacion no sirve para todas las fases del guardado. Un error global o de
transporte conserva batchId sin reejecutar automaticamente; RI-03 demuestra un
caso sin salida. El manejo de auth/rol fue inspeccionado, no probado con el
servidor comercial completo. No se afirma que todas las imagenes/productos
actuales se hayan visualizado correctamente.

## 6. Archivos revisados

### Diff acumulado: 22 archivos tracked

- [.dockerignore](../.dockerignore), [.gitignore](../.gitignore),
  [.env.example](../Backend/.env.example): solo configuracion de ejemplo,
  no variables/credenciales del entorno real.
- [products.controller.js](../Backend/controllers/products.controller.js),
  [products.store.js](../Backend/data/products.store.js),
  [product-images.store.js](../Backend/data/product-images.store.js),
  [products.routes.js](../Backend/routes/products.routes.js).
- [adminAuth.js](../Backend/middlewares/adminAuth.js),
  [server.js](../Backend/server.js),
  [sync-products.js](../Backend/scripts/sync-products.js).
- [product-form-image.test.js](../Backend/tests/product-form-image.test.js),
  [DEPLOY_PRESENTACION.md](../DEPLOY_PRESENTACION.md).
- [ProductForm.svelte](../catalogo-vgv/src/lib/components/ProductForm.svelte),
  [ProductTable.svelte](../catalogo-vgv/src/lib/components/ProductTable.svelte).
- [fetchproductos.js](../catalogo-vgv/src/lib/utils/fetchproductos.js),
  [save-product.js](../catalogo-vgv/src/lib/utils/save-product.js),
  [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte).
- Proxies [productos](../catalogo-vgv/src/routes/api/productos/+server.js),
  [productos por ID](../catalogo-vgv/src/routes/api/productos/[id]/+server.js),
  [products](../catalogo-vgv/src/routes/api/products/+server.js),
  [products por ID](../catalogo-vgv/src/routes/api/products/[id]/+server.js).
- [catalogo](../catalogo-vgv/src/routes/catalogo/+page.svelte).

### Nuevos previos a esta revision: 19 archivos

- [product-imports.store.js](../Backend/data/product-imports.store.js).
- [e0-local.mjs](../Backend/integration/e0-local.mjs),
  [e0-support.mjs](../Backend/integration/e0-support.mjs),
  [e0-support-check.mjs](../Backend/integration/e0-support-check.mjs),
  [validate-e0-local.mjs](../Backend/scripts/validate-e0-local.mjs).
- [admin-auth-fallback.test.js](../Backend/tests/admin-auth-fallback.test.js),
  [e0-protocols.test.js](../Backend/tests/e0-protocols.test.js),
  [product-data-protection.test.js](../Backend/tests/product-data-protection.test.js),
  [products-proxy.test.js](../Backend/tests/products-proxy.test.js).
- [image-lifecycle.js](../Backend/utils/image-lifecycle.js),
  [product-code.js](../Backend/utils/product-code.js).
- [import-number.js](../catalogo-vgv/src/lib/utils/import-number.js),
  [import-recovery.js](../catalogo-vgv/src/lib/utils/import-recovery.js),
  [products-proxy.js](../catalogo-vgv/src/lib/utils/products-proxy.js).
- [Auditoria compatibilidad](./AUDITORIA_COMPATIBILIDAD_E0_VGV.md),
  [plan E0](./PLAN_IMPLEMENTACION_E0_VGV.md).
- Contexto historico, no certificacion integral de sus afirmaciones:
  [auditoria E0](./AUDITORIA_E0_VGV.md),
  [auditoria general](./AUDITORIA_VGV_WEB.md),
  [evolucion tienda](./PLAN_EVOLUCION_VGV_TIENDA.md).

### Consumidores adicionales trazados

- [product-images.controller.js](../Backend/controllers/product-images.controller.js),
  [auth.js](../Backend/middlewares/auth.js),
  [socket.js](../Backend/realtime/socket.js).
- [ImageBatchUpload.svelte](../catalogo-vgv/src/lib/components/ImageBatchUpload.svelte),
  [carga de ficha](../catalogo-vgv/src/routes/producto/[id]/+page.js),
  [ficha publica](../catalogo-vgv/src/routes/producto/[id]/+page.svelte),
  [carrito.js](../catalogo-vgv/src/lib/stores/carrito.js).
- Binding numerico de la version Svelte instalada, inspeccionado como evidencia
  de conversion de tipos; no modificado.

## 7. Recomendaciones y decision de continuidad

Orden recomendado, sin haber aplicado las correcciones:

1. Corregir RI-01 y agregar prueba de componente/input real antes de aceptar
   guardado de productos con cantidad.
2. Separar metadata confirmada de fallo posterior de imagen (RI-02), verificando
   que la recuperacion no emita otra alta ni relaje versionado.
3. Recuperacion explicita del mismo batchId sin recibo (RI-03), conservando el
   bloqueo de unknown y de locks existentes.
4. Presentacion/seleccion segura de variantes ambiguas (RI-04), sin inventar
   SKU ni reescribir datos historicos.
5. Ejecutar E2E sintetico con auth/middleware reales, perdida de respuestas,
   expiry/403/429, render de imagenes, variantes, foco y anuncios accesibles.
6. Revisar contratos con responsables VGV y preparar aparte diagnostico
   historico, indice autorizado, transicion de clientes, conservacion de
   recibos/imagenes y recuperacion manual. Respaldo, restore y rollback siguen
   pendientes y **no verificados**.

**Preparados para iniciar pruebas integrales aisladas de diagnostico: SI.**
No requieren datos reales y deben empezar por los cuatro defectos, no por un
happy-path que omita las fallas. **Preparados para dar por validado el flujo
integral de VGV o usar su base protegida: NO.** Los tests verdes actuales no
satisfacen esa puerta.

No se introduce multiempresa, tenants ni arquitectura SaaS. Evitar reparar
estos defectos con IDs sinteticos persistidos en historicos o excepciones a
CAS/identidad: eso comprometeria la preservacion actual y futuras extracciones
de plataforma.

## 8. Cambios guardados en esta revision

Unicamente este informe nuevo:
[REVISION_INDEPENDIENTE_E0_VGV.md](./REVISION_INDEPENDIENTE_E0_VGV.md).
No se modificaron los informes historicos ni archivos funcionales; los
artefactos regenerados por el build no alteraron el diff tracked.
No hubo commit, deploy ni operacion comercial. **E0 NO COMPLETADA.**

## 9. Correcciones posteriores RI-01 a RI-04

### 9.1 Estado previo y preservacion

Antes de editar se leyo este informe completo, el diff acumulado y los archivos
nuevos, y se confirmaron los cuatro defectos en el codigo vigente. Las
ubicaciones se buscaron de nuevo, sin suponer lineas invariantes.

El punto de partida de esta correccion fue el mismo diff tracked de la
revision: 22 archivos, 1014 inserciones/523 eliminaciones; 20 archivos nuevos
enumerados individualmente, contando este informe ya existente. No habia
correcciones funcionales intermedias de RI-01 a RI-04. Una interpretacion
preliminar del inventario indicaba mitigaciones; la lectura directa confirmo
que los defectos seguian presentes y prevalecio sobre esa interpretacion.
No se descartaron ni revirtieron cambios previos.

### 9.2 Hallazgos corregidos y evidencia actual

| Hallazgo / severidad original | Correccion y ubicacion actual | Alcance de la evidencia |
|---|---|---|
| RI-01 / alta: `.trim()` sobre stock numerico o nulo | [buildStockPatch](../catalogo-vgv/src/lib/utils/save-product.js) normaliza tipos y rechaza valores invalidos; [ProductForm](../catalogo-vgv/src/lib/components/ProductForm.svelte) lo utiliza al crear y editar. | Cero explicito se guarda como cero; desconocido no se convierte a cero. Alta desconocida omite stock; edicion conocida a desconocida envia null; valores intactos se omiten. No muta otros campos. |
| RI-02 / media: alta confirmada seguida de upload 409 | [shouldRefreshSavedProduct](../catalogo-vgv/src/lib/utils/save-product.js) conserva la identidad confirmada tambien ante conflicto de imagen; [dashboard, handleProductSubmit](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte) diferencia conflicto de metadata y fallo posterior de imagen. | Se consulta la imagen actual, se presenta el conflicto y se exige nueva aprobacion de reemplazo. El reintento conserva ID y no emite otra alta ni refresca la version de metadata para forzar un PUT. No borra archivos/referencias. |
| RI-03 / media: rechazo previo sin recibo bloquea recuperacion | [import-rejection](../Backend/utils/import-rejection.js), [auth](../Backend/middlewares/auth.js), [adminLimiter](../Backend/middlewares/rateLimit.js), [sendImportBatch](../catalogo-vgv/src/lib/utils/import-recovery.js) y [dashboard, reconcileImport](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte). | Solo rechazos 401/403/429 acreditados antes del controlador habilitan reenvio explicito del mismo batchId/contenido, y solo sin ambiguedad previa. Un 404 de recibo nunca acredita ausencia de escrituras. |
| RI-04 / media: variantes sin identidad unica | [variant-identity](../catalogo-vgv/src/lib/utils/variant-identity.js), [ficha](../catalogo-vgv/src/routes/producto/[id]/+page.svelte), [store carrito](../catalogo-vgv/src/lib/stores/carrito.js), [carrito](../catalogo-vgv/src/routes/carrito/+page.svelte), [Navbar](../catalogo-vgv/src/lib/components/Navbar.svelte) y [checkout](../catalogo-vgv/src/routes/checkout/+page.svelte). | SKU ausente, duplicado o con espacios exteriores queda bloqueado con mensaje. No se inventan SKU ni se modifica el catalogo. Las variantes validas siguen seleccionables; carrito/checkout rechazan identidades ambiguas disponibles en el estado cliente. |

Detalles del protocolo de recuperacion de importacion:

- `submission` es estado cliente, no estado nuevo del recibo ni campo enviado
  al endpoint: `notSent`, `rejected`, `unknown`, `started`, `confirmed`.
- Antes de despachar se persiste `unknown`. Fallo de red, JSON/respuesta perdida,
  respuesta no acreditada, 409, 428 o 500 no habilitan reenvio completo.
- `importNotStarted: true` se agrega exclusivamente por auth/limiter al rechazo
  POST de la ruta bulk anterior a su controlador. `next()` queda fuera del
  bloque que transforma errores JWT para no etiquetar fallos posteriores como
  rechazo previo.
- Un rechazo acreditado posterior a una solicitud ambigua no cancela la
  ambiguedad anterior. Lotes antiguos sin `submission` permanecen conservadores.
- El panel conserva el lote ante 401/403 y solicita nueva autenticacion.
  El reenvio permitido requiere accion explicita y mantiene batchId.
- HTTP 207 conserva el reporte por fila y no implica exito total. Las filas
  confirmadas y `unknown` no se incluyen en recuperacion selectiva; no se
  anulan locks ni se permite repetir una importacion confirmada.
- No se garantiza ejecucion exactamente una vez. Permanecen los gaps entre
  escritura, confirmacion del recibo y recepcion de la respuesta.

Detalles de compatibilidad del carrito:

- Los identificadores de producto y SKU comerciales no cambian. La clave
  cliente es una tupla JSON producto/SKU para evitar colisiones de separadores;
  no es un SKU ficticio ni un identificador persistido en el catalogo.
- La seleccion se representa por fila visual, no por un SKU ambiguo.
  Espacios se usan solo para detectar invalidos/duplicados; no se reescribe SKU.
- Las lineas restauradas ambiguas se conservan para revision, sin fusionarlas
  automaticamente. Carrito, panel lateral y resumen de checkout renderizan por
  fila para evitar errores de claves duplicadas. Cantidad/retiro internos pasan
  tambien el indice de fila, evitando afectar otra linea con la misma clave.
- Los errores al agregar se muestran en [ProductCard](../catalogo-vgv/src/lib/components/ProductCard.svelte),
  ficha y relacionados. Un producto con variantes no puede agregarse como si
  careciera de ellas. Un carrito vacio/sin variantes valido conserva su flujo.
- El store legacy [carrito/carrito.js](../catalogo-vgv/src/routes/carrito/carrito.js)
  no tiene consumidores importadores encontrados y no fue modificado.

### 9.3 Archivos afectados en esta correccion

Ademas de este informe:

- Backend: [auth.js](../Backend/middlewares/auth.js),
  [rateLimit.js](../Backend/middlewares/rateLimit.js),
  nuevo [import-rejection.js](../Backend/utils/import-rejection.js).
- Regresiones: nuevo [review-regressions.test.js](../Backend/tests/review-regressions.test.js),
  [product-form-image.test.js](../Backend/tests/product-form-image.test.js),
  [e0-local.mjs](../Backend/integration/e0-local.mjs).
- Runner: [validate-e0-local.mjs](../Backend/scripts/validate-e0-local.mjs)
  solo actualiza la descripcion de limites para reflejar el subcaso RI-03 con
  router/auth reales; no modifica las barreras de aislamiento.
- Frontend: [save-product.js](../catalogo-vgv/src/lib/utils/save-product.js),
  [ProductForm.svelte](../catalogo-vgv/src/lib/components/ProductForm.svelte),
  [dashboard](../catalogo-vgv/src/routes/admin/dashboard/+page.svelte),
  [import-recovery.js](../catalogo-vgv/src/lib/utils/import-recovery.js),
  nuevo [variant-identity.js](../catalogo-vgv/src/lib/utils/variant-identity.js),
  [carrito store](../catalogo-vgv/src/lib/stores/carrito.js),
  [ficha](../catalogo-vgv/src/routes/producto/[id]/+page.svelte),
  [ProductCard.svelte](../catalogo-vgv/src/lib/components/ProductCard.svelte),
  [Navbar.svelte](../catalogo-vgv/src/lib/components/Navbar.svelte),
  [carrito pagina](../catalogo-vgv/src/routes/carrito/+page.svelte),
  [checkout](../catalogo-vgv/src/routes/checkout/+page.svelte).

No se modificaron esquema, indices comerciales, manifests/lockfiles ni
dependencias. No se implemento multiempresa.

### 9.4 Pruebas ejecutadas y resultados

| Comando / prueba | Resultado real de esta correccion |
|---|---|
| `npm.cmd --prefix Backend test` | Exit 0: 100 tests, 100 pass, 0 fail. Repetido despues de los ajustes finales del carrito. |
| `node --test .\Backend\integration\e0-support-check.mjs` | Exit 0: 8 tests, 8 pass, 0 fail. |
| `node .\Backend\scripts\validate-e0-local.mjs --mongod <ejecutable local verificado>` | Exit 0: 27 comprobaciones aprobadas, 0 fallidas, 0 findings; MongoDB real sintetico 8.0.16. |
| `npm.cmd --prefix catalogo-vgv run lint` | Exit 0: Prettier y ESLint aprobados. |
| `npm.cmd --prefix catalogo-vgv run build` | Exit 0: compilacion cliente/SSR y adapter-static; VERCEL y NODE_ENV retiradas solo del proceso hijo. Sin postbuild de raiz ni despliegue. |
| `node --check` sobre union de JS/MJS modificados y nuevos | 34 archivos, 0 fallos; exit 0. |
| `git diff --check` | Exit 0; avisos informativos LF/CRLF, no errores de whitespace. |

Regresiones automatizadas agregadas:

- Stock 0/positivo/desconocido en alta y edicion, sin mutacion del producto;
  valores invalidos rechazados.
- Creacion confirmada, upload 409 y reintento de imagen conservando ID y version.
- Rechazos 401/403/429 acreditados; prueba HTTP con auth/limiter reales sin
  ejecutar controlador; 404/no prueba/409/428/500 y respuesta perdida no dan
  permiso; rechazo tardio no borra ambiguedad; HTTP 207 conserva filas.
- SKU valido, ausente, duplicado y con espacios; colisiones de claves por
  separadores; carrito restaurado ambiguo e identificador ausente.

MongoDB real se ejecuto exclusivamente mediante el runner aislado. Evidencia:

- Run `fc9c8506054b8284c4f0bfc2f01ce5a8`; MongoDB **8.0.16**.
- Ejecutable portable `mongod.exe` verificado, PID **27796**, puerto **64401**,
  bind exclusivamente **127.0.0.1**, dbpath temporal propio verificado por
  marcador de propiedad y opciones del proceso.
- Base exclusiva `vgv_e0_integration_fc9c8506054b8284c4f0bfc2f01ce5a8`.
  El worker descarta variables comerciales y verifica URI generada localmente,
  ejecutable/PID/listener, configuracion, nombre de base y exclusividad antes
  de escribir. No lee el fallback de conexion del servidor comercial.
- Los 27 checks incluyen CAS con barreras, fechas historicas, GridFS y bytes,
  asociacion/limpieza concurrentes, unicidad sintetica, importacion parcial y
  recibos. El nuevo subcaso RI-03 usa router/auth reales: rechazo sin recibo ni
  producto, consulta 404, recuperacion con mismo batchId y replay sin duplicar.
- Limpieza: cuatro colecciones sinteticas vacias, `processStopped: true` y
  `directoryRemoved: true`; comprobacion externa posterior de PID, puerto y
  directorio ausentes. No se elimina ningun recurso comercial.

Pruebas de navegador ejecutadas con componentes reales y respuestas HTTP
simuladas explicitamente; no equivalen a navegador + servidor comercial +
MongoDB real en una sola topologia:

| Escenario | Evidencia |
|---|---|
| RI-01, edicion con input numerico Svelte real | Submit de 0, 7 y vacio produjo respectivamente 0, 7 y null, sin TypeError. |
| RI-01, alta | Submit de 0, 9 y vacio envio cero, positivo y omision de desconocido. |
| RI-02, dashboard/formulario e imagen sintetica | POST 201, upload 409, consulta de imagen actual y nueva aprobacion, upload 201: 1 alta, 2 uploads, 0 PUT metadata, mismo ID. |
| RI-03, rechazo acreditado restaurado y GET 404 | Reenvio explicito con batchId original; una peticion POST, reporte por fila visible y lote archivado al completarse. |
| RI-03, resultado unknown y GET 404 | Mensaje conservador, sin boton de reenvio, 0 POST. |
| RI-04, cinco variantes | Una seleccionable, dos sin SKU y dos duplicadas deshabilitadas; la valida entra al carrito sin error de claves. |
| RI-04, store real | Adicion de SKU ausente/duplicado rechazada con error y sin modificar el carrito valido. |
| RI-04, panel lateral y filas restauradas duplicadas | Render de dos filas, enlace de cotizacion bloqueado; incrementar segunda produce cantidades [1,3]; retirar primera conserva solo segunda con cantidad 3. |
| RI-04, checkout con duplicadas | Resumen renderiza ambas; formulario con datos sinteticos completos muestra error y no envia ninguna peticion. |

Incidencias de validacion, sin ocultar intentos fallidos:

- Una primera prueba focalizada fallo por una variable mal nombrada en el
  fixture; se corrigio el fixture, no se relajo el criterio.
- Lint detecto claves ausentes en bucles nuevos; se corrigio el render por fila.
- Los harness temporales requirieron corregir resolucion de modulos Svelte,
  procesamiento de imports y stubs; hubo fallos del harness/selector/sincronizacion,
  no resultados aprobados atribuidos a esos intentos.
- Un primer stub de socket no intercepto polling a localhost:3000:
  ERR_CONNECTION_REFUSED, sin backend respondiendo. Se detuvo y corrigio.
- Una herramienta arranco por error el dev frontend estandar en vez del
  harness; solo se comprobo GET raiz, se detuvo inmediatamente y no se usaron
  sus flujos. Los escenarios aprobados usaron exclusivamente harness aislados
  sin carga de `.env` y con fetch/socket sinteticos.
- Una comprobacion auxiliar confundio directorio del ejecutable con dbpath;
  el runner si verifico aislamiento antes de escribir. Un probe de limpieza
  uso inicialmente una variable reservada de PowerShell; la comprobacion
  corregida confirmo la limpieza.
- Los comandos de formato tuvieron intentos iniciales con ruta/patron
  incorrecto; los comandos focalizados corregidos y lint final aprobaron.

No quedan fallos de las suites ejecutadas. Estos fallos transitorios
introducidos durante pruebas/harness no se atribuyen a defectos preexistentes.
No se ejecutaron type-check independiente ni certificacion completa de
accesibilidad. No hay script frontend `test` declarado; las regresiones de
helpers se ejecutan desde la suite backend. Los harness de navegador fueron
temporales, no una suite E2E persistente incorporada al repositorio.

### 9.5 Compatibilidad, riesgos y proximo paso

Compatibilidad verificada en datos sinteticos: contratos PUT/CAS existentes,
imagen separada de metadata, reintento conservando identidad, batchId estable,
207 parcial, prohibicion de replay de confirmadas/unknown y seleccion de SKU
validos. No se cambiaron ID, SKU, variantes, campos comerciales ni rutas de
imagenes en la base de VGV.

Compatibilidad intencionalmente restrictiva: variantes sin SKU unico no pueden
cotizarse desde los flujos revisados; se muestran y conservan para revision
comercial. No se reparan automaticamente. Backends anteriores sin el marcador
de rechazo dejan la recuperacion fail-closed; se requiere frontend/backend
compatibles para habilitar esa recuperacion segura.

Limites abiertos:

- No se consultaron datos comerciales ni indices de VGV: compatibilidad con
  sus historicos sigue sin demostrarse. Los clientes externos del PUT/bulk,
  scripts fuera del repositorio y escritores directos son desconocidos.
- El checkout valida lo disponible en el carrito cliente; no vuelve a
  consultar el catalogo vigente para certificar un SKU restaurado que haya
  cambiado despues. La API historica de cotizacion no incorpora en esta
  correccion una revalidacion autoritativa de variantes contra MongoDB.
  No se promete esa garantia a consumidores directos ni clientes manipulados.
- Persisten operaciones ambiguas y locks sin recuperacion automatica; no hay
  exactly-once ni override seguro implementado. La autorizacion comercial de
  campos importables, politicas de recibos/imagenes e indice comercial siguen
  pendientes.
- Falta E2E reproducible con navegador, auth/limiter, servidor completo y
  MongoDB desechable en la misma topologia, ademas de expiracion durante el
  flujo, perdidas reales de conexion y crash fisico del proceso.
- Respaldo, restauracion y rollback comercial siguen **no verificados**.

Estado Git al cerrar cambios funcionales: **30 tracked modificados**, diff
acumulado **1259 inserciones/584 eliminaciones**, **23 archivos untracked**
enumerados individualmente. No confundir los 16 grupos/directorios que puede
mostrar `status --short` con esos 23 archivos. Son 8 tracked adicionales y
3 archivos nuevos respecto al inicio de esta correccion; este informe ya era
untracked y su ampliacion no entra en `git diff --stat`.
Los seis manifests/lockfiles siguen intactos. Cambios guardados localmente,
**sin commit**.

Se detuvieron los servidores temporales; puertos 5173/5183 sin listener y
procesos de ambos harness ausentes. Se eliminaron solo sus cuatro archivos
temporales propios y las entradas sinteticas de almacenamiento del navegador
cuya propiedad pudo comprobarse.

**Decision actual: SI iniciar pruebas funcionales integrales exclusivamente
sinteticas y aisladas; NO dar por validada la instalacion comercial ni usar su
base protegida.** Proximo paso: preparar esa suite E2E persistente con topologia
completa y barreras de aislamiento equivalentes, antes de cualquier prueba de
aceptacion comercial. No se accedio a Atlas/base protegida, no se migraron datos
ni se desplego. **E0 NO COMPLETADA; despliegue no autorizado.**
