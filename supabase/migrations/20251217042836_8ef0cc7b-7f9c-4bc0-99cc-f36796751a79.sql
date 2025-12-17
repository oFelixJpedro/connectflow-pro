-- Tornar o bucket scheduled-messages-media público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'scheduled-messages-media';

-- Política de leitura pública para UAZAPI poder acessar as mídias
CREATE POLICY "Public read access for scheduled message media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'scheduled-messages-media');