-- ═══════════════════════════════════════════════════════════════════
-- ADD CONTACT BLOCKING COLUMNS
-- Allows blocking contacts to prevent them from reopening conversations
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add blocked columns to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES public.profiles(id);

-- 2. Create index for fast lookup of blocked contacts
CREATE INDEX IF NOT EXISTS idx_contacts_blocked 
ON public.contacts(company_id, is_blocked) 
WHERE is_blocked = true;

-- 3. Add comment explaining the columns
COMMENT ON COLUMN public.contacts.is_blocked IS 
'Whether this contact is blocked from sending messages. Blocked contacts cannot reopen closed conversations.';

COMMENT ON COLUMN public.contacts.blocked_at IS 
'Timestamp when the contact was blocked.';

COMMENT ON COLUMN public.contacts.blocked_by IS 
'The user ID who blocked this contact.';