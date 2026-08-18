# TODO

Pendientes acumulados al 13/08/2026. Ordenado por lo que bloquea producción primero.

---

## 1. Bloqueantes de producción

### 1.1 Enum `MODELO_NEGOCIO` roto en el servidor

El bootstrap del servidor quedó a medias. `prisma.test.upsert` falla con:

```
invalid input value for enum "TestType": "MODELO_NEGOCIO"  (código 22P02)
```

Estado verificado en el servidor: las 6 migraciones figuran aplicadas, sin
`rolled_back_at`, y todas las tablas existen (incluida `TestResetRequest`) — o sea
**no** es un schema a medio migrar. El bootstrap alcanzó a insertar los primeros
4 tests y murió en el quinto, así que al enum le falta ese valor pese a que la
migración `20260616163333_modelo_negocio_test` lo agrega.

**No tengo explicación confirmada de cómo quedó registrada la migración sin
haberse aplicado.** Falta el dato que nunca corrimos:

```sql
SELECT unnest(enum_range(NULL::"TestType"));
```

- [ ] Correr ese `SELECT` en el servidor y ver si el valor está o no
- [ ] Si falta: `ALTER TYPE "TestType" ADD VALUE IF NOT EXISTS 'MODELO_NEGOCIO';`
- [ ] `make prod-restart` — Prisma cachea el enum por conexión, sin reinicio la API
      sigue rechazándolo
- [ ] Re-correr `make prod-bootstrap`
- [ ] Si el valor **ya estaba**, entonces la causa fue el cache de Prisma y no el
      schema: distinto diagnóstico, y quiere decir que los endpoints de Modelo de
      Negocio estuvieron rotos en vivo hasta el reinicio

### 1.2 Aplicar las 3 migraciones nuevas en el servidor

Ninguna corrió todavía en prod. Las tres ya se aplicaron **local** con
`migrate diff --exit-code` dando `No difference detected` (cero drift).

- [ ] `20260813120000_modules_per_cohort_signup`
- [ ] `20260813140000_settings_and_signup_links`
- [ ] `20260813170000_module_link_files`
- [ ] `20260813190000_module_item_progress`
- [ ] `20260813210000_module_item_test`
- [ ] `20260813230000_module_item_submission`
- [ ] Resolver primero 1.1, después `make prod-deploy`

> El bloque de migración de datos `Material → ModuleItem + ModuleLink` **no está
> ejercitado**: local tenía 0 módulos, así que el `DO $$` recorrió 0 filas. En el
> servidor también hay 0 módulos, así que en la práctica es un no-op ahí igual.

### 1.3 Commitear y pushear

Todo el trabajo de CIC / módulos / inscripciones / markdown / R2 está **sin
commitear**. El servidor deploya con `git pull`, así que hasta que no se pushee no
llega nada.

- [ ] `git add` + commit + push

---

## 2. Cloudflare R2 — terminar de configurar

Bucket `poligiros` creado (ENAM). El código está listo; con las variables vacías
el botón de subida responde 503 con mensaje claro y el resto anda.

- [ ] **Custom Domain** en el bucket, ej. `archivospoligiros.flynnpedroa.engineer`
      (mejor que el Public Development URL: `r2.dev` está fuertemente
      rate-limitado y Cloudflare lo declara solo para desarrollo)
- [ ] **R2 → Manage API tokens** → token *Object Read & Write* sobre `poligiros`
      → de ahí salen `ACCESS_KEY_ID` y `SECRET_ACCESS_KEY` (el secreto se muestra
      una sola vez)
- [ ] Completar en el `.env` de la raíz, **local y en `/opt/poligiros/.env`**:

```bash
CLOUDFLARE_R2_ACCOUNT_ID=645d6a349315f50fa50b31d73a15cb46
CLOUDFLARE_R2_BUCKET_NAME=poligiros
CLOUDFLARE_R2_PUBLIC_URL=https://archivospoligiros.flynnpedroa.engineer
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
```

- No hace falta tocar **CORS Policy**: los archivos se abren con link directo en
  pestaña nueva, no por `fetch`.

---

## 3. Decisiones pendientes

### 3.1 ¿El material es público o privado? (importante)

