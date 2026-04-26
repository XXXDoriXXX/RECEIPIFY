-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "tax_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "confidence" REAL,
ADD COLUMN     "discount_amount" DECIMAL(12,2),
ADD COLUMN     "payment_method" VARCHAR(50),
ADD COLUMN     "subtotal_amount" DECIMAL(12,2),
ADD COLUMN     "tax_amount" DECIMAL(12,2);
