-- Create storage bucket for AI agent media
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-agent-media', 'ai-agent-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for ai-agent-media bucket
CREATE POLICY "Public read access for ai-agent-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai-agent-media');

CREATE POLICY "Admins can upload ai-agent-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ai-agent-media'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update ai-agent-media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ai-agent-media'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can delete ai-agent-media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ai-agent-media'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);