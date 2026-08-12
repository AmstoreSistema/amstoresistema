-- 1. Create Financial Accounts Table
CREATE TABLE public.financial_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('caixa', 'banco', 'carteira', 'outro')),
    initial_balance decimal NOT NULL DEFAULT 0,
    current_balance decimal NOT NULL DEFAULT 0,
    color text DEFAULT '#3B82F6',
    bank_name text,
    agency text,
    account_number text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by_id uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users" ON public.financial_accounts 
FOR ALL TO authenticated USING (true);

-- 2. Add columns to Transactions to link to Accounts
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.financial_accounts(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pago' CHECK (status IN ('pago', 'pendente', 'cancelado'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS purchase_id uuid; 
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Function to update balance atomically
CREATE OR REPLACE FUNCTION public.handle_transaction_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if status is 'pago'
    IF (TG_OP = 'INSERT' AND NEW.status = 'pago') THEN
        IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
            UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
            UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle status change to 'pago'
        IF (OLD.status != 'pago' AND NEW.status = 'pago') THEN
            IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
            ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
            END IF;
        -- Handle status change FROM 'pago' to something else (e.g., 'cancelado')
        ELSIF (OLD.status = 'pago' AND NEW.status != 'pago') THEN
            IF (OLD.type = 'entrada' OR OLD.type = 'income') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF (OLD.type = 'saida' OR OLD.type = 'expense') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER transaction_balance_trigger
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_balance();

-- 4. Transfer RPC
CREATE OR REPLACE FUNCTION public.transfer_between_accounts(
    p_origin_id uuid,
    p_dest_id uuid,
    p_amount decimal,
    p_description text,
    p_date timestamptz
)
RETURNS void AS $$
BEGIN
    -- Withdraw from origin
    INSERT INTO public.transactions (account_id, amount, type, description, status, created_at)
    VALUES (p_origin_id, p_amount, 'saida', 'Transferência (Saída): ' || p_description, 'pago', p_date);
    
    -- Deposit to destination
    INSERT INTO public.transactions (account_id, amount, type, description, status, created_at)
    VALUES (p_dest_id, p_amount, 'entrada', 'Transferência (Entrada): ' || p_description, 'pago', p_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
