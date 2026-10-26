-- Rollback (forward-fix): DROP TABLE "entries"; DROP TYPE "entry_status", "payment_method", "entry_type";

-- CreateEnum
CREATE TYPE "entry_type" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('PIX', 'CARD');

-- CreateEnum
CREATE TYPE "entry_status" AS ENUM ('PENDING', 'PAID', 'RECEIVED');

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "type" "entry_type" NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "category_key" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "card_id" UUID,
    "closing_date" DATE,
    "due_date" DATE,
    "reference_month" DATE NOT NULL,
    "status" "entry_status" NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entries_month_type_date_idx" ON "entries"("reference_month", "type", "date", "created_at", "id");

-- CreateIndex
CREATE INDEX "entries_month_type_status_idx" ON "entries"("reference_month", "type", "status");

-- CreateIndex
CREATE INDEX "entries_card_month_status_idx" ON "entries"("card_id", "reference_month", "status");

-- CreateIndex
CREATE INDEX "entries_category_key_created_idx" ON "entries"("category_key", "created_at", "id");

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Constraints adicionais (ADR 0001, 7.4): defesa em profundidade das invariantes de Entry.
-- Não reimplementam o dia efetivo nem "mesmo mês x mês seguinte" (isso é só de calculateInvoiceDates).

-- valores e timestamps
ALTER TABLE "entries" ADD CONSTRAINT "entries_amount_positive_chk" CHECK ("amount" > 0);
ALTER TABLE "entries" ADD CONSTRAINT "entries_updated_after_created_chk" CHECK ("updated_at" >= "created_at");

-- status
ALTER TABLE "entries" ADD CONSTRAINT "entries_paid_consistency_chk"
  CHECK (("status" = 'PAID') = ("paid_at" IS NOT NULL));
ALTER TABLE "entries" ADD CONSTRAINT "entries_paid_after_created_chk"
  CHECK ("paid_at" IS NULL OR "paid_at" >= "created_at");
ALTER TABLE "entries" ADD CONSTRAINT "entries_type_status_chk"
  CHECK (("type" = 'INCOME' AND "status" = 'RECEIVED')
      OR ("type" = 'EXPENSE' AND "status" IN ('PENDING', 'PAID')));

-- forma de pagamento x cartão x datas da fatura
ALTER TABLE "entries" ADD CONSTRAINT "entries_income_pix_chk"
  CHECK ("type" = 'EXPENSE' OR "payment_method" = 'PIX');
ALTER TABLE "entries" ADD CONSTRAINT "entries_method_card_chk"
  CHECK (("payment_method" = 'CARD') = ("card_id" IS NOT NULL)
     AND ("payment_method" = 'CARD') = ("closing_date" IS NOT NULL)
     AND ("payment_method" = 'CARD') = ("due_date" IS NOT NULL));
ALTER TABLE "entries" ADD CONSTRAINT "entries_invoice_dates_order_chk"
  CHECK ("closing_date" IS NULL OR (
         "closing_date" >= "date"
     AND "closing_date" <  (date_trunc('month', "date") + interval '2 month')::date
     AND "due_date"     >  "closing_date"
     AND "due_date"     <  (date_trunc('month', "closing_date") + interval '2 month')::date));

-- mês de referência
ALTER TABLE "entries" ADD CONSTRAINT "entries_ref_month_first_day_chk"
  CHECK (EXTRACT(DAY FROM "reference_month") = 1);
ALTER TABLE "entries" ADD CONSTRAINT "entries_ref_month_rule_chk"
  CHECK (("payment_method" = 'PIX'  AND "reference_month" = date_trunc('month', "date")::date)
      OR ("payment_method" = 'CARD' AND "reference_month" = date_trunc('month', "due_date")::date));
