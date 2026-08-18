-- Per-item completion inside a module.

-- CreateTable
CREATE TABLE "ModuleItemProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleItemProgress_userId_itemId_key" ON "ModuleItemProgress"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "ModuleItemProgress" ADD CONSTRAINT "ModuleItemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleItemProgress" ADD CONSTRAINT "ModuleItemProgress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ModuleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
