-- Migration: Add IAP Transactions Table
CREATE TABLE IF NOT EXISTS public.iap_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    product_id TEXT NOT NULL,
    receipt_data TEXT NOT NULL,
    apple_status INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own transactions" 
ON public.iap_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_iap_transactions_updated_at
    BEFORE UPDATE ON public.iap_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
