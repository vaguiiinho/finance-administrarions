-- Rollback (forward-fix): DROP TABLE "demo_datasets"; DROP TABLE "sessions"; DROP TABLE "users"; DROP TYPE "user_status", "user_role", "user_kind";

-- CreateEnum
CREATE TYPE "user_kind" AS ENUM ('REGULAR', 'DEMO', 'PENDING_FIRST_ADMIN');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255),
    "kind" "user_kind" NOT NULL DEFAULT 'REGULAR',
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_digest" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_datasets" (
    "owner_id" UUID NOT NULL,
    "anchor_month" DATE NOT NULL,
    "template_version" INTEGER NOT NULL,
    "refreshed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demo_datasets_pkey" PRIMARY KEY ("owner_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_uq" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_digest_uq" ON "sessions"("token_digest");

-- CreateIndex
CREATE INDEX "sessions_user_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Constraints adicionais (ADR 0005 7.3): defesa em profundidade das invariantes de User e Session.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lower_chk" CHECK ("email" = lower("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_updated_after_created_chk" CHECK ("updated_at" >= "created_at");
ALTER TABLE "users" ADD CONSTRAINT "users_regular_hash_chk" CHECK ("kind" <> 'REGULAR' OR "password_hash" IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "users_demo_chk" CHECK ("kind" <> 'DEMO' OR ("password_hash" IS NULL AND "role" = 'USER'));
ALTER TABLE "users" ADD CONSTRAINT "users_pending_first_admin_chk"
  CHECK ("kind" <> 'PENDING_FIRST_ADMIN' OR ("password_hash" IS NULL AND "id" = '01900000-0000-7000-8000-0000000000a1'));
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expires_after_created_chk" CHECK ("expires_at" > "created_at");
