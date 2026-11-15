-- ADR 0013 / T5, T9: demo_datasets vira owner_data_resets (controle da redefinição de dados por dono).
-- Rollback (forward-fix): reverter renomes e NOT NULL; dados são regeráveis pelo seed.
ALTER TABLE "demo_datasets" RENAME TO "owner_data_resets";
ALTER TABLE "owner_data_resets" RENAME CONSTRAINT "demo_datasets_pkey" TO "owner_data_resets_pkey";
ALTER TABLE "owner_data_resets" RENAME COLUMN "refreshed_at" TO "last_reset_at";
ALTER TABLE "owner_data_resets" ALTER COLUMN "anchor_month" DROP NOT NULL;
ALTER TABLE "owner_data_resets" ALTER COLUMN "template_version" DROP NOT NULL;
ALTER TABLE "owner_data_resets" ADD CONSTRAINT "owner_data_resets_sample_chk"
  CHECK (("anchor_month" IS NULL) = ("template_version" IS NULL));
DELETE FROM "owner_data_resets" r WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."owner_id");
ALTER TABLE "owner_data_resets" ADD CONSTRAINT "owner_data_resets_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
