-- A module card can BE a test the coach has to take. Releasing the module to a
-- cohort is what makes it available; there is no separate per-test release.
--
-- Note on the enum: Postgres forbids USING a value added by ALTER TYPE inside
-- the same transaction that added it. Nothing below references 'TEST' — the
-- column added is a TEXT foreign key — so this is safe in one migration.

-- AlterEnum
ALTER TYPE "ModuleItemKind" ADD VALUE 'TEST';

-- AlterTable
ALTER TABLE "ModuleItem" ADD COLUMN "testId" TEXT;

-- AddForeignKey
ALTER TABLE "ModuleItem" ADD CONSTRAINT "ModuleItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;
