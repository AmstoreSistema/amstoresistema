
-- 1. Ensure material_categories match exactly Bolsa, Sandália, Carteira, Perfume
DELETE FROM public.material_categories 
WHERE name NOT IN ('Bolsa', 'Sandália', 'Carteira', 'Perfume');

INSERT INTO public.material_categories (name)
VALUES ('Bolsa'), ('Sandália'), ('Carteira'), ('Perfume')
ON CONFLICT (name) DO NOTHING;

-- 2. Function to get cashback balance by category for a client
CREATE OR REPLACE FUNCTION public.get_client_cashback_by_category(p_client_id UUID)
RETURNS TABLE (
  category_name TEXT,
  total_earned NUMERIC,
  total_used NUMERIC,
  balance NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH earned AS (
    SELECT 
      p.category,
      SUM(si.quantity * si.unit_price * (COALESCE(cc.cashback_percent, 0) / 100.0)) as earned_amount
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    JOIN public.products p ON p.id = si.product_id
    LEFT JOIN public.material_categories mc ON mc.name = p.category
    LEFT JOIN public.cashback_config cc ON cc.category_id = mc.id AND cc.active = true
    WHERE s.client_id = p_client_id AND s.status != 'cancelled'
    GROUP BY p.category
  )
  SELECT 
    mc.name::TEXT as category_name,
    COALESCE(e.earned_amount, 0)::NUMERIC as total_earned,
    0::NUMERIC as total_used,
    COALESCE(e.earned_amount, 0)::NUMERIC as balance
  FROM public.material_categories mc
  LEFT JOIN earned e ON e.category = mc.name
  ORDER BY mc.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_cashback_by_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_cashback_by_category(UUID) TO service_role;
