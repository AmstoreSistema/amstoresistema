INSERT INTO storage.buckets (id, name, public) 
VALUES ('store_assets', 'store_assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read access for store_assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'store_assets');

CREATE POLICY "Allow authenticated uploads for store_assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store_assets');

CREATE POLICY "Allow users to delete their own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'store_assets');
