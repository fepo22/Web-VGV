# E0 · Iteración 1: auditoría de escrituras, procedimientos y decisiones

**Fecha:** 26-10-2026. **Alcance:** solo lectura y documentación. No se conectó a ninguna base de datos, no se modificó código funcional ni se ejecutó ninguna operación.
**Estado de E0:** ABIERTA. Nada de este documento constituye evidencia operacional ni aprobación. Responsables, valores de RPO/RTO y entornos aparecen como **PENDIENTE DE VGV** salvo que se indique lo contrario.

Complementa [PLAN_IMPLEMENTACION_E0_VGV.md](./PLAN_IMPLEMENTACION_E0_VGV.md) (§4 respaldo, §7 reversión, §8 decisiones) y [CHECKLIST_CONTINUIDAD_E0_VGV.md](./CHECKLIST_CONTINUIDAD_E0_VGV.md).

## 1. Archivos revisados

`Backend/data/products.store.js`, `product-imports.store.js`, `product-images.store.js`, `customers.store.js`; `Backend/scripts/sync-products.js`; `Backend/utils/product-code.js`; `Backend/routes/{products,products.public,product-images,cotizar,customer}.routes.js`; `Backend/controllers/{cotizar,customer,auth,products}.controller.js` (parcial en este último); `Backend/middlewares/{auth,adminAuth}.js`; `Backend/server.js`; `Dockerfile`, `docker-compose.yml`, `.gitignore`.
No revisado a fondo: `image-lifecycle.js`, `product-images.controller.js`, el frontend y los middlewares de seguridad/rate limit.

## 2. Auditoría de caminos de escritura

### 2.1 Inventario (evidencia: búsqueda de operaciones de escritura en `Backend/`)

| Camino | Quién lo invoca | Protección verificada | Observación |
|---|---|---|---|
| `syncSeedProducts` (`$setOnInsert`, upsert) | Solo `npm run sync:seed` | Rechaza `removeMissing`, producción, Vercel y URI no local, tanto en el script como en la función | Sin camino HTTP. Correcto. |
| `createProduct` (`ProductModel.create`) | `POST /admin/products` | JWT admin; `requireCodeIndex` (503 si falta índice único) | Correcto. |
| `bulkUpsertProductsByCode` (`bulkWrite` ordenado) | `POST /admin/products/bulk` | JWT admin; lista permitida de campos; filtro por `updatedAt` | Escritura parcial posible por diseño, con recibos. |
| `updateProductById` (`findOneAndUpdate`) | `PUT /admin/products/:id` | JWT admin; `updatedAt` obligatorio | Correcto. |
| **`deleteProductById`** (`findOneAndDelete` + `updateMany`) | `DELETE /admin/products/:id` | Solo JWT admin | **Sin control de versión** y sin soft-delete (hallazgo H1). |
| Recibos de importación (`productImportReceipts`) | Bulk | Lock con token | Sin política de retención documentada. |
| GridFS (`openUploadStream`, `findOneAndUpdate`, `deleteMany`, `deleteOne`) | `POST /admin/products/images`, ciclo de vida | Claim CAS en metadatos | Solo borra uploads propios privados. |
| `Quotation.create` | `POST /api/cotizar` (público, con rate limit) | Joi, límite de 128 kb | Sin idempotencia (H4). |
| `Quotation.findOneAndUpdate` | `PATCH /api/cotizar/:id/estado` (admin) | Transiciones permitidas y filtro por estado actual | Correcto. |
| `Customer.*` (`create`, `save`, `findOneAndUpdate`) | `customer.controller.js` | `app.use("/api/clientes")` responde 404 | **Inalcanzable hoy** (rutas desconectadas, §2.2). |
| Logs (`DailyRotateFile`) | `server.js` | Fuera de Vercel | Escribe archivos locales, no datos de negocio. |
| `users.json` | `USERS_FILE` en `auth.controller.js` (lectura) | No se escribe | El archivo versionado solo tiene la clave `users` (18 bytes). |

### 2.2 Hallazgos nuevos

