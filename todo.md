# TODO (temporal)

Checklist de pendientes para ir tackleando. Borrar este archivo cuando se vacíe.

## En curso (nuevo fixes.md)

- [ ] **Modelo de Negocio: editar en pantalla completa.** El Canvas se comprime
      dentro del `Dialog max-w-2xl` del coach y en el `max-w-2xl` del coachee.
      Mover la edición de MODELO_NEGOCIO a una ruta propia full-screen (y de
      paso corregir el header "Soios clave" que aparece recortado al editar).
- [ ] **Plan Vital Integral (y demás PDFs): paginar en A4 sin cortar cajas.**
      Hoy `DownloadResultPdf.tsx` arma una sola página de altura dinámica, y la
      impresora recorta todo a un A4 → sólo imprime la primera. Paginar con
      salto entre bloques, dejando espacio en blanco antes que partir uno.
- [ ] **Tareas (supervisora): filtro por alumno + descarga masiva.** En
      `EntregasPage` agregar filtro de coach; cuando hay uno seleccionado,
      mostrar botón "Descargar todos los registros de sesión de este alumno"
      (sólo los `PracticeRecord` del módulo — no los `SessionRecord` reales).
- [ ] **Tareas (supervisora): botón de descarga PDF por fila.** Cada registro
      de sesión del módulo pasa a tener un botón de descarga individual.
- [ ] **Registros de sesión en el módulo (coach): descargar PDF.** Dentro de
      la tarjeta REGISTRO (`RegistroCard.tsx`), cuando ya se envió, agregar
      botón "Descargar PDF".
- [ ] **"Mis Coachees": abreviaciones completas + orden canónico + tooltip
      propio.** Hoy sólo muestra AC/TI/PV/PP/MN. Agregar TE, MN, CO, OC, PA en
      el orden del programa, con un tooltip propio al hacer hover (nunca
      nativo).
- [ ] **Unificar Cliente ↔ Coachee.** Renombrar "Cliente" por "Coachee" en toda
      la UI (navegación, títulos, botones), mover edad/sexo/trabaja/posición
      del `SessionRecord` al `Client` (pre-llenado al registrar sesión),
      renombrar "Sesión" por "Registro de sesión", y en la ficha del coachee
      agregar botón para descargar todos sus registros juntos.
- [ ] **Replicar Collage, Objetivo de Carrera y Plan de Acción para
      coachees.** Agregar los 3 al `TEST_ORDER` de `ClientDetailPage.tsx` y a
      los dots de "Mis Coachees". Verificar que Objetivo y Plan de Acción
      figuren en el selector de tests al crear una card `kind=TEST`.

## De `fixes.md` (previo)

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
- [ ] **Tablero de Ideas — ideas con IA: no pisar lo generado.** Una vez que
      la IA generó ideas, el botón "Volver a generar" queda deshabilitado; se
      re-habilita cuando el usuario elimina alguna fila y, al re-generar, la
      IA sólo rellena las filas faltantes sin tocar las que quedaron.

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

