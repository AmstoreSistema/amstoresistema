-- Tabela de notificações internas
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'fiado_vencendo', 'fiado_atrasado')),
    is_read BOOLEAN DEFAULT false,
    reference_id UUID,
    reference_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e Permissões
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated users' AND tablename = 'notifications') THEN
        CREATE POLICY "Allow all for authenticated users" ON public.notifications FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Função para gerar alertas de fiado
CREATE OR REPLACE FUNCTION public.check_sale_installments_alerts()
RETURNS void AS $$
DECLARE
    v_inst RECORD;
BEGIN
    -- Alertas para parcelas vencendo nos próximos 3 dias
    FOR v_inst IN 
        SELECT 
            si.id, 
            si.due_date, 
            si.amount, 
            c.name as client_name,
            s.id as sale_id
        FROM public.sale_installments si
        JOIN public.sales s ON si.sale_id = s.id
        JOIN public.clients c ON s.client_id = c.id
        WHERE si.status IN ('pending', 'partial')
          AND si.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications 
              WHERE reference_id = si.id 
                AND type = 'fiado_vencendo' 
                AND created_at > CURRENT_DATE
          )
    LOOP
        INSERT INTO public.notifications (title, message, type, reference_id, reference_type)
        VALUES (
            'Parcela Vencendo',
            'A parcela de ' || v_inst.client_name || ' no valor de ' || v_inst.amount || ' vence em ' || to_char(v_inst.due_date, 'DD/MM'),
            'fiado_vencendo',
            v_inst.id,
            'sale_installments'
        );
    END LOOP;

    -- Alertas para parcelas atrasadas
    FOR v_inst IN 
        SELECT 
            si.id, 
            si.due_date, 
            si.amount, 
            c.name as client_name,
            s.id as sale_id
        FROM public.sale_installments si
        JOIN public.sales s ON si.sale_id = s.id
        JOIN public.clients c ON s.client_id = c.id
        WHERE si.status IN ('pending', 'partial', 'overdue')
          AND si.due_date < CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications 
              WHERE reference_id = si.id 
                AND type = 'fiado_atrasado'
                AND is_read = false
          )
    LOOP
        INSERT INTO public.notifications (title, message, type, reference_id, reference_type)
        VALUES (
            'Parcela ATRASADA',
            'A parcela de ' || v_inst.client_name || ' no valor de ' || v_inst.amount || ' está vencida desde ' || to_char(v_inst.due_date, 'DD/MM'),
            'fiado_atrasado',
            v_inst.id,
            'sale_installments'
        );
        
        -- Atualizar status da parcela para overdue
        UPDATE public.sale_installments SET status = 'overdue' WHERE id = v_inst.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;