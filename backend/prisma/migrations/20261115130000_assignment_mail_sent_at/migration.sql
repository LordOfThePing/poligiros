-- Timestamp del último envío exitoso del mail al coachee con el magic link
-- (asignación o reenvío), para mostrarlo en la UI del coach.
ALTER TABLE "TestAssignment" ADD COLUMN "mailSentAt" TIMESTAMP(3);
