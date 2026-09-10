-- Migration: Permite exclusão segura de produtos sem violar chaves estrangeiras
-- 1. sale_items: ON DELETE SET NULL para manter o histórico das vendas, relatórios e snapshots
ALTER TABLE public.sale_items
  DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;

ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE SET NULL;

-- 2. stock_products: ON DELETE CASCADE (o estoque deste produto é removido junto)
ALTER TABLE public.stock_products
  DROP CONSTRAINT IF EXISTS stock_products_produto_id_fkey;

ALTER TABLE public.stock_products
  ADD CONSTRAINT stock_products_produto_id_fkey
    FOREIGN KEY (produto_id)
    REFERENCES public.products(id)
    ON DELETE CASCADE;

-- 3. product_materials: ON DELETE CASCADE (a composição técnica é removida junto)
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_product_id_fkey;

ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE CASCADE;

-- 4. production_orders: ON DELETE SET NULL (mantém a ordem de produção histórica)
ALTER TABLE public.production_orders
  DROP CONSTRAINT IF EXISTS production_orders_product_id_fkey;

ALTER TABLE public.production_orders
  ADD CONSTRAINT production_orders_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE SET NULL;

-- 5. etiqueta_gerada: ON DELETE SET NULL
ALTER TABLE public.etiqueta_gerada
  DROP CONSTRAINT IF EXISTS etiqueta_gerada_produto_id_fkey;

ALTER TABLE public.etiqueta_gerada
  ADD CONSTRAINT etiqueta_gerada_produto_id_fkey
    FOREIGN KEY (produto_id)
    REFERENCES public.products(id)
    ON DELETE SET NULL;
