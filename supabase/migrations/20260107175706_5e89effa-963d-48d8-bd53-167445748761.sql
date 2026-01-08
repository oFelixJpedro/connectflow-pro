-- Create table for notification configurations
CREATE TABLE public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  notification_type varchar(50) NOT NULL, -- 'contract_sent', 'contract_signed', 'meeting_scheduled', 'custom'
  message_template text NOT NULL,
  connection_id uuid NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create table for notification recipients
CREATE TABLE public.whatsapp_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES whatsapp_notifications(id) ON DELETE CASCADE,
  phone_number varchar(20) NOT NULL,
  name varchar(255),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create table for notification logs
CREATE TABLE public.whatsapp_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES whatsapp_notifications(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recipient_phone varchar(20) NOT NULL,
  recipient_name varchar(255),
  message_content text NOT NULL,
  status varchar(20) DEFAULT 'pending',
  error_message text,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Enable RLS
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_notifications
CREATE POLICY "Users can view company notifications"
ON public.whatsapp_notifications FOR SELECT
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
));

CREATE POLICY "Users can insert company notifications"
ON public.whatsapp_notifications FOR INSERT
WITH CHECK (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
));

CREATE POLICY "Users can update company notifications"
ON public.whatsapp_notifications FOR UPDATE
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
));

CREATE POLICY "Users can delete company notifications"
ON public.whatsapp_notifications FOR DELETE
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
));

-- RLS Policies for whatsapp_notification_recipients
CREATE POLICY "Users can view notification recipients"
ON public.whatsapp_notification_recipients FOR SELECT
USING (notification_id IN (
  SELECT n.id FROM whatsapp_notifications n
  JOIN profiles p ON p.company_id = n.company_id
  WHERE p.id = auth.uid()
));

CREATE POLICY "Users can insert notification recipients"
ON public.whatsapp_notification_recipients FOR INSERT
WITH CHECK (notification_id IN (
  SELECT n.id FROM whatsapp_notifications n
  JOIN profiles p ON p.company_id = n.company_id
  WHERE p.id = auth.uid()
));

CREATE POLICY "Users can update notification recipients"
ON public.whatsapp_notification_recipients FOR UPDATE
USING (notification_id IN (
  SELECT n.id FROM whatsapp_notifications n
  JOIN profiles p ON p.company_id = n.company_id
  WHERE p.id = auth.uid()
));

CREATE POLICY "Users can delete notification recipients"
ON public.whatsapp_notification_recipients FOR DELETE
USING (notification_id IN (
  SELECT n.id FROM whatsapp_notifications n
  JOIN profiles p ON p.company_id = n.company_id
  WHERE p.id = auth.uid()
));

-- RLS Policies for whatsapp_notification_logs
CREATE POLICY "Users can view company notification logs"
ON public.whatsapp_notification_logs FOR SELECT
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
));

CREATE POLICY "Users can insert company notification logs"
ON public.whatsapp_notification_logs FOR INSERT
WITH CHECK (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_whatsapp_notifications_company ON whatsapp_notifications(company_id);
CREATE INDEX idx_whatsapp_notifications_type ON whatsapp_notifications(notification_type);
CREATE INDEX idx_whatsapp_notification_recipients_notification ON whatsapp_notification_recipients(notification_id);
CREATE INDEX idx_whatsapp_notification_logs_company ON whatsapp_notification_logs(company_id);
CREATE INDEX idx_whatsapp_notification_logs_notification ON whatsapp_notification_logs(notification_id);
CREATE INDEX idx_whatsapp_notification_logs_status ON whatsapp_notification_logs(status);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_notifications_updated_at
BEFORE UPDATE ON public.whatsapp_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();