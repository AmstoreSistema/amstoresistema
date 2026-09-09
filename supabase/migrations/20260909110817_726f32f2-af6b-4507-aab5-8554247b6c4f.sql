DELETE FROM public.cashback_entries e
USING public.sales s
WHERE e.sale_id = s.id AND s.created_at < '2025-10-01';

UPDATE public.clients c
SET cashback_balance = COALESCE((
  SELECT SUM(CASE WHEN e.kind IN ('earned','earn','bonus') THEN e.amount ELSE -e.amount END)
  FROM public.cashback_entries e
  WHERE e.client_id = c.id
), 0);