-- Migration: Create device_tokens table for push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_device_tokens_user_token UNIQUE (user_id, token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

-- Row Level Security
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own device tokens"
ON public.device_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to device tokens"
ON public.device_tokens
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
);
