-- Create enum for card priority
CREATE TYPE kanban_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Kanban Boards (1 per WhatsApp connection)
CREATE TABLE public.kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(whatsapp_connection_id)
);

-- Kanban Columns
CREATE TABLE public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#E8E8E8',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kanban Cards
CREATE TABLE public.kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  priority kanban_priority NOT NULL DEFAULT 'medium',
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id)
);

-- Kanban Card Tags
CREATE TABLE public.kanban_card_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#D6E5FF'
);

-- Kanban Card Attachments
CREATE TABLE public.kanban_card_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kanban Card Checklist Items
CREATE TABLE public.kanban_card_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kanban Card Comments
CREATE TABLE public.kanban_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kanban Card History (audit log)
CREATE TABLE public.kanban_card_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CRM User Access Control
CREATE TABLE public.crm_user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_user_access ENABLE ROW LEVEL SECURITY;

-- Helper function to get board's company_id
CREATE OR REPLACE FUNCTION public.get_board_company_id(board_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.kanban_boards WHERE id = board_id
$$;

-- Helper function to get card's company_id
CREATE OR REPLACE FUNCTION public.get_card_company_id(card_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kb.company_id 
  FROM public.kanban_cards kc
  JOIN public.kanban_columns kcol ON kc.column_id = kcol.id
  JOIN public.kanban_boards kb ON kcol.board_id = kb.id
  WHERE kc.id = card_id
$$;

-- Helper function to check CRM access
CREATE OR REPLACE FUNCTION public.has_crm_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Owner and admin always have access
  IF user_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Check crm_user_access table
  RETURN EXISTS (
    SELECT 1 FROM public.crm_user_access
    WHERE user_id = auth.uid() AND enabled = true
  );
END;
$$;

-- RLS Policies for kanban_boards
CREATE POLICY "Users can view boards in their company"
ON public.kanban_boards FOR SELECT
USING (company_id = get_user_company_id() AND has_crm_access());

CREATE POLICY "Admins can create boards"
ON public.kanban_boards FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can update boards"
ON public.kanban_boards FOR UPDATE
USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can delete boards"
ON public.kanban_boards FOR DELETE
USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- RLS Policies for kanban_columns
CREATE POLICY "Users can view columns"
ON public.kanban_columns FOR SELECT
USING (get_board_company_id(board_id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Admins can create columns"
ON public.kanban_columns FOR INSERT
WITH CHECK (get_board_company_id(board_id) = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can update columns"
ON public.kanban_columns FOR UPDATE
USING (get_board_company_id(board_id) = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can delete columns"
ON public.kanban_columns FOR DELETE
USING (get_board_company_id(board_id) = get_user_company_id() AND is_admin_or_owner());

-- RLS Policies for kanban_cards
CREATE POLICY "Users can view cards"
ON public.kanban_cards FOR SELECT
USING (get_card_company_id(id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can create cards"
ON public.kanban_cards FOR INSERT
WITH CHECK (get_card_company_id(id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can update cards"
ON public.kanban_cards FOR UPDATE
USING (get_card_company_id(id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can delete cards"
ON public.kanban_cards FOR DELETE
USING (get_card_company_id(id) = get_user_company_id() AND has_crm_access());

-- RLS Policies for kanban_card_tags
CREATE POLICY "Users can view tags"
ON public.kanban_card_tags FOR SELECT
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can manage tags"
ON public.kanban_card_tags FOR ALL
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

-- RLS Policies for kanban_card_attachments
CREATE POLICY "Users can view attachments"
ON public.kanban_card_attachments FOR SELECT
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can manage attachments"
ON public.kanban_card_attachments FOR ALL
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

-- RLS Policies for kanban_card_checklist_items
CREATE POLICY "Users can view checklist items"
ON public.kanban_card_checklist_items FOR SELECT
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can manage checklist items"
ON public.kanban_card_checklist_items FOR ALL
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

-- RLS Policies for kanban_card_comments
CREATE POLICY "Users can view comments"
ON public.kanban_card_comments FOR SELECT
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can create comments"
ON public.kanban_card_comments FOR INSERT
WITH CHECK (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access() AND user_id = auth.uid());

-- RLS Policies for kanban_card_history
CREATE POLICY "Users can view history"
ON public.kanban_card_history FOR SELECT
USING (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

CREATE POLICY "Users can create history"
ON public.kanban_card_history FOR INSERT
WITH CHECK (get_card_company_id(card_id) = get_user_company_id() AND has_crm_access());

-- RLS Policies for crm_user_access
CREATE POLICY "Users can view their own CRM access"
ON public.crm_user_access FOR SELECT
USING (user_id = auth.uid() OR (company_id = get_user_company_id() AND is_admin_or_owner()));

CREATE POLICY "Admins can manage CRM access"
ON public.crm_user_access FOR ALL
USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- Create indexes for performance
CREATE INDEX idx_kanban_boards_company ON public.kanban_boards(company_id);
CREATE INDEX idx_kanban_boards_connection ON public.kanban_boards(whatsapp_connection_id);
CREATE INDEX idx_kanban_columns_board ON public.kanban_columns(board_id);
CREATE INDEX idx_kanban_columns_position ON public.kanban_columns(board_id, position);
CREATE INDEX idx_kanban_cards_column ON public.kanban_cards(column_id);
CREATE INDEX idx_kanban_cards_contact ON public.kanban_cards(contact_id);
CREATE INDEX idx_kanban_cards_assigned ON public.kanban_cards(assigned_user_id);
CREATE INDEX idx_kanban_cards_position ON public.kanban_cards(column_id, position);
CREATE INDEX idx_kanban_card_tags_card ON public.kanban_card_tags(card_id);
CREATE INDEX idx_kanban_card_attachments_card ON public.kanban_card_attachments(card_id);
CREATE INDEX idx_kanban_card_checklist_card ON public.kanban_card_checklist_items(card_id);
CREATE INDEX idx_kanban_card_comments_card ON public.kanban_card_comments(card_id);
CREATE INDEX idx_kanban_card_history_card ON public.kanban_card_history(card_id);
CREATE INDEX idx_crm_user_access_user ON public.crm_user_access(user_id);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('kanban-attachments', 'kanban-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for kanban-attachments
CREATE POLICY "Users can view kanban attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'kanban-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload kanban attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kanban-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete kanban attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'kanban-attachments' AND auth.role() = 'authenticated');

-- Enable realtime for cards and columns
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_card_comments;

-- Triggers for updated_at
CREATE TRIGGER update_kanban_boards_updated_at
BEFORE UPDATE ON public.kanban_boards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_columns_updated_at
BEFORE UPDATE ON public.kanban_columns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_cards_updated_at
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kanban_checklist_updated_at
BEFORE UPDATE ON public.kanban_card_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_access_updated_at
BEFORE UPDATE ON public.crm_user_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();