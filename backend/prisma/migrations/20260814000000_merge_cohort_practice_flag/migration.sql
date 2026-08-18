-- clientsEnabled + testsEnabled collapse into one permission. Loading a coachee
-- and testing them are the same capability in practice, and keeping them apart
-- only allowed a state where a coach could add a coachee and then get a 403.

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN "practiceEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Conservative carry-over: only cohorts that already had BOTH keep the
-- permission, so nobody is granted something they did not have before.
UPDATE "Cohort" SET "practiceEnabled" = ("clientsEnabled" AND "testsEnabled");

-- AlterTable
ALTER TABLE "Cohort" DROP COLUMN "clientsEnabled",
                     DROP COLUMN "testsEnabled";
