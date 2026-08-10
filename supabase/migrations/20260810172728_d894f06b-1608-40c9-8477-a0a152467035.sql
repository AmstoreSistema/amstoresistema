CREATE TABLE public.material_cuts (
    id uuid primary key default gen_random_uuid(),
    material_id uuid references public.materials(id) on delete cascade not null,
    name text not null,
    width numeric not null,
    height numeric not null,
    x numeric default 0,
    y numeric default 0,
    rotation numeric default 0,
    status text default 'disponivel' check (status in ('disponivel', 'utilizado', 'reservado')),
    created_at timestamptz default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_cuts TO authenticated;
GRANT ALL ON public.material_cuts TO service_role;

ALTER TABLE public.material_cuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cuts"
ON public.material_cuts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
