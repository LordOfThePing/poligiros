# TODO (temporal)

Checklist de pendientes para ir tackleando. Borrar este archivo cuando se vacíe.

## De `fixes.md` — pendiente (WIP)

- [ ] **Supervisor "Tareas a revisar": filtro Tipo + quitar header intermedio.**
      Ver sección **"Tareas a revisar (WIP)"** más abajo.

## De `fixes.md`

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

## Pendientes previos

- [ ] Al terminar un CIC, los coaches pasan a un grupo "Coaches certificados" (no es un CIC, no tiene módulos — sirve para agregar coachees y hacerles tests)
- [ ] Planes para coaches: gratis el primer mes, pago después
- [ ] Cambiar contraseña por mail no queda claro (flow confuso)
- [ ] Clase 2: el texto "antes de la sesión, leer libro de Edgar Schein" tiene que ir antes que Bibliografía
- [ ] Foro general

## Detectado de paso

- [ ] `POST /supervisor/cohorts/:id/enroll` (agregar coach a una camada) tiene el
      mismo problema que tenía el pool: exige que la cuenta ya exista y no manda
      ningún mail. Se podría unificar con el nuevo comportamiento del pool.

---

## Tareas a revisar (WIP)

Fuente: `fixes.md`. Archivo único a tocar: `frontend/src/pages/supervisor/EntregasPage.tsx`.

### El bug (textual)

> Sigo sin poder ver filtro **Tipo** en "Tareas a revisar" como supervisora.
> Además, veo un header "Registros de sesión" en el medio de la lista.
> **No debe verse ese header.**

Ejemplo de lo que ve hoy:

```
Tareas
Lo que los coaches entregan en las tarjetas de tipo Entrega...

Estado: Sin devolver   CIC: Todos los CIC   Tarea: Todas las tareas   Ordenar por: Más recientes

Micaela Di Julio · CIC #14 · Sin devolver
CLASE 2 · Lecturas Clase 2: motivación intrínseca
micaela@somosarete.com · entregó el 17/09/2026 · [Devolver]

Registros de sesión                       ← ❌ este header sobra
Prácticas en duplas: quién entrevistó a quién dentro de una clase.

Micaela Di Julio entrevistó a Valeria Pascuttini · CIC #14 · Sin devolver
CLASE 3 · TAREA 1 - Práctica de 2da Sesión de Coaching
Sesión del 20/09/2026 · entregado el 17/09/2026
```

### El fix

1. **Agregar filtro "Tipo"** en la fila de filtros (al lado de Estado / CIC / Tarea / Ordenar por):
   - Valores: `all` → "Todos", `entrega` → "Entregas", `registro` → "Registros de sesión".
   - Filtra tanto `visibleSubmissions` como `visiblePractices`.
2. **Unificar en una sola lista intercalada** ordenada por `sortOrder` compartido (recent | name).
   - Borrar el `<h2>Registros de sesión</h2>` intermedio.
   - Cada fila conserva su layout (entregas: `coach · email · entregó el X`; registros: `coach entrevistó a coachee · sesión del X`).
   - Sumar un `Badge` chico por fila para distinguir a simple vista ("Entrega" vs "Registro").
3. Copy del empty-state: reemplazar "No hay entregas..." por "No hay tareas..." (ahora cubre ambos tipos).

### Avanzado (WIP ya commiteado)

En `EntregasPage.tsx` ya está hecho lo siguiente — verificar y continuar:

- ✅ Nuevo tipo `TypeFilter = "all" | "entrega" | "registro"`.
- ✅ Nuevo estado `const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")`.
- ✅ `visibleSubmissions` y `visiblePractices` filtran por `typeFilter`.
- ✅ Feed unificado `FeedItem[]` (union `entrega` | `registro`) ordenado en conjunto.

### Falta

- ❌ Renderizar el `<Select>` de "Tipo" en la fila de filtros (copiar el patrón de CIC/Tarea).
- ❌ Reemplazar los dos bloques de render (`{visibleSubmissions.length === 0 ...}` y `{visiblePractices.length > 0 && ...}`) por un único loop sobre `feed`, branching por `item.kind`.
- ❌ Eliminar el `<h2>Registros de sesión</h2>` intermedio y su subtítulo.
- ❌ Actualizar el mensaje de empty-state para cubrir ambos tipos.
- ❌ Opcional: `Badge` por fila indicando "Entrega" vs "Registro".
- ❌ `cd frontend && npm run build` para type-check final.

### Plan de test

- Login como supervisora (Gaby).
- Ir a **Tareas a revisar**.
- El filtro Tipo debe mostrar 3 opciones y filtrar bien.
- No debe aparecer ningún header "Registros de sesión" en la lista.
- Entregas y registros deben intercalarse por fecha (o nombre al togglear).
- El flow de "Devolver" sigue funcionando para ambos tipos (los `Dialog` no cambian).
