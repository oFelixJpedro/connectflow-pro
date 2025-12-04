-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Enum para roles (mais seguro)
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'supervisor', 'agent', 'viewer');

-- Enum para status do usuário
CREATE TYPE public.user_status AS ENUM ('online', 'offline', 'away', 'busy');

-- Enum para planos
CREATE TYPE public.company_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- Enum para status de conexão WhatsApp
CREATE TYPE public.connection_status AS ENUM ('connected', 'disconnected', 'qr_ready', 'connecting', 'error');

-- Enum para status de conversa
CREATE TYPE public.conversation_status AS ENUM ('open', 'pending', 'in_progress', 'waiting', 'resolved', 'closed');

-- Enum para prioridade
CREATE TYPE public.conversation_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Enum para direção da mensagem
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- Enum para tipo de remetente
CREATE TYPE public.sender_type AS ENUM ('user', 'contact', 'system', 'bot');

-- Enum para tipo de mensagem
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker');

-- Enum para status da mensagem
CREATE TYPE public.message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- =====================
-- TABELA: companies
-- =====================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    plan company_plan DEFAULT 'free',
    settings JSONB DEFAULT '{
        "businessHours": {
            "enabled": true,
            "timezone": "America/Sao_Paulo",
            "schedule": {
                "monday": {"open": "09:00", "close": "18:00"},
                "tuesday": {"open": "09:00", "close": "18:00"},
                "wednesday": {"open": "09:00", "close": "18:00"},
                "thursday": {"open": "09:00", "close": "18:00"},
                "friday": {"open": "09:00", "close": "18:00"},
                "saturday": {"open": "09:00", "close": "13:00"},
                "sunday": {"open": null, "close": null}
            }
        }
    }'::jsonb,
    active BOOLEAN DEFAULT true,
    trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON companies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_active ON companies(active);

-- =====================
-- TABELA: departments
-- =====================
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_departments_updated_at 
    BEFORE UPDATE ON departments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_departments_company ON departments(company_id);
CREATE INDEX idx_departments_active ON departments(company_id, active);

-- =====================
-- TABELA: profiles (linked to auth.users)
-- =====================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    status user_status DEFAULT 'offline',
    max_conversations INT DEFAULT 5 CHECK (max_conversations >= 1 AND max_conversations <= 50),
    active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_department ON profiles(department_id);
CREATE INDEX idx_profiles_status ON profiles(company_id, status);

-- =====================
-- TABELA: user_roles (SEPARATE TABLE FOR SECURITY)
-- =====================
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- =====================
-- FUNÇÃO: has_role (Security Definer)
-- =====================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- =====================
-- FUNÇÃO: get_user_company_id (Security Definer)
-- =====================
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT company_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================
-- FUNÇÃO: get_user_role (Security Definer)
-- =====================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS app_role AS $$
BEGIN
    RETURN (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================
-- FUNÇÃO: is_admin_or_owner (Security Definer)
-- =====================
CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================
-- TABELA: whatsapp_connections
-- =====================
CREATE TABLE whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    qr_code TEXT,
    status connection_status DEFAULT 'disconnected',
    webhook_url TEXT,
    settings JSONB DEFAULT '{
        "autoAssign": true,
        "greetingMessage": "Olá! Como podemos ajudar?",
        "awayMessage": "Estamos fora do horário de atendimento. Retornaremos em breve!"
    }'::jsonb,
    active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

CREATE TRIGGER update_whatsapp_connections_updated_at 
    BEFORE UPDATE ON whatsapp_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_whatsapp_connections_company ON whatsapp_connections(company_id);
CREATE INDEX idx_whatsapp_connections_status ON whatsapp_connections(company_id, status);

-- =====================
-- TABELA: contacts
-- =====================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    last_interaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_contacts_company_phone ON contacts(company_id, phone_number);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_last_interaction ON contacts(company_id, last_interaction_at DESC);

-- =====================
-- TABELA: conversations
-- =====================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    whatsapp_connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    status conversation_status DEFAULT 'open',
    priority conversation_priority DEFAULT 'normal',
    channel VARCHAR(20) DEFAULT 'whatsapp',
    tags TEXT[] DEFAULT '{}',
    unread_count INT DEFAULT 0,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_status ON conversations(company_id, status);
CREATE INDEX idx_conversations_assigned_user ON conversations(assigned_user_id);
CREATE INDEX idx_conversations_department ON conversations(department_id);
CREATE INDEX idx_conversations_last_message ON conversations(company_id, last_message_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);

