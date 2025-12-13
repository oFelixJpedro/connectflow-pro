-- Create bucket for internal notes media
INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-notes-media', 'internal-notes-media', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload attachments to internal notes
CREATE POLICY "Users can upload internal note attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'internal-notes-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: Users can view attachments from their company
CREATE POLICY "Users can view internal note attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'internal-notes-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete internal note attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'internal-notes-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);