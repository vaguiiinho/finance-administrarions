-- Rollback (forward-fix): DROP TABLE "cards";

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "name_key" VARCHAR(100) NOT NULL,
    "closing_day" SMALLINT NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cards_name_key_uq" ON "cards"("name_key");

-- Constraints adicionais (ADR 0001, 7.4): defesa em profundidade das invariantes de Card
ALTER TABLE "cards" ADD CONSTRAINT "cards_closing_day_chk" CHECK ("closing_day" BETWEEN 1 AND 31);
ALTER TABLE "cards" ADD CONSTRAINT "cards_due_day_chk"     CHECK ("due_day" BETWEEN 1 AND 31);
ALTER TABLE "cards" ADD CONSTRAINT "cards_updated_after_created_chk" CHECK ("updated_at" >= "created_at");
