-- AlterTable
ALTER TABLE "SignupLink" ADD COLUMN     "poolId" TEXT;

-- AlterTable
ALTER TABLE "SignupRequest" ADD COLUMN     "poolId" TEXT;

-- CreateTable
CREATE TABLE "CoachPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledTests" "TestType"[] DEFAULT ARRAY[]::"TestType"[],

    CONSTRAINT "CoachPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolMembership_userId_poolId_key" ON "PoolMembership"("userId", "poolId");

-- AddForeignKey
ALTER TABLE "PoolMembership" ADD CONSTRAINT "PoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMembership" ADD CONSTRAINT "PoolMembership_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CoachPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CoachPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupLink" ADD CONSTRAINT "SignupLink_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CoachPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
