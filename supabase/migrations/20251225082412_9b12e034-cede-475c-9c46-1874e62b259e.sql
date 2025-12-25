-- ═══════════════════════════════════════════════════════════════════
-- REMOVE WHATSAPP GROUP SUPPORT - Complete cleanup
-- Groups are no longer supported to prevent system overload
-- ═══════════════════════════════════════════════════════════════════

-- 1. Force all connections to have groups disabled
UPDATE public.whatsapp_connections
SET receive_group_messages = false
WHERE receive_group_messages = true;

-- 2. Add comment explaining column is deprecated
COMMENT ON COLUMN public.whatsapp_connections.receive_group_messages IS 
'DEPRECATED: WhatsApp groups are no longer supported. This column is kept for historical records only. All values will be forced to false.';

-- 3. Mark any existing group conversations as closed (if any exist)
UPDATE public.conversations
SET 
  status = 'closed',
  closed_at = NOW(),
  metadata = jsonb_set(
    COALESCE(metadata, '{}'),
    '{closed_reason}',
    '"groups_no_longer_supported"'
  )
WHERE is_group = true 
AND status != 'closed';

-- 4. Add comment explaining is_group is deprecated
COMMENT ON COLUMN public.conversations.is_group IS 
'DEPRECATED: WhatsApp groups are no longer supported. Kept for historical data only. All new conversations will have is_group = false.';

-- 5. Create index to speed up filtering out old groups if not exists
CREATE INDEX IF NOT EXISTS idx_conversations_not_group 
ON public.conversations(company_id, status) 
WHERE is_group = false OR is_group IS NULL;