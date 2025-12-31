-- Create table for custom field definitions
CREATE TABLE public.custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  icon text DEFAULT 'FileText',
  position integer DEFAULT 0,
  is_required boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id, field_key)
);

-- Enable RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view custom fields from their company
CREATE POLICY "Users can view company custom fields" 
ON public.custom_field_definitions
FOR SELECT 
USING (company_id = get_user_company_id());

-- Policy: Admins can manage custom fields
CREATE POLICY "Admins can manage custom fields" 
ON public.custom_field_definitions
FOR ALL 
USING (company_id = get_user_company_id() AND is_admin_or_owner())
WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE custom_field_definitions;

-- Trigger for updated_at
CREATE TRIGGER update_custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();