-- AlterTable
ALTER TABLE "Module" ADD COLUMN "coverImageKey" TEXT,
ADD COLUMN "coverImageUrl" TEXT;

-- CreateTable
CREATE TABLE "ModuleItemComment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageKey" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleItemComment_itemId_createdAt_idx" ON "ModuleItemComment"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "ModuleItemComment" ADD CONSTRAINT "ModuleItemComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ModuleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleItemComment" ADD CONSTRAINT "ModuleItemComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
