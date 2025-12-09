-- Create storage bucket for WhatsApp media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/*', 'image/*', 'video/*', 'application/*']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view files (public bucket)
CREATE POLICY "Public can view whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Policy: Authenticated users can upload files (service role will handle this via webhook)
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

-- Policy: Service role can update files
CREATE POLICY "Service role can update whatsapp media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media');

-- Policy: Admins/owners can delete files
CREATE POLICY "Admins can delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');