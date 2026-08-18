-- Configurable link lifetimes + expiring public signup links.

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "testCompleteDays" INTEGER NOT NULL DEFAULT 14,
    "testResultsDays" INTEGER NOT NULL DEFAULT 365,
    "signupLinkDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cohortId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupLink_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SignupRequest" ADD COLUMN "signupLinkId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SignupLink_token_key" ON "SignupLink"("token");

-- AddForeignKey
ALTER TABLE "SignupLink" ADD CONSTRAINT "SignupLink_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_signupLinkId_fkey" FOREIGN KEY ("signupLinkId") REFERENCES "SignupLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton row so the app never has to special-case its absence.
INSERT INTO "AppSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP);
