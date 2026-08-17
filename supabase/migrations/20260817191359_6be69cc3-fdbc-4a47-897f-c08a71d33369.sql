DELETE FROM public.material_categories WHERE name NOT IN ('Armarinho', 'Cola', 'Couro', 'Embalagens', 'Estrutura', 'Ferragem', 'Forro', 'Linha', 'Outro', 'Papelaria', 'Tecido');
INSERT INTO public.material_categories (name)
SELECT name FROM (VALUES ('Bolsa'), ('Sandálias'), ('Carteiras'), ('perfumes')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.material_categories mc WHERE mc.name = v.name);
NOTIFY pgrst, 'reload schema';