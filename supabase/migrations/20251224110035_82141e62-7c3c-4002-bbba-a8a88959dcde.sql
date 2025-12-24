-- Add archive-related columns to whatsapp_connections
ALTER TABLE public.whatsapp_connections
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_phone_normalized VARCHAR(20) DEFAULT NULL;

-- Create index for efficient queries on archived connections
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_archived_at 
ON public.whatsapp_connections(archived_at) 
WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_original_phone_normalized 
ON public.whatsapp_connections(original_phone_normalized) 
WHERE original_phone_normalized IS NOT NULL;

-- Create connection_migrations table to track all migrations
CREATE TABLE IF NOT EXISTS public.connection_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  target_connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  migrated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  migration_type TEXT NOT NULL CHECK (migration_type IN ('auto_same_number', 'auto_contact_message', 'manual_single', 'manual_bulk', 'import_all')),
  migrated_contacts_count INTEGER DEFAULT 0,
  migrated_conversations_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on connection_migrations
ALTER TABLE public.connection_migrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for connection_migrations
CREATE POLICY "Admins can view migrations in their company"
ON public.connection_migrations
FOR SELECT
USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can create migrations in their company"
ON public.connection_migrations
FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "System can insert migrations"
ON public.connection_migrations
FOR INSERT
WITH CHECK (true);

-- Create index on connection_migrations
CREATE INDEX IF NOT EXISTS idx_connection_migrations_company 
ON public.connection_migrations(company_id);

CREATE INDEX IF NOT EXISTS idx_connection_migrations_source 
ON public.connection_migrations(source_connection_id);

CREATE INDEX IF NOT EXISTS idx_connection_migrations_target 
ON public.connection_migrations(target_connection_id);

-- Function to normalize phone numbers (remove all non-digits)
CREATE OR REPLACE FUNCTION public.normalize_phone_number(phone TEXT)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF phone IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$;

-- Trigger to auto-populate original_phone_normalized when phone_number changes
CREATE OR REPLACE FUNCTION public.set_original_phone_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Set normalized phone only if not already set and we have a real phone number
  IF NEW.original_phone_normalized IS NULL 
     AND NEW.phone_number IS NOT NULL 
     AND NEW.phone_number != 'Aguardando...' 
     AND NEW.status = 'connected' THEN
    NEW.original_phone_normalized := normalize_phone_number(NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_original_phone_normalized ON public.whatsapp_connections;
CREATE TRIGGER trigger_set_original_phone_normalized
BEFORE INSERT OR UPDATE ON public.whatsapp_connections
FOR EACH ROW
EXECUTE FUNCTION public.set_original_phone_normalized();

-- Update existing connections to populate original_phone_normalized
UPDATE public.whatsapp_connections
SET original_phone_normalized = normalize_phone_number(phone_number)
WHERE original_phone_normalized IS NULL 
  AND phone_number IS NOT NULL 
  AND phone_number != 'Aguardando...';