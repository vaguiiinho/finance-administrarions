-- ADR 0013 / RF05: exclusão única e definitiva do usuário da demonstração pública e dos dados dele.
-- Idempotente: todos os comandos filtram pelo id literal; num banco sem esse usuário não alteram nada.
-- O CHECK é recriado (DROP IF EXISTS + ADD), então o script inteiro pode ser executado de novo.
-- Rollback: forward-fix (dados regeráveis, sem valor de negócio). Backup antes do deploy (P05).
DO $$
DECLARE s int; e int; c int; d int; u int;
BEGIN
  DELETE FROM "sessions"      WHERE "user_id"  = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS s = ROW_COUNT;
  DELETE FROM "entries"       WHERE "user_id"  = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS e = ROW_COUNT;
  DELETE FROM "cards"         WHERE "user_id"  = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS c = ROW_COUNT;
  DELETE FROM "demo_datasets" WHERE "owner_id" = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS d = ROW_COUNT;
  DELETE FROM "users"         WHERE "id"       = '01900000-0000-7000-8000-0000000000d1'; GET DIAGNOSTICS u = ROW_COUNT;
  RAISE NOTICE 'demo publica removida: sessoes=%, lancamentos=%, cartoes=%, demo_datasets=%, usuarios=%', s, e, c, d, u;
END $$;

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_demo_chk";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_kind_not_demo_chk";
ALTER TABLE "users" ADD CONSTRAINT "users_kind_not_demo_chk" CHECK ("kind" <> 'DEMO');
