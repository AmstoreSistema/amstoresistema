-- ==============================================================================
-- Migration: Corrigir URL e cabeçalhos do trigger de Push e RLS de device_tokens
-- Data: 2026-09-25 18:30:00 UTC
-- ==============================================================================

-- 1. Permitir que o serviço de Edge Functions leia e gerencie tokens de aparelhos
DROP POLICY IF EXISTS "Allow push service to read device tokens" ON public.device_tokens;
CREATE POLICY "Allow push service to read device tokens"
ON public.device_tokens
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow push service to delete expired device tokens" ON public.device_tokens;
CREATE POLICY "Allow push service to delete expired device tokens"
ON public.device_tokens
FOR DELETE
TO anon, authenticated
USING (true);


-- 2. Atualizar função de disparo para não enviar chave conflitante no cabeçalho
CREATE OR REPLACE FUNCTION public.notify_push_notification(
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
BEGIN
    v_url := 'https://zfxjocaypfgivnwncyqs.supabase.co/functions/v1/send-push-notification';

    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'title', p_title,
            'body', p_body,
            'data', p_data
        )
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_push_notification] Erro ao disparar notificação: %', SQLERRM;
END;
$$;


-- 3. Atualizar função de checagem diária de fiados vencidos
CREATE OR REPLACE FUNCTION public.run_daily_overdue_check()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
BEGIN
    v_url := 'https://zfxjocaypfgivnwncyqs.supabase.co/functions/v1/check-overdue-fiados';

    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[run_daily_overdue_check] Erro no agendamento de fiados vencidos: %', SQLERRM;
END;
$$;
