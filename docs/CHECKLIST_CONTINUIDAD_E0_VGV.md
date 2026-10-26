# Checklist de continuidad: mejoras e implementación VGV WEB

Basada en [PLAN_IMPLEMENTACION_E0_VGV.md](./PLAN_IMPLEMENTACION_E0_VGV.md) y [AUDITORIA_COMPATIBILIDAD_E0_VGV.md](./AUDITORIA_COMPATIBILIDAD_E0_VGV.md). Estado: E0 **NO COMPLETADA**; el código local avanzó, falta evidencia operacional y aprobaciones.

## 0. Avance clasificado en 3 etapas (revisión 2026-10-26)

Verificado: último commit `92d7a97`; `Backend` 100 tests/0 fallos; lint de `catalogo-vgv` correcto. Son pruebas locales con mocks o base desechable, no evidencia operacional.

### Etapa A — Hecho en código local (pendiente solo de publicación)
- [x] E0-A: lecturas sin seed ni mutaciones; sync no destructiva (`$setOnInsert`, `removeMissing` rechazado).
- [x] E0-B: control optimista por `updatedAt` (409/428) en edición e importación.
- [x] E0-C: estado comercial separado de cantidad; `stock: null` = desconocido.
- [x] E0-D: proxies de catálogo sin datos de muestra ante errores.
- [x] E0.1 imágenes: publicación/borrado coordinados por CAS en GridFS.
- [x] E0.2 código: índice único solo sintético y canonicalización compartida.
- [x] E0.3 parciales: recibos durables, 207 explícito, retry selectivo.
- [x] Seguridad básica: sin token admin de fallback; `.env*` ignorados.

### Etapa B — En curso: falta evidencia operacional y aprobaciones (cierre de E0)
- [ ] Respaldo y restore ensayado en entorno aislado; integridad GridFS.
- [ ] Validación de lecturas sin escritura y de concurrencia en copia restaurada.
- [ ] Reversión aprobada y firma final de E0.
- [ ] Aprobación comercial de campos importables y política de seed.
- [ ] E0-S (sesión admin, CSRF, revocación) y E0-Q (avisos/idempotencia) parciales.
- [ ] Clientes externos, Node 20 y build completo.
- [ ] Reconciliación histórica de códigos, recuperación manual de `unknown`, E2E de navegador.

### Etapa C — No iniciado (E1–E6, bloqueado hasta cerrar E0)
- [ ] E1 contratos e identidad aditiva del catálogo.
- [ ] E2 cuentas, roles y permisos.
- [ ] E3 stock por variante con movimientos.
- [ ] E4 costos y precios B2B.
- [ ] E5 solicitud validada y gestión comercial versionada.
- [ ] E6 ensayo final, corte y aprobación de v1.

## 1. Decisiones y aprobaciones (bloquean etapas)

- [ ] Política de seed: conservar demo o importar faltantes (E0-A).
- [ ] Aprobación comercial de la lista permitida de importación (nombre, clasificación, stock explícito).
- [ ] Opción técnica de identidad/revisión para concurrencia (E0-B), cubriendo todos los writers.
- [ ] Alcance de sesión admin, CSRF y revocación (E0-S) antes de abrir roles.
- [ ] Contrato de disponibilidad legacy en UI (E0-C).
- [ ] Tratamiento de líneas ambiguas y mínimos legacy en solicitudes (E0-Q).
- [ ] Extensión de avisos pendientes/idempotencia (E0-Q).
- [ ] RPO/RTO, retención y cifrado de respaldos.
- [ ] Identificar y autorizar destino aislado (staging/copia) y propietario de la DB.
- [ ] Autorización separada para: diagnóstico/reconciliación histórica de códigos, índice comercial y transición de clientes.

## 2. Puertas operacionales (evidencia requerida)

- [ ] Respaldo verificado de MongoDB Atlas (manifiesto, checksums, custodia, claves).
- [ ] Restauración ensayada en entorno aislado con reconciliación de colecciones/índices.
- [ ] Integridad de GridFS (`productImages.files` y `productImages.chunks`) y referencias.
- [ ] Validación de que las lecturas no mutan datos (cero inserts/updates/deletes sobre copia).
- [ ] Control de concurrencia validado en copia restaurada (documentos legacy sin `updatedAt`, importaciones en lote).
- [ ] Procedimiento de reversión aprobado (responsables, criterios de parada, escrituras posteriores).
- [ ] Validación final firmada de E0.

## 3. Compatibilidad y despliegue

- [ ] Verificar clientes externos del `PUT` (`_expectedUpdatedAt`), bulk (`batchId`, 428/207) y códigos 409/503.
- [ ] Ensayo de build/routing con Node 20 (el local es Node 24).
- [ ] Revisar variables de entorno efectivas sin revelar secretos (§5 del plan).
- [ ] Ejecutar build completo de `catalogo-vgv` en aceptación integrada.
- [ ] Revisión funcional completa de autenticación (`adminAuth.js` sin consumidores).

## 4. Trabajo de código pendiente

- [ ] E0.1: política de GC para imágenes legacy/huérfanas (si se aprueba).
- [ ] E0.2: reconciliación histórica de códigos duplicados; índice comercial (con respaldo).
- [ ] E0.3: recuperación manual de `unknown`/locks, conservación de recibos, pérdida de sesión.
- [ ] E2E de navegador para panel admin (importación parcial, conflictos 409).
- [ ] E0-D: errores de catálogo sin datos de muestra (verificar cobertura completa).
- [ ] E0-Q: solicitudes/notificaciones honestas (sin simular outbox).

## 5. Evolución posterior (tras cerrar E0)

Ver [PLAN_EVOLUCION_VGV_TIENDA.md](./PLAN_EVOLUCION_VGV_TIENDA.md).

- [ ] Visibilidad sin stock y "Fecha por confirmar".
- [ ] Aprobación de clientes, listas/tiers y permisos por rol.
- [ ] Precios, descuentos y jerarquía de listas.
- [ ] E1–E6 según el plan de evolución.

## 6. Higiene recurrente por entrega

- [ ] `npm.cmd --prefix Backend test` en verde.
- [ ] `npm.cmd --prefix catalogo-vgv run lint` y build en verde.
- [ ] `git diff --check` limpio.
- [ ] Actualizar documentación del plan y registro §9.2.
- [ ] Sin secretos ni `.env` en commits.
