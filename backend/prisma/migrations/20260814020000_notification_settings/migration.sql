-- Per-event switches for the supervisor notification emails. All default to
-- true so existing behaviour is unchanged until she turns something off.

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "notifySignupRequest" BOOLEAN NOT NULL DEFAULT true,
                          ADD COLUMN     "notifySupervisionRequest" BOOLEAN NOT NULL DEFAULT true,
                          ADD COLUMN     "notifySubmission" BOOLEAN NOT NULL DEFAULT true,
                          ADD COLUMN     "notifySessionRecorded" BOOLEAN NOT NULL DEFAULT true;