| # | Hallazgo | Evidencia | Severidad respecto a E0 |
|---|---|---|---|
| **H1** | El borrado de producto no usa `_expectedUpdatedAt`. Un administrador puede borrar una ficha que otro acaba de editar, y el borrado es físico. Además el `updateMany` posterior que limpia `relatedProductIds` no es atómico con el borrado: un fallo intermedio deja referencias colgantes. | `deleteProductById` en `products.store.js` (`findOneAndDelete({ id })`, luego `updateMany`); ruta `DELETE /:id` sin precondición. | **Alta**: evade el control de concurrencia de E0-B y destruye datos. Requiere decisión (soft-delete o precondición) antes de cambiar el contrato. |
| **H2** | Mongoose no tiene `autoIndex: false`. Al conectar y compilar los modelos, el driver puede crear los índices declarados (`Product.id` único, `codigo`, `createdAt/id`; `Customer.email` único, `googleSub`; los tres de `Quotation`) y colecciones faltantes, incluso con los endpoints de clientes desactivados. Esto contradice la premisa de "lecturas sin escrituras de estructura" y puede fallar o bloquear si hay duplicados históricos de `id`. | Búsqueda de `autoIndex`/`syncIndexes`: sin resultados; `mongoose.connect` sin esa opción; esquemas con `index()`/`unique`. Es el comportamiento por defecto de Mongoose, pero **debe confirmarse** en un entorno aislado antes de afirmarlo en producción. **Confirmado localmente (mongoose 9.9.2, mongod 8.0.16 desechable, base vacía):** tras `connectProductsDatabase()` más la importación de `cotizar.controller.js` se crearon sin ninguna escritura de la aplicación las colecciones `products` (`id_1` único, `codigo_1`, `createdAt_-1_id_-1`), `quotations` (3 índices) y `customers` (`email_1` único, `googleSub_1` único); `autoIndex`/`autoCreate` valen `true` por defecto. Esto confirma el efecto en una base vacía; el comportamiento sobre datos históricos con duplicados sigue sin probar. | **Alta** para B3. Cambiarlo requiere decisión (ver D-11). |
| **H3** | `Customer` y su índice único se registran por importación (`cotizar.controller.js` importa `getCustomerFromRequest`) aunque la cuenta de clientes esté desactivada. Aparte de H2, el camino de lectura de cliente solo hace `findById`. | `cotizar.controller.js` línea de import; `server.js` comentario "Cuenta de clientes desactivada". | Media. |
| **H4** | `POST /api/cotizar` no tiene clave de idempotencia: un doble envío crea dos cotizaciones. Los `id`, `nombre` y `cantidad` de las líneas vienen del cliente y no se validan contra el catálogo (sin tope de cantidad). Si falta el correo o falla el envío se responde 202 "registrada, notificación pendiente", pero no se persiste ningún indicador de pendiente, por lo que nadie puede reenviar. El mensaje es honesto, la recuperación es manual. | `sendQuotation` en `cotizar.controller.js`. | Media (E0-Q). |
| **H5** | Socket.IO usa `origin: "*"` si `CLIENT_ORIGIN` no está definido. Requiere JWT admin, por lo que el impacto es bajo. | `server.js` bloque `new SocketIOServer`. | Baja. |
| **H6** | El secreto JWT cae a un valor de desarrollo si falta `JWT_SECRET` fuera de producción. El `Dockerfile` fija `NODE_ENV=production`, lo que mitiga el riesgo en ese despliegue. Falla si se ejecuta sin esa variable. | `auth.js`; `Dockerfile` (`ENV NODE_ENV=production`). | Baja/media. Verificar entorno efectivo. |
| **H7** | Solo hay JWT de 8 h en cabecera Bearer: sin revocación ni versión de sesión para admin y sin CSRF (no aplica a Bearer, pero sí si se migra a cookie). | `auth.controller.js` (`JWT_EXPIRES_IN` por defecto `"8h"`); `auth.js`. | Media (E0-S pendiente). |
| **H8** | `docker-compose.yml` usa `mongo:7`; la validación local de integración fue sobre MongoDB 8.0.16 y el despliegue real es Atlas (versión no verificada). | `docker-compose.yml`; plan §10.7. | Baja. Registrar versión efectiva en B2. |
| **H9** | Confirmado: `/admin/products/*` aplica `adminLimiter` + `authMiddleware` a todas las rutas; `GET /api/cotizar` y el `PATCH` también están protegidos. `adminAuth.js` solo lo consumen sus tests. | `products.routes.js`, `cotizar.routes.js`. | Sin riesgo. |

### 2.3 Matriz de riesgos actualizada

| Prioridad | Riesgo | Mitigación disponible hoy | Bloquea |
|---|---|---|---|
| 1 | Sin respaldo/restauración probados | Ninguna | Cualquier cambio de datos |
| 2 | H1 borrado sin versión ni soft-delete | Solo el rol admin puede borrar | B4, cierre E0 |
| 3 | H2 creación implícita de índices al conectar | Ninguna verificada | B3 |
| 4 | Duplicados históricos de código y `id` sin diagnosticar | Índice único exigido para alta/cambio de código (503) | Índice comercial |
| 5 | Clientes externos del `PUT`/bulk no verificados | Contrato explícito (428/409/207) | Despliegue |
| 6 | Node 20 (Dockerfile) frente a 24 (pruebas locales) | Ninguna | Despliegue |
| 7 | Importaciones `unknown`/locks sin recuperación manual | Bloqueo seguro | Operación de planillas |
| 8 | H4 solicitudes duplicadas y sin recuperación de aviso | Mensajes honestos 202 | E0-Q |
| 9 | Huérfanos GridFS retenidos sin política | Retención segura | Limpieza |
| 10 | H7 sesión admin sin revocación | Expiración de 8 h | E0-S/E2 |

## 3. Procedimiento B1: respaldo verificable (no ejecutado)

El inventario de recuperación y las reglas de manifiesto/custodia ya están en el plan §4.0–§4.2; este es el orden de ejecución. **Ningún paso se ejecuta sin autorización.**

**Prerrequisitos (PENDIENTE DE VGV):** propietario de la base y responsable técnico; entorno de origen identificado por alias privado; RPO/RTO, retención y cifrado acordados; destino de respaldo con custodia aprobada; acceso solo lectura para el operador.

1. **Autorizar y registrar:** persona que autoriza, operador, fecha/hora/zona, alias del origen, método (snapshot gestionado de Atlas o dump consistente según la topología confirmada).
2. **Punto consistente:** usar snapshot del proveedor o pausar escrituras de forma autorizada; no mezclar dumps de colecciones con escrituras activas.
3. **Alcance mínimo:** colecciones `products`, `quotations`, `customers`, `productImportReceipts` y las colecciones adicionales que existan; `productImages.files` y `productImages.chunks`; definiciones de índices y opciones. Los nombres físicos se confirman en la base, no se suponen.
4. **Fuera de la base:** assets estáticos de `public/`, el commit exacto, lockfiles y configuración no secreta. Los secretos y claves de recuperación se custodian aparte.
5. **Manifiesto privado:** identificador único (sin sobrescribir uno existente), versión de servidor/herramienta, colecciones e índices, conteos, SHA-256 de cada archivo cifrado. No va al repositorio.
6. **Verificación:** recalcular checksums tras la transferencia, comprobar descifrado y lectura del formato. Un checksum correcto no acredita consistencia lógica.
7. **Cierre:** acta con resultado y discrepancias agregadas, sin URI ni PII. El respaldo solo se considera validado cuando B2 lo restaura con éxito.

**Parada:** destino ambiguo, falta de clave de recuperación, error de herramienta no explicado, checksum distinto o nombre de respaldo ya existente.

## 4. Procedimiento B2: restauración aislada (no ejecutado)

Sigue el plan §4.3–§4.4. Resumen ejecutable:

1. **Destino:** instancia o base nueva y desechable, con credenciales exclusivas, sin acceso a producción y sin egress SMTP/OAuth. Se confirma la identidad del destino antes de restaurar. Nunca `drop` sobre el origen.
2. **Compatibilidad:** registrar la versión del servidor del origen y del destino (H8) y la de las herramientas.
3. **Restaurar** datos e índices. Un índice único fallido se investiga; no se degrada a no-único para declarar éxito.
4. **Comparar con el manifiesto:** colecciones, conteos, índices y restricciones, documentos legacy (sin `updatedAt`, sin `stock`, códigos no canónicos), recibos de importación, relación archivos ↔ chunks ↔ `Product.imagen`.
5. **No arrancar el servicio con credenciales reales.** Usar transporte de correo falso; la copia contiene PII y hashes (clientes, cotizaciones).
6. **Habilita B3 y B4** (ver el plan §6): línea base cruda por documento antes de cualquier lectura, comparación posterior y detección de escrituras con el profiler/oplog de la copia, no solo conteos; con un resultado esperado y otro observado por caso.
7. **Evidencia:** acta con comandos, entorno (alias), fechas, resultados y discrepancias, firmada por el responsable.

**Parada:** destino que pueda ser producción, discrepancia de conteos/índices/GridFS sin explicación o servicio que intente contactar sistemas reales.

## 5. Procedimiento B5: reversión (propuesta, no ejecutada)

**Responsables:** todos **PENDIENTE DE VGV**. Roles necesarios: autoridad de decisión de negocio, responsable técnico de la aplicación, propietario de la base de datos y custodio de respaldos. No se asignan nombres.

**Criterios de parada del despliegue (cualquiera):** falta de un respaldo restaurado con éxito; destino ambiguo; diferencia en IDs, stock o referencias de imagen; un 5xx sostenido tras el corte; lecturas que provocan escrituras; pérdida de un índice; mensaje de éxito sin persistencia; clientes externos que fallan por 428/409/207.

**Reversión de aplicación (sin tocar datos):**
1. Volver al artefacto/commit anterior registrado antes del corte (hoy `92d7a97` es el último publicado).
2. Mantener flags y secretos tal como estaban; no cambiar el seed ni reactivar sincronización destructiva.
3. Verificar `/health`, lectura de catálogo y autenticación admin.

**Reversión o corrección de datos:**
- Preferir **corrección hacia adelante**. Restaurar una copia solo con autorización y plan de conciliación, porque puede perder escrituras posteriores al respaldo (productos, cotizaciones, recibos, imágenes).
- Antes de cualquier restauración, tomar un respaldo del estado actual y exportar las cotizaciones y recibos creados después del corte.
- Conciliar por `_id`/`updatedAt`/`createdAt`: lo creado después del punto de respaldo se reaplica o se descarta por decisión explícita del responsable de negocio.
- Los cambios en índices se revierten con un procedimiento propio autorizado; no se eliminan índices únicos a posteriori sin análisis de duplicados.

**Verificación posterior y criterios para reanudar:** comparación contra manifiesto/inventario privado, lectura de catálogo sin errores, cotizaciones y recibos conciliados, aprobación escrita del responsable técnico y de negocio.

## 6. Fichas de decisión para VGV

Todas permanecen **PENDIENTES**. "Aprueba" es el rol propuesto, no una persona asignada.

| ID | Problema | Opciones | Recomendación técnica | Riesgo / impacto | Evidencia que falta | Aprueba |
|---|---|---|---|---|---|---|
| D-01 Seed | Conservar demo o importar solo faltantes | (a) sin seed en prod; (b) seed solo local/`$setOnInsert` (hoy); (c) importar faltantes con aprobación | (b) y (a) en producción | Bajo, no cambia contrato | Inventario real de la base | Negocio + técnico |
| D-02 Campos importables | Hoy: nombre, clasificación, stock explícito | Mantener / ampliar / reducir | Mantener la lista actual | Ampliarla expone costos/estado a planillas | Confirmación comercial | Negocio |
| D-03 Concurrencia | `updatedAt` es granular por documento | (a) mantener; (b) campo `rev` aditivo; (c) `updatedAt` por sección | (a) ahora; evaluar (b) en E1 | (b) requiere backfill | Pruebas B4 | Técnico |
| D-04 Borrado (H1) | Borrado físico sin versión | (a) exigir `_expectedUpdatedAt`; (b) baja lógica; (c) ambas | (c), con (a) mínimo | Cambia contrato de `DELETE` (clientes externos); (b) toca esquema y lecturas | Clientes del `DELETE` | Negocio + técnico |
| D-05 Sesión admin | JWT 8 h sin revocación (H7) | Mantener / `sessionVersion` / cookie + CSRF | Mantener hasta E2; documentar | Cookie obliga a cambiar cliente y servidor juntos | Alcance de E2 | Técnico |
| D-06 Disponibilidad legacy | `stock: null` frente a `estado` | Estado independiente (hoy) / derivar | Mantener independiente | Visualización en UI | Contrato de UI | Negocio |
| D-07 Líneas ambiguas | Cotización con `id`/nombre libres | Validar contra catálogo / marcar para revisión manual | Marcar para revisión; no elegir SKU arbitrario | Rechazos legítimos si se valida estrictamente | Reglas comerciales | Negocio |
| D-08 Avisos pendientes (H4) | 202 sin indicador persistente | (a) campo `avisoPendiente` en la cotización; (b) outbox | (a) mínimo, sin fingir cola | Cambio aditivo de esquema | Política de reintento | Técnico + negocio |
| D-09 Idempotencia | Doble envío duplica | Clave de idempotencia / deduplicar por ventana | Clave enviada por el cliente | Cambio de contrato público | — | Técnico |
| D-10 RPO/RTO | Sin valores | Definir | Los define VGV | Determina método de respaldo | Tolerancia de pérdida | Negocio |
| D-11 `autoIndex` (H2) | Índices implícitos al conectar | `autoIndex: false` en prod + migración explícita | Aplicar tras confirmar H2 en aislamiento | Un índice declarado dejaría de crearse solo; hay que crearlo con procedimiento | Prueba H2 en copia | Técnico + propietario DB |
| D-12 Entorno aislado | No identificado | Atlas dedicado / instancia local con copia | El que pueda recibir un respaldo cifrado | Bloquea B2–B4 | Propietario y destino | Propietario DB |
| D-13 Autorizaciones separadas | Reconciliar códigos, índice comercial, clientes, limpieza de imágenes | Una por una | No agrupar | Operaciones potencialmente destructivas | Respaldo restaurado | Negocio + propietario DB |

## 7. Informe de cierre B6 (borrador, E0 NO COMPLETADA)

| Puerta | Estado | Evidencia disponible | Evidencia faltante | Aprobación necesaria |
|---|---|---|---|---|
| Código local E0-A…E0.3 | Implementado y validado por pruebas automatizadas locales | 100 tests Backend sin fallos y lint correcto (ejecutados el 26-10-2026) | Build completo de `catalogo-vgv` no ejecutado en esta sesión | — |
| Compatibilidad Node 20 | **BLOQUEADO POR EVIDENCIA** | Dockerfile en Node 20 | Ensayo en Node 20 | Técnico |
| B1 Respaldo | **BLOQUEADO POR APROBACIÓN/INFRA** | Procedimiento (§3) | Respaldo real, manifiesto, checksums | Propietario DB |
| B2 Restauración | **BLOQUEADO POR INFRAESTRUCTURA** | Procedimiento (§4) | Destino aislado, acta | Propietario DB |
| B3 Lecturas sin escritura | Bloqueado por B2 | Pruebas con mocks y base desechable local | Ejecución en copia; confirmar H2 | Técnico |
| B4 Concurrencia | Bloqueado por B2 | Pruebas locales | Casos en copia, H1 resuelto | Técnico |
| B5 Reversión | Propuesta redactada | Sección 5 | Responsables y aprobación | Negocio |
| Decisiones D-01…D-13 | **BLOQUEADO POR APROBACIÓN** | Fichas (§6) | Decisión de VGV | Ver tabla |
| Aprobación técnica y comercial, fecha y responsable | Sin registrar | — | Firma | Técnico y negocio |

**Pruebas fallidas conocidas:** ninguna en las ejecutadas. **Riesgos residuales:** los del §2.3.
**Estados de validación (plan §12):** implementado en código ✔; validado por pruebas automatizadas ✔ (locales); validado en entorno aislado ✘; validado operacionalmente ✘; aprobado formalmente ✘; publicado en producción: el commit `92d7a97` está en `origin/main`, pero este documento no verifica su despliegue.

## 8. Bloqueos que impiden cerrar E0

1. Sin entorno aislado ni propietario de la base (D-12).
2. Sin respaldo ni restauración ensayados (B1/B2).
3. H1 (borrado) y H2 (índices implícitos) sin resolver ni confirmar.
4. Decisiones D-01…D-13 sin responder.
5. Sin ensayo en Node 20 ni build integrado.
6. Sin verificación de clientes externos de `PUT`, `DELETE` y bulk.
7. Sin firmas técnica y comercial.
