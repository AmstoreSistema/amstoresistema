-- Update the trigger function to use the full sale_code instead of right(v_sale_code, 6)
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
        -- that look like: 'Pagamento [N]ª Parcela Venda #' or our new pattern
        
        IF NEW.description ~ '^Pagamento [0-9]+ª Parcela Venda #' THEN
            v_installment_number := (substring(NEW.description from 'Pagamento ([0-9]+)ª Parcela'))::INT;
            v_is_installment_payment := true;
        ELSIF NEW.description ~ '^Parcial [0-9]+/[0-9]+ • V' THEN
            v_installment_number := (substring(NEW.description from 'Parcial ([0-9]+)/'))::INT;
            v_is_installment_payment := true;
        END IF;
        
        IF v_is_installment_payment AND v_installment_number IS NOT NULL AND v_sale_code IS NOT NULL THEN
            -- Apply standard: Parcial [N]/[Total] • [FULL_CODE]
            -- The code already starts with 'V' usually (e.g., V698...)
            NEW.description := 'Parcial ' || v_installment_number || '/' || COALESCE(v_installments_count, 1) || 
                               ' • ' || v_sale_code;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing standardized descriptions to remove abbreviation
DO $$
DECLARE
    r RECORD;
    v_sale_code TEXT;
    v_installments_count INT;
    v_inst_num INT;
BEGIN
    FOR r IN SELECT id, description, sale_id FROM public.transactions 
             WHERE (description ~ '^Parcial [0-9]+/[0-9]+ • V' OR description ~ '^Pagamento [0-9]+ª Parcela Venda #')
             AND sale_id IS NOT NULL
    LOOP
        SELECT sale_code, installments_count INTO v_sale_code, v_installments_count 
        FROM public.sales WHERE id = r.sale_id;
        
        IF v_sale_code IS NOT NULL THEN
            -- Extract installment number from either pattern
            IF r.description ~ 'Parcial' THEN
                v_inst_num := (substring(r.description from 'Parcial ([0-9]+)/'))::INT;
            ELSE
                v_inst_num := (substring(r.description from 'Pagamento ([0-9]+)ª Parcela'))::INT;
            END IF;
            
            UPDATE public.transactions 
            SET description = 'Parcial ' || v_inst_num || '/' || COALESCE(v_installments_count, 1) || 
                              ' • ' || v_sale_code
            WHERE id = r.id;
        END IF;
    END LOOP;
END $$;