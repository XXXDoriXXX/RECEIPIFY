-- CreateIndex
CREATE INDEX "receipts_user_id_status_idx" ON "receipts"("user_id", "status");

-- CreateIndex
CREATE INDEX "receipts_user_id_total_amount_idx" ON "receipts"("user_id", "total_amount");
