# TODO (temporal)

Checklist de pendientes para ir tackleando. Borrar este archivo cuando se vacíe.

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

## De reunión con supervisora (2026-11-14)

- [ ] **Ruta automatizada del coachee.** Coachee se inscribe por link, carga
      sus datos, el coach aprueba y de ahí en adelante los tests se habilitan
      uno detrás del otro automáticamente. El coach supervisa en paralelo sin
      tener que asignar cada test a mano. Incluye el link de inscripción para
      coachees que faltaba (equivalente al de coaches, pero para coachees).
- [ ] **Usuarios para coachees: login propio + vista propia.** Hoy el coachee
      entra por magic link sin cuenta. Pasar a `User` con rol coachee, login y
      su propia pantalla donde ve su recorrido/tests habilitados. Toca modelo
      de auth (ver `CLAUDE.md` → "Clients (coachees) do NOT [log in]"), hay que
      rediseñar.
- [ ] **Collage automatizado.** Generarlo automáticamente a partir de los
      resultados de todos los tests anteriores de la coachee, en vez de pedirle
      que suba un archivo. Pensar cómo (qué datos tomar de cada test, qué
      formato de salida, si lo arma IA o un template).
- [ ] **Revisión de Gaby asistida por IA.** En la pantalla de supervisión, que
      la IA proponga una devolución basada en lo que Gaby viene escribiendo a
      mano (aprende de sus correcciones). Gaby puede aceptarla, editarla o
      rechazarla. Pensar prompt + cómo se persiste el aprendizaje.
- [ ] **Confirmación visible de mails enviados.** Cuando un coach crea un
      coachee o le envía un test, mostrar un icono / badge / banner que
      confirme que el mail salió (y cuándo). Toca tanto backend (persistir
      timestamp de envío) como UI (coach y supervisora).
### Datos de negocio (anotar, no es código todavía)

- [ ] **Precios actuales de Gaby (referencia, no en la app).**
      - Coachee de Gaby: 800k ARS / 650 USD por única vez.
      - Alumno de CIC: 700–1000 USD por única vez (más alto).
- [ ] **Propuesta de cobro vía la app.**
      - Coaches en pool: fee mensual (monto a definir).
      - Coachees de coaches del pool: NO se cobra por la app; se arregla por
        separado entre coach y coachee.

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

