-- Rollback (forward-fix): DROP TRIGGER "entries_card_same_owner_trg" ON "entries"; DROP TRIGGER "cards_owner_immutable_trg" ON "cards";
--   DROP FUNCTION entries_card_same_owner(); DROP FUNCTION cards_owner_immutable();
--   DROP INDEX "cards_owner_name_key_uq"; CREATE UNIQUE INDEX "cards_name_key_uq" ON "cards"("name_key") (falha se houver nomes repetidos entre donos);
--   recriar os índices antigos de "entries" sem "user_id"; ALTER TABLE "cards"/"entries" DROP COLUMN "user_id".

-- 1. Coluna do dono, ainda anulável para o backfill.
ALTER TABLE "cards" ADD COLUMN "user_id" UUID;
ALTER TABLE "entries" ADD COLUMN "user_id" UUID;

-- 2. Marcador do primeiro administrador, só se houver dados legados (ADR 0005 7.3, T12). Nasce na data do dado mais
--    antigo (nunca no futuro de um relógio de aplicação atrasado, o que violaria updated_at >= created_at). Sem segredo: o administrador
--    real o assume no boot (BootstrapFirstAdmin), MANTENDO o id, então nenhum dado financeiro é reescrito depois.
INSERT INTO "users" ("id", "name", "email", "password_hash", "kind", "role", "status", "must_change_password", "created_at", "updated_at")
SELECT '01900000-0000-7000-8000-0000000000a1', 'Administrador', 'first-admin@finance.invalid', NULL,
       'PENDING_FIRST_ADMIN', 'ADMIN', 'ACTIVE', true,
       LEAST((SELECT min("created_at") FROM "cards"), (SELECT min("created_at") FROM "entries"), now()),
       LEAST((SELECT min("created_at") FROM "cards"), (SELECT min("created_at") FROM "entries"), now())
WHERE EXISTS (SELECT 1 FROM "cards") OR EXISTS (SELECT 1 FROM "entries")
ON CONFLICT ("id") DO NOTHING;

-- 3. Backfill: tudo que existe hoje pertence ao primeiro administrador (nunca à demo).
UPDATE "cards" SET "user_id" = '01900000-0000-7000-8000-0000000000a1' WHERE "user_id" IS NULL;
UPDATE "entries" SET "user_id" = '01900000-0000-7000-8000-0000000000a1' WHERE "user_id" IS NULL;

-- 4. Dono obrigatório e FKs.
ALTER TABLE "cards" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "entries" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 5. Nome do cartão único por dono (CA32).
DROP INDEX "cards_name_key_uq";
CREATE UNIQUE INDEX "cards_owner_name_key_uq" ON "cards"("user_id", "name_key");

-- 6. Índices de entries com o dono como prefixo (RNF07).
DROP INDEX "entries_month_type_date_idx";
DROP INDEX "entries_month_type_status_idx";
DROP INDEX "entries_category_key_created_idx";
CREATE INDEX "entries_owner_month_type_date_idx" ON "entries"("user_id", "reference_month", "type", "date", "created_at", "id");
CREATE INDEX "entries_owner_month_type_status_idx" ON "entries"("user_id", "reference_month", "type", "status");
CREATE INDEX "entries_owner_category_key_created_idx" ON "entries"("user_id", "category_key", "created_at", "id");

-- 7. Mesmo dono entre lançamento e cartão, e dono imutável (D6): a FK composta com relação opcional não é expressável no Prisma.
CREATE FUNCTION entries_card_same_owner() RETURNS trigger AS $$
BEGIN
  -- Cartão inexistente fica para a FK (23503); aqui só o cartão de OUTRO dono.
  IF NEW."card_id" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "cards" WHERE "id" = NEW."card_id" AND "user_id" <> NEW."user_id"
  ) THEN
    RAISE EXCEPTION 'Lançamento e cartão devem ter o mesmo dono' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "entries_card_same_owner_trg"
  BEFORE INSERT OR UPDATE OF "card_id", "user_id" ON "entries"
  FOR EACH ROW EXECUTE FUNCTION entries_card_same_owner();

CREATE FUNCTION cards_owner_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."user_id" IS DISTINCT FROM OLD."user_id" THEN
    RAISE EXCEPTION 'O dono de um cartão não pode ser alterado' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cards_owner_immutable_trg"
  BEFORE UPDATE OF "user_id" ON "cards"
  FOR EACH ROW EXECUTE FUNCTION cards_owner_immutable();

-- O dono de um lançamento também é imutável.
CREATE FUNCTION entries_owner_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."user_id" IS DISTINCT FROM OLD."user_id" THEN
    RAISE EXCEPTION 'O dono de um lançamento não pode ser alterado' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "entries_owner_immutable_trg"
  BEFORE UPDATE OF "user_id" ON "entries"
  FOR EACH ROW EXECUTE FUNCTION entries_owner_immutable();
