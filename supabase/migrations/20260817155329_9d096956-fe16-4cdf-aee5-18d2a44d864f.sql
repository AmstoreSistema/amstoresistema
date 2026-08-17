
-- Add client_id to transactions table if it doesn't exist
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Backfill client_id from sales
UPDATE public.transactions t
SET client_id = s.client_id
FROM public.sales s
WHERE t.sale_id = s.id AND t.client_id IS NULL;

-- Add a trigger to automatically set client_id on insert if sale_id is present
CREATE OR REPLACE FUNCTION public.sync_transaction_client_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.sale_id IS NOT NULL THEN
    SELECT client_id INTO NEW.client_id FROM public.sales WHERE id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_transaction_client_id ON public.transactions;
CREATE TRIGGER tr_sync_transaction_client_id
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_client_id();

-- Re-grant permissions (though already exist, just to be sure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
