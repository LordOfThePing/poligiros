-- Practice sessions between two coaches of the same CIC, written up inside a
-- module card (kind = REGISTRO).
--
-- Not reusing SessionRecord on purpose: that one hangs off a Client, which would
-- force the cohort's practiceEnabled open just so coaches can practise on each
-- other inside a class.
--
-- Nothing below references the new enum value, so adding it here is safe (a
-- value added by ALTER TYPE cannot be USED in the same transaction).

-- AlterEnum
ALTER TYPE "ModuleItemKind" ADD VALUE 'REGISTRO';

-- CreateTable
CREATE TABLE "PracticeRecord" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "coacheeId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3),
    "mainOutputs" TEXT NOT NULL,
    "toolsAndResults" TEXT NOT NULL,
    "conclusions" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "feedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "PracticeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeRecord_itemId_coachId_key" ON "PracticeRecord"("itemId", "coachId");

-- CreateIndex
CREATE INDEX "PracticeRecord_reviewedAt_idx" ON "PracticeRecord"("reviewedAt");

-- CreateIndex
CREATE INDEX "PracticeRecord_coacheeId_idx" ON "PracticeRecord"("coacheeId");

-- AddForeignKey
ALTER TABLE "PracticeRecord" ADD CONSTRAINT "PracticeRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ModuleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRecord" ADD CONSTRAINT "PracticeRecord_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRecord" ADD CONSTRAINT "PracticeRecord_coacheeId_fkey" FOREIGN KEY ("coacheeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRecord" ADD CONSTRAINT "PracticeRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
