-- Move the coachee profile (age/sex/works/position) off per-SessionRecord onto
-- the Client. Values are nullable so existing coachees stay as-is; the UI
-- pre-fills them from the first session that has them, going forward.
ALTER TABLE "Client" ADD COLUMN "age" TEXT;
ALTER TABLE "Client" ADD COLUMN "sex" TEXT;
ALTER TABLE "Client" ADD COLUMN "works" BOOLEAN;
ALTER TABLE "Client" ADD COLUMN "position" TEXT;

-- Backfill from the most recent SessionRecord each Client has, so existing
-- coachees already have their profile pre-filled next time the coach records
-- a session.
UPDATE "Client" c
SET
  "age"      = s."coacheeAge",
  "sex"      = s."coacheeSex",
  "works"    = s."coacheeWorks",
  "position" = s."coacheePosition"
FROM (
  SELECT DISTINCT ON ("clientId")
    "clientId",
    "coacheeAge",
    "coacheeSex",
    "coacheeWorks",
    "coacheePosition"
  FROM "SessionRecord"
  ORDER BY "clientId", "createdAt" DESC
) AS s
WHERE c.id = s."clientId";