-- =====================
-- TABELA: messages
-- =====================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    whatsapp_message_id VARCHAR(255),
    direction message_direction NOT NULL,
    sender_type sender_type NOT NULL,
    sender_id UUID,
    message_type message_type NOT NULL,
    content TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    thumbnail_url TEXT,
    status message_status DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_internal_note BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_whatsapp_id ON messages(whatsapp_message_id);
CREATE INDEX idx_messages_type ON messages(message_type);

-- =====================
-- TABELA: tags
-- =====================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

CREATE INDEX idx_tags_company ON tags(company_id);

-- =====================
-- TABELA: quick_replies
-- =====================
CREATE TABLE quick_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    shortcut VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_global BOOLEAN DEFAULT false,
    category VARCHAR(100),
    use_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, shortcut)
);

CREATE TRIGGER update_quick_replies_updated_at 
    BEFORE UPDATE ON quick_replies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_quick_replies_company ON quick_replies(company_id);
CREATE INDEX idx_quick_replies_category ON quick_replies(company_id, category);

-- =====================
-- HABILITAR RLS EM TODAS AS TABELAS
-- =====================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

-- =====================
-- POLICIES: user_roles
-- =====================
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- =====================
-- POLICIES: companies
-- =====================
CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    TO authenticated
    USING (id = get_user_company_id());

CREATE POLICY "Owners can update their company"
    ON companies FOR UPDATE
    TO authenticated
    USING (id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- POLICIES: departments
-- =====================
CREATE POLICY "Users can view departments in their company"
    ON departments FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Admins can insert departments"
    ON departments FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can update departments"
    ON departments FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can delete departments"
    ON departments FOR DELETE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- POLICIES: profiles
-- =====================
CREATE POLICY "Users can view team members"
    ON profiles FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can update any profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- POLICIES: whatsapp_connections
-- =====================
CREATE POLICY "Users can view connections in their company"
    ON whatsapp_connections FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Admins can insert connections"
    ON whatsapp_connections FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can update connections"
    ON whatsapp_connections FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

CREATE POLICY "Admins can delete connections"
    ON whatsapp_connections FOR DELETE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- POLICIES: contacts
-- =====================
CREATE POLICY "Users can view contacts in their company"
    ON contacts FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Users can create contacts"
    ON contacts FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update contacts"
    ON contacts FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Admins can delete contacts"
    ON contacts FOR DELETE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- POLICIES: conversations
-- =====================
CREATE POLICY "Users can view conversations in their company"
    ON conversations FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update conversations"
    ON conversations FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id());

-- =====================
-- POLICIES: messages
-- =====================
CREATE POLICY "Users can view messages in their company conversations"
    ON messages FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = messages.conversation_id 
        AND company_id = get_user_company_id()
    ));

CREATE POLICY "Users can create messages"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = messages.conversation_id 
        AND company_id = get_user_company_id()
    ));

CREATE POLICY "Users can update their messages"
    ON messages FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid());

-- =====================
-- POLICIES: tags
-- =====================
CREATE POLICY "Users can view tags in their company"
    ON tags FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Users can create tags"
    ON tags FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update tags"
    ON tags FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id());

CREATE POLICY "Admins can delete tags"
    ON tags FOR DELETE
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- POLICIES: quick_replies
-- =====================
CREATE POLICY "Users can view quick replies"
    ON quick_replies FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id() AND 
           (is_global = true OR created_by_user_id = auth.uid()));

CREATE POLICY "Users can create quick replies"
    ON quick_replies FOR INSERT
    TO authenticated
    WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their quick replies"
    ON quick_replies FOR UPDATE
    TO authenticated
    USING (company_id = get_user_company_id() AND created_by_user_id = auth.uid());

CREATE POLICY "Admins can manage all quick replies"
    ON quick_replies FOR ALL
    TO authenticated
    USING (company_id = get_user_company_id() AND is_admin_or_owner());

-- =====================
-- STORAGE BUCKETS
-- =====================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('messages-media', 'messages-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their avatar"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for company logos
CREATE POLICY "Anyone can view company logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'company-logos');

CREATE POLICY "Admins can upload company logo"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'company-logos' AND is_admin_or_owner());

CREATE POLICY "Admins can update company logo"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'company-logos' AND is_admin_or_owner());

-- Storage policies for message media
CREATE POLICY "Users can view media from their company"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'messages-media' AND 
           (storage.foldername(name))[1] = get_user_company_id()::text);

CREATE POLICY "Users can upload media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'messages-media' AND 
                (storage.foldername(name))[1] = get_user_company_id()::text);