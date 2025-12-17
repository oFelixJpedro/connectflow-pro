-- Create storage bucket for AI agent media (voice previews, images, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-agent-media', 'ai-agent-media', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for ai-agent-media bucket
CREATE POLICY "Authenticated users can view AI agent media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai-agent-media' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage AI agent media"
ON storage.objects FOR ALL
USING (bucket_id = 'ai-agent-media')
WITH CHECK (bucket_id = 'ai-agent-media');