-- Recria CHECKs que usavam date_trunc sobre DATE (cast implícito para timestamptz, dependente de TimeZone da sessão).
-- Com "date"::timestamp o resultado não depende do fuso.
-- Rollback (forward-fix): recriar os CHECKs com date_trunc('month', "date").

ALTER TABLE "entries" DROP CONSTRAINT "entries_invoice_dates_order_chk";
ALTER TABLE "entries" ADD CONSTRAINT "entries_invoice_dates_order_chk"
  CHECK ("closing_date" IS NULL OR (
         "closing_date" >= "date"
     AND "closing_date" <  (date_trunc('month', "date"::timestamp) + interval '2 month')::date
     AND "due_date"     >  "closing_date"
     AND "due_date"     <  (date_trunc('month', "closing_date"::timestamp) + interval '2 month')::date));

ALTER TABLE "entries" DROP CONSTRAINT "entries_ref_month_rule_chk";
ALTER TABLE "entries" ADD CONSTRAINT "entries_ref_month_rule_chk"
  CHECK (("payment_method" = 'PIX'  AND "reference_month" = date_trunc('month', "date"::timestamp)::date)
      OR ("payment_method" = 'CARD' AND "reference_month" = date_trunc('month', "due_date"::timestamp)::date));
