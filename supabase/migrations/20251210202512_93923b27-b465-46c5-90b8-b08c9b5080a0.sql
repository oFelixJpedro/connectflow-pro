-- Update whatsapp-media bucket to accept text/* MIME types (for .txt, .csv, .md, .html, .css, .js files)
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['audio/*', 'image/*', 'video/*', 'application/*', 'text/*']
WHERE id = 'whatsapp-media';