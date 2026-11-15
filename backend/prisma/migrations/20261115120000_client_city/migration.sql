-- Ciudad del coachee (pedido por la supervisora 2026-11-14). Nullable para que
-- los coachees existentes queden como están; el coach la carga desde el alta
-- o el perfil del coachee.
ALTER TABLE "Client" ADD COLUMN "city" TEXT;
