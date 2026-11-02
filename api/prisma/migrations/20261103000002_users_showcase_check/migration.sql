-- ADR 0011 7.2 (2/2): invariantes da conta de demonstração (espelham User.restore).
-- Rollback (forward-fix): ALTER TABLE "users" DROP CONSTRAINT "users_showcase_chk";
-- O valor 'SHOWCASE' do enum não é removível sem recriar o tipo; fica inofensivo.
ALTER TABLE "users" ADD CONSTRAINT "users_showcase_chk" CHECK (
  "kind" <> 'SHOWCASE' OR (
    "id" = '01900000-0000-7000-8000-0000000000d2'
    AND "email" = 'demo@showcase.invalid'
    AND "password_hash" IS NOT NULL
    AND "role" = 'USER'
    AND "must_change_password" = false));
