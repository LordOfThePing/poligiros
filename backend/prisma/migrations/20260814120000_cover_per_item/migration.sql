-- Per-item covers: the cover belongs to each card, not the module.
-- Drop the module-level columns (the per-module cover was a placeholder that
-- never shipped in production with data; any existing value is dropped).
ALTER TABLE "Module" DROP COLUMN "coverImageKey",
                     DROP COLUMN "coverImageUrl";

-- AlterTable
ALTER TABLE "ModuleItem" ADD COLUMN "coverImageKey" TEXT,
                         ADD COLUMN "coverImageUrl" TEXT;
