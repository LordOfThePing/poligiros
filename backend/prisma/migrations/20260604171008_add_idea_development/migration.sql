-- CreateTable
CREATE TABLE "IdeaDevelopment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" TEXT,
    "selectedIdea" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaDevelopment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdeaDevelopment_assignmentId_key" ON "IdeaDevelopment"("assignmentId");

-- AddForeignKey
ALTER TABLE "IdeaDevelopment" ADD CONSTRAINT "IdeaDevelopment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TestAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

