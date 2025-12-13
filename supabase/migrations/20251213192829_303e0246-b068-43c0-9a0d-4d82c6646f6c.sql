-- Create internal-notes-media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'internal-notes-media', 
  'internal-notes-media', 
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload note attachments to their company folder
CREATE POLICY "Users can upload note attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'internal-notes-media'
);

-- Policy: Users can view note attachments
CREATE POLICY "Users can view note attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'internal-notes-media'
);

-- Policy: Users can delete their note attachments
CREATE POLICY "Users can delete note attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'internal-notes-media'
);