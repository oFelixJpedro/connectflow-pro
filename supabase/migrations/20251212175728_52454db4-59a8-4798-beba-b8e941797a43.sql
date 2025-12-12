-- Create quick_reply_categories table
CREATE TABLE public.quick_reply_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Create index for faster lookups
CREATE INDEX idx_quick_reply_categories_company ON public.quick_reply_categories(company_id);

-- Enable RLS
ALTER TABLE public.quick_reply_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view categories from their company"
  ON public.quick_reply_categories FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create categories in their company"
  ON public.quick_reply_categories FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update categories in their company"
  ON public.quick_reply_categories FOR UPDATE
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can delete categories in their company"
  ON public.quick_reply_categories FOR DELETE
  USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Add category_id to quick_replies (nullable, will replace the varchar category column)
ALTER TABLE public.quick_replies ADD COLUMN category_id UUID REFERENCES public.quick_reply_categories(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_quick_reply_categories_updated_at
  BEFORE UPDATE ON public.quick_reply_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();