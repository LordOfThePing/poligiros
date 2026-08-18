-- Uploaded documents (R2) alongside plain external links on a module card.

-- AlterTable
ALTER TABLE "ModuleLink" ADD COLUMN     "storageKey" TEXT,
                         ADD COLUMN     "mimeType" TEXT,
                         ADD COLUMN     "sizeBytes" INTEGER;
