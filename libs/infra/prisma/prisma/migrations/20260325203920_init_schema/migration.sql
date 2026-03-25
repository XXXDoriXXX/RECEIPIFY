-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ReceiptSource" AS ENUM ('photo', 'manual');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "avatar_url" TEXT,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "country_code" CHAR(2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "merchant_id" UUID,
    "title" VARCHAR(200),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
    "purchase_date" DATE NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'pending',
    "source" "ReceiptSource" NOT NULL DEFAULT 'photo',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "ocr_status" "ReceiptStatus" NOT NULL DEFAULT 'pending',
    "ocr_raw_text" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "name" VARCHAR(80) NOT NULL,
    "color_hex" CHAR(7) NOT NULL,
    "icon_slug" VARCHAR(50),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" VARCHAR(40),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_normalized_name_key" ON "merchants"("normalized_name");

-- CreateIndex
CREATE INDEX "merchants_normalized_name_idx" ON "merchants"("normalized_name");

-- CreateIndex
CREATE INDEX "receipts_user_id_purchase_date_idx" ON "receipts"("user_id", "purchase_date" DESC);

-- CreateIndex
CREATE INDEX "receipts_user_id_deleted_at_idx" ON "receipts"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "receipts_merchant_id_idx" ON "receipts"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_images_storage_key_key" ON "receipt_images"("storage_key");

-- CreateIndex
CREATE INDEX "categories_user_id_is_system_idx" ON "categories"("user_id", "is_system");

-- CreateIndex
CREATE INDEX "expense_items_receipt_id_idx" ON "expense_items"("receipt_id");

-- CreateIndex
CREATE INDEX "expense_items_category_id_receipt_id_idx" ON "expense_items"("category_id", "receipt_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_images" ADD CONSTRAINT "receipt_images_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