Hoy el bucket queda **público no listado**: cualquiera con la URL baja el archivo
sin estar logueado. No se puede listar el bucket y las keys llevan timestamp +
slug, así que no son adivinables — pero si un alumno comparte el link, el PDF
queda accesible para siempre, aunque después le saques el acceso a la plataforma.

Alternativa: bucket **privado** + URLs firmadas de corta duración generadas por la
API, verificando que el coach esté logueado y que el módulo esté liberado para su
CIC. Es más fiel a todo el esquema de liberación por cohorte que ya armamos.

- [ ] Decidir. Si es material genérico (consignas, bibliografía pública) → público
      y listo. Si es el material propio de Gaby que **es** el valor del curso →
      firmadas.
- [ ] Si va firmadas: guardar solo la key en `ModuleLink`, endpoint que firme al
      vuelo, y el front pide la URL al hacer clic.

### 3.2 ¿Se borra `SETUP.md`?

Lo restauré porque contiene el runbook de deploy (Parte 6) y tanto `CLAUDE.md`
como `README.md` apuntan ahí. Pero vos lo tenías borrado en el working tree, junto
con `TASK3-CONTRACT.md` y `TODOS.md`.

- [ ] Confirmar si querés `SETUP.md` o lo borramos y sacamos las referencias

---

## 4. Seguridad / higiene

- [ ] **Cambiar la contraseña de Gaby** si corriste el comando que te pasé con
      `--password 'UnaClaveLarga123'`. Esa cadena quedó en tu historial de shell y
      en la transcripción del chat. Fue error mío haberla puesto en un comando
      copiable. Se cambia con: editar `SUPERVISOR_PASSWORD` en el `.env` del
      servidor → `make prod-supervisor` → `make prod-restart`.
- [ ] **GitGuardian**: marcar la alerta como falso positivo. Verificado que ningún
      valor real del `.env` está en la historia de git (`POSTGRES_PASSWORD`,
      `JWT_SECRET`, `OPENAI_API_KEY`, `CLOUDFLARE_TUNNEL_TOKEN` — todos limpios;
      nunca se trackeó ningún `.env`). Lo que disparó la alerta fue una línea de
      ejemplo que escribí yo en `SETUP.md` con un email real al lado de una
      contraseña literal. Ya está corregido, pero **sigue en el tip de `main`
      hasta que se pushee** el fix (ver 1.3).
- [ ] `seed.ts` tiene defaults débiles (`supervisor123` / `coach123`). Solo se
      alcanzan por el seed destructivo, que ahora exige `CONFIRM=WIPE`. Igual no
      dejarlo correr nunca contra prod.

---

## 5. Deuda técnica

- [ ] **`frontend/package.json` línea 32** tiene `"poligiros": "file:.."`, una
      autorreferencia muerta a la raíz del repo (que no tiene `package.json`).
      Nada la importa. La saqué del backend; falta el frontend. Ojo: hay que
      sincronizar el lock con `npm install --package-lock-only` para no romper el
      build de Cloudflare Pages.
- [ ] **Bundle de 811 KB** (238 KB gzip), arriba del warning de 500 KB. Subió
      ~165 KB al agregar `react-markdown`. Se arregla con code-splitting por ruta
      (`React.lazy` en `App.tsx`).
- [ ] **Coaches sin CIC quedan sin permisos**: con el modelo nuevo, los permisos
      salen de las inscripciones. Un coach sin ninguna queda sin acceso a nada, en
      silencio. Marcar en rojo los "Sin CIC" en la pantalla de Alumnos.
- [ ] Revisar si quedan más `if (!res.ok)` muertos por el bug de `apiRaw` (lanza
      excepción en no-2xx). Los 6 usos restantes son deletes fire-and-forget sin
      chequeo, así que están bien — pero conviene tenerlo presente al escribir
      código nuevo: usar `apiTry`.

---

## 6. Ideas / mejoras

- [ ] **Importador del Trello**: nunca llegó el JSON (solo capturas). Con el export
      se puede escribir un script que cree módulos + tarjetas + links de una.
- [ ] Notificar por email a los inscriptos cuando se libera una clase nueva.
- [ ] Que el alumno vea qué clases faltan liberar ("Clase 4 — se habilita el X").
      El dato ya existe: `ModuleRelease.availableFrom`.
