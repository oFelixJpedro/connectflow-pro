-- Add media support to quick_replies table
ALTER TABLE public.quick_replies
ADD COLUMN media_url TEXT,
ADD COLUMN media_type TEXT CHECK (media_type IN ('text', 'image', 'video', 'audio', 'document'));

-- Set default media_type to 'text' for existing records
UPDATE public.quick_replies SET media_type = 'text' WHERE media_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.quick_replies.media_url IS 'URL of the media file stored in Supabase Storage';
COMMENT ON COLUMN public.quick_replies.media_type IS 'Type of quick reply: text, image, video, audio, or document';