export type NotificationType = 'contract_sent' | 'contract_signed' | 'meeting_scheduled' | 'custom';

export interface WhatsAppNotification {
  id: string;
  company_id: string;
  name: string;
  notification_type: NotificationType;
  message_template: string;
  connection_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  recipients?: WhatsAppNotificationRecipient[];
  connection?: {
    id: string;
    phone_number: string | null;
    name: string | null;
  };
}

export interface WhatsAppNotificationRecipient {
  id: string;
  notification_id: string;
  phone_number: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppNotificationLog {
  id: string;
  notification_id: string | null;
  company_id: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_content: string;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  event_data: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
}

export interface CreateNotificationData {
  name: string;
  notification_type: NotificationType;
  message_template: string;
  connection_id: string;
}

export interface UpdateNotificationData {
  name?: string;
  notification_type?: NotificationType;
  message_template?: string;
  connection_id?: string;
  is_active?: boolean;
}

export interface NotificationTemplate {
  type: NotificationType;
  name: string;
  description: string;
  icon: string;
  defaultMessage: string;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    type: 'contract_sent',
    name: 'Contrato Enviado',
    description: 'Notifica quando um contrato é enviado ao cliente',
    icon: '📄',
    defaultMessage: `📄 *CONTRATO ENVIADO*

👤 *Cliente:* {{cliente_nome}}
📱 *Telefone:* {{cliente_telefone}}

📝 Um novo contrato foi enviado para assinatura.

📅 *Data:* {{data_hora}}`
  },
  {
    type: 'contract_signed',
    name: 'Contrato Assinado',
    description: 'Notifica quando um contrato é assinado pelo cliente',
    icon: '✅',
    defaultMessage: `🎉 *CONTRATO ASSINADO*

👤 *Cliente:* {{cliente_nome}}
📱 *Telefone:* {{cliente_telefone}}
💰 *Valor:* {{valor}}

✅ Negócio fechado com sucesso!

📅 *Data:* {{data_hora}}`
  },
  {
    type: 'meeting_scheduled',
    name: 'Reunião Agendada',
    description: 'Notifica quando uma reunião é agendada com o cliente',
    icon: '📅',
    defaultMessage: `📅 *REUNIÃO AGENDADA*

👤 *Cliente:* {{cliente_nome}}
📱 *Telefone:* {{cliente_telefone}}

🕐 *Data/Hora:* {{data_hora}}

📍 Não esqueça de confirmar a reunião!`
  }
];

export const NOTIFICATION_PLACEHOLDERS = [
  { key: '{{cliente_nome}}', label: 'Nome do cliente' },
  { key: '{{cliente_telefone}}', label: 'Telefone do cliente' },
  { key: '{{valor}}', label: 'Valor do negócio' },
  { key: '{{data_hora}}', label: 'Data e hora do evento' },
  { key: '{{agente}}', label: 'Nome do agente responsável' },
  { key: '{{empresa}}', label: 'Nome da empresa' }
];
