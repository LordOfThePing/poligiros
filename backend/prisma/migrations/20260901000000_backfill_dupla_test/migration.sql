-- DUPLA/REGISTRO cards used to be implicitly about Anclas de Carrera (the only
-- test the "ver anclas de mi dupla" flow supported). Now `testId` on those
-- kinds says which test's result to show, so backfill the existing cards to
-- keep them pointing at Anclas.
UPDATE "ModuleItem" AS mi
SET "testId" = t.id
FROM "Test" AS t
WHERE mi.kind IN ('DUPLA', 'REGISTRO')
  AND mi."testId" IS NULL
  AND t.type = 'ANCLAS_CARRERA';
