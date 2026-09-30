# TODO (temporal)

Checklist de pendientes para ir tackleando. Borrar este archivo cuando se vacíe.

## De `fixes.md`

- [x] **Supervisor "Tareas a revisar": filtro Tipo + quitar header intermedio.**
      `EntregasPage` tiene filtro Tipo (Todos / Entregas / Registros de sesión) y
      una sola lista intercalada con un badge por fila; ya no hay header
      "Registros de sesión" en el medio.
- [x] **Informe del 2do test: referencias al test 1.** Los placeholders de la
      tarjeta REGISTRO estaban hardcodeados a Anclas ("El ranking de las 8
      anclas…"). Ahora salen de `REGISTRO_PLACEHOLDERS` según `item.test.type`
      (`frontend/src/components/modules/RegistroCard.tsx`).
- [x] **Tablero de Ideas: la barra inferior se superpone con el contenido.**
      `StepBar` se mide sola (ResizeObserver) y reserva un spacer de su propia
      altura, en vez del `pb-32` fijo que no alcanzaba en mobile.
- [x] **Guardar borrador en todos los entregables.** Hook compartido
      `frontend/src/lib/draft.ts` aplicado a Anclas, Tareas de Exploración, la
      tarjeta REGISTRO y la ENTREGA de Mi Programa. (Tablero, Pirámide, Plan
      Vital y Modelo de Negocio ya lo tenían.)
- [x] **Agregar coach al pool: que le llegue mail de inscripción.**
      `POST /supervisor/pools/:id/enroll` ahora invita: si el email no tiene
      cuenta la crea pendiente y manda la invitación; si ya existe, la suma y le
      avisa por mail.
- [x] **Coachee: mail cuando se le asigna un test.** `assign` y `resend` mandan
      `sendTestAssignedToClient` con el magic link y la fecha límite.
- [x] **Distinguir la bienvenida CIC vs. POOL en el link de inscripción.**
      `InscripcionPage` lee `boundPoolName` y cambia título, subtítulo, copy y
      mensaje de confirmación.
- [x] **Instructivo en texto para los coaches** → `docs/instructivo-coaches.md`
- [x] **Instructivo para la supervisora** → `docs/instructivo-supervisora.md`
- [x] Inscripción aprobada manda mail al coach (ya estaba hecho:
      `sendSignupApprovedEmail`).

## En curso

- [ ] **Resultado del Tablero de Ideas: layout de pantalla completa.** El
      footer (tareas, feedback, PDF) queda fijo al pie de la vista; los títulos
      de cada columna quedan fijos en su caja y sólo scrollea la caja de
      contenido de abajo. Toca `frontend/src/pages/client/ResultsView.tsx`.

## Pendientes previos

- [ ] Al terminar un CIC, los coaches pasan a un grupo "Coaches certificados" (no es un CIC, no tiene módulos — sirve para agregar coachees y hacerles tests)
- [ ] Planes para coaches: gratis el primer mes, pago después
- [~] Cambiar contraseña por mail no queda claro (flow confuso). Hecho: el mail
      de reset ahora explica los pasos, muestra el email de login y lleva a
      `/login?email=...` pre-llenado; la pantalla de cambio explica que la
      temporal deja de valer. Falta decidir si se agrega "Olvidé mi contraseña"
      self-service (link por mail en vez de contraseña temporal).
- [ ] Clase 2: el texto "antes de la sesión, leer libro de Edgar Schein" tiene que ir antes que Bibliografía
- [ ] Foro general

## Detectado de paso

- [x] `POST /supervisor/cohorts/:id/enroll` ahora se comporta como el del pool:
      si el email no tiene cuenta crea el coach pendiente e invita (mail
      nombrando el CIC); si existe lo inscribe y le avisa
      (`sendCohortAddedEmail`). El diálogo "Inscribir alumno" pide nombre.

