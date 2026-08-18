-- Cards that ask the coach to hand something in, with a written review by the
-- supervisor. Replaces "mandalo por mail", which left no record of who handed in
-- what, or when.
--
-- Nothing below references the new enum value, so adding it here is safe (a
-- value added by ALTER TYPE cannot be USED in the same transaction).

-- AlterEnum
ALTER TYPE "ModuleItemKind" ADD VALUE 'ENTREGA';

-- CreateTable
CREATE TABLE "ModuleItemSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "feedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "ModuleItemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleItemSubmission_userId_itemId_key" ON "ModuleItemSubmission"("userId", "itemId");

-- CreateIndex
CREATE INDEX "ModuleItemSubmission_reviewedAt_idx" ON "ModuleItemSubmission"("reviewedAt");

-- AddForeignKey
ALTER TABLE "ModuleItemSubmission" ADD CONSTRAINT "ModuleItemSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleItemSubmission" ADD CONSTRAINT "ModuleItemSubmission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ModuleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleItemSubmission" ADD CONSTRAINT "ModuleItemSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
