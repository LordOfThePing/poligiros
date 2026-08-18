-- Per-cohort module releases, two-level module content (cards -> links) and
-- public self-signup.
--
-- Nothing is uploaded or stored by this app any more: the old flat `Material`
-- table (which held R2 file URLs) is replaced by ModuleItem + ModuleLink, where
-- every resource is just a link to Drive / Docs / Zoom / an article.

-- CreateEnum
CREATE TYPE "ModuleItemKind" AS ENUM ('TAREA', 'BIBLIOGRAFIA', 'PRESENTACION', 'LINK', 'RECURSO');

-- CreateEnum
CREATE TYPE "SignupStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "zoomUrl" TEXT,
                     ADD COLUMN     "clientsEnabled" BOOLEAN NOT NULL DEFAULT false,
                     ADD COLUMN     "testsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ModuleItem" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ModuleItemKind" NOT NULL DEFAULT 'RECURSO',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleLink" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleRelease" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "availableFrom" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "especialidad" TEXT,
    "motivation" TEXT,
    "cohortId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "SignupStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "SignupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleRelease_moduleId_cohortId_key" ON "ModuleRelease"("moduleId", "cohortId");

-- CreateIndex
CREATE INDEX "SignupRequest_status_idx" ON "SignupRequest"("status");

-- AddForeignKey
ALTER TABLE "ModuleItem" ADD CONSTRAINT "ModuleItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLink" ADD CONSTRAINT "ModuleLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ModuleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleRelease" ADD CONSTRAINT "ModuleRelease_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleRelease" ADD CONSTRAINT "ModuleRelease_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry any existing Material rows over as a card holding a single link.
-- `kind` is left to its column DEFAULT on purpose, so this statement never has
-- to name a value of the enum type created earlier in this same transaction.
DO $$
DECLARE r RECORD; new_item_id TEXT;
BEGIN
  FOR r IN SELECT * FROM "Material" LOOP
    new_item_id := gen_random_uuid()::text;
    INSERT INTO "ModuleItem" ("id", "moduleId", "title", "orderIndex")
      VALUES (new_item_id, r."moduleId", r."title", 0);
    INSERT INTO "ModuleLink" ("id", "itemId", "title", "url", "orderIndex")
      VALUES (gen_random_uuid()::text, new_item_id, r."title", r."fileUrl", 0);
  END LOOP;
END $$;

-- DropTable
DROP TABLE "Material";
