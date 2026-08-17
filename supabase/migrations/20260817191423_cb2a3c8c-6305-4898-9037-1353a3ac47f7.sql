DELETE FROM public.material_categories WHERE name IN ('Bolsa', 'Sandálias', 'Carteiras', 'perfumes');
NOTIFY pgrst, 'reload schema';