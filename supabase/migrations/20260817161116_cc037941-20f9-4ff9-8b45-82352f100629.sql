-- Trigger function to standardize transaction descriptions
CREATE OR REPLACE FUNCTION public.tr_standardize_transaction_description()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_code TEXT;
    v_installment_number INT;
    v_installments_count INT;
    v_is_installment_payment BOOLEAN := false;
BEGIN
    -- Only act on income transactions with a sale_id
    IF (NEW.type = 'income' OR NEW.type = 'entrada') AND NEW.sale_id IS NOT NULL THEN
        
        -- Try to find if this transaction is linked to a specific installment via its description or metadata
        
        SELECT sale_code, installments_count 
        INTO v_sale_code, v_installments_count
        FROM public.sales 
        WHERE id = NEW.sale_id;
        
        -- Check if this specific transaction corresponds to a payment registered via pay_sale_installment
        -- The registerSalePayment function and processBulkPayment insert specific descriptions
        -- that look like: 'Pagamento [N]ª Parcela Venda #[CODE]'
        
        IF NEW.description ~ '^Pagamento [0-9]+ª Parcela Venda #' THEN
            v_installment_number := (substring(NEW.description from 'Pagamento ([0-9]+)ª Parcela'))::INT;
            v_is_installment_payment := true;
        END IF;
        
        IF v_is_installment_payment AND v_installment_number IS NOT NULL AND v_sale_code IS NOT NULL THEN
            -- Apply standard: Parcial [N]/[Total] • V[CODE]
            -- Use the last 6 chars of sale_code as abbreviation
            NEW.description := 'Parcial ' || v_installment_number || '/' || COALESCE(v_installments_count, 1) || 
                               ' • V' || right(v_sale_code, 6);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to transactions table
DROP TRIGGER IF EXISTS tr_standardize_transaction_description_trigger ON public.transactions;
CREATE TRIGGER tr_standardize_transaction_description_trigger
BEFORE INSERT OR UPDATE OF description ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.tr_standardize_transaction_description();

-- Update existing descriptions that match the old pattern to the new pattern
DO $$
DECLARE
    r RECORD;
    v_sale_code TEXT;
    v_installments_count INT;
    v_inst_num INT;
BEGIN
    FOR r IN SELECT id, description, sale_id FROM public.transactions 
             WHERE description ~ '^Pagamento [0-9]+ª Parcela Venda #'
    LOOP
        SELECT sale_code, installments_count INTO v_sale_code, v_installments_count 
        FROM public.sales WHERE id = r.sale_id;
        
        IF v_sale_code IS NOT NULL THEN
            v_inst_num := (substring(r.description from 'Pagamento ([0-9]+)ª Parcela'))::INT;
            
            UPDATE public.transactions 
            SET description = 'Parcial ' || v_inst_num || '/' || COALESCE(v_installments_count, 1) || 
                              ' • V' || right(v_sale_code, 6)
            WHERE id = r.id;
        END IF;
    END LOOP;
END $$;
