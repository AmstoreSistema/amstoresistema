DELETE FROM public.transactions t
WHERE t.account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.transactions k
    WHERE k.account_id IS NOT NULL
      AND k.amount = t.amount
      AND COALESCE(k.description,'') = COALESCE(t.description,'')
      AND k.type = t.type
      AND (k.created_at AT TIME ZONE 'UTC')::date = (t.created_at AT TIME ZONE 'UTC')::date
  );