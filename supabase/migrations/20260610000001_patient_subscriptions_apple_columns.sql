-- Apple IAP columns for patient_subscriptions (safe if already present).

ALTER TABLE patient_subscriptions
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_product_id text;

CREATE INDEX IF NOT EXISTS idx_patient_subscriptions_apple_original_tx
  ON patient_subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
