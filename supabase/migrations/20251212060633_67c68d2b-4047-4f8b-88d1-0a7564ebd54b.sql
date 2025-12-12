-- Add name_manually_edited column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS name_manually_edited boolean DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.contacts.name_manually_edited IS 'When true, the name field was manually edited by an agent and should not be overwritten by automatic WhatsApp sync';