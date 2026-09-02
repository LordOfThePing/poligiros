-- AlterTable
ALTER TABLE "User" ADD COLUMN "linkedUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_linkedUserId_key" ON "User"("linkedUserId");
