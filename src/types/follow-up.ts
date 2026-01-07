// Follow-up System Types

export type FollowUpType = 'manual' | 'ai' | 'advanced';
export type FollowUpStatus = 'active' | 'paused' | 'inactive';
export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'stopped_reply' | 'stopped_manual';
export type DelayUnit = 'minutes' | 'hours' | 'days';
export type AIModelType = 'standard' | 'advanced';

export interface FollowUpSequence {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  follow_up_type: FollowUpType;
  ai_model_type: AIModelType;
  persona_prompt: string | null;
  rules_content: string | null;
  knowledge_base_content: string | null;
  connection_ids: string[];
  crm_stage_ids: string[];
  tag_filters: string[];
  operating_hours_enabled: boolean;
  operating_start_time: string;
  operating_end_time: string;
  operating_days: number[];
  status: FollowUpStatus;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  steps?: FollowUpSequenceStep[];
  active_contacts_count?: number;
}

export interface FollowUpSequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_value: number;
  delay_unit: DelayUnit;
  manual_content: string | null;
  manual_media_url: string | null;
  manual_media_type: string | null;
  ai_instruction: string | null;
  stop_if_replied: boolean;
  stop_if_opened: boolean;
  created_at: string;
}

export interface FollowUpQueueItem {
  id: string;
  company_id: string;
  contact_id: string;
  conversation_id: string | null;
  sequence_id: string;
  current_step_id: string | null;
  scheduled_at: string;
  status: QueueStatus;
  sent_at: string | null;
  sent_content: string | null;
  sent_media_url: string | null;
  failure_reason: string | null;
  failure_code: string | null;
  tokens_used: number;
  processing_time_ms: number | null;
  reference_message_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  contact?: {
    id: string;
    name: string | null;
    phone_number: string;
    avatar_url: string | null;
  };
  sequence?: FollowUpSequence;
  step?: FollowUpSequenceStep;
}

export interface FollowUpContactState {
  id: string;
  contact_id: string;
  company_id: string;
  active_sequence_id: string | null;
  current_step_order: number;
  last_followup_sent_at: string | null;
  last_contact_reply_at: string | null;
  total_followups_sent: number;
  opted_out: boolean;
  opted_out_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpKnowledgeDocument {
  id: string;
  sequence_id: string;
  company_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text: string | null;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

// Dashboard Types
export interface FollowUpMetrics {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  successRate: number;
  failureRate: number;
}

export interface FollowUpDailyData {
  date: string;
  sent: number;
  failed: number;
}

export interface FollowUpHourlyData {
  hour: number;
  count: number;
}

export interface FailureCategory {
  code: string;
  label: string;
  count: number;
  percentage: number;
}

// Form Types
export interface CreateSequenceData {
  name: string;
  description?: string;
  follow_up_type: FollowUpType;
  ai_model_type?: AIModelType;
  persona_prompt?: string;
  rules_content?: string;
  knowledge_base_content?: string;
  connection_ids?: string[];
  crm_stage_ids?: string[];
  tag_filters?: string[];
  operating_hours_enabled?: boolean;
  operating_start_time?: string;
  operating_end_time?: string;
  operating_days?: number[];
  priority?: number;
}

export interface CreateStepData {
  step_order: number;
  delay_value: number;
  delay_unit: DelayUnit;
  manual_content?: string;
  manual_media_url?: string;
  manual_media_type?: string;
  ai_instruction?: string;
  stop_if_replied?: boolean;
  stop_if_opened?: boolean;
}

export interface UpdateSequenceData extends Partial<CreateSequenceData> {
  status?: FollowUpStatus;
}

export interface UpdateStepData extends Partial<CreateStepData> {}

// Failure code labels mapping
export const FAILURE_LABELS: Record<string, string> = {
  'empty_history': 'Histórico vazio',
  'no_negotiation': 'Lead sem negociação',
  'stage_disabled': 'Estágio com follow-up desativado',
  'ai_disabled': 'IA Desativada',
  'ai_paused': 'IA Pausada',
  'no_credits': 'Sem créditos de IA',
  'contact_opted_out': 'Contato optou por não receber',
  'whatsapp_error': 'Erro no WhatsApp',
  'outside_hours': 'Fora do horário de operação',
  'other': 'Outros'
};

// Follow-up type labels
export const FOLLOWUP_TYPE_LABELS: Record<FollowUpType, string> = {
  'manual': 'Padrão (Manual)',
  'ai': 'Com IA',
  'advanced': 'Avançado'
};

// Delay unit labels
export const DELAY_UNIT_LABELS: Record<DelayUnit, string> = {
  'minutes': 'minutos',
  'hours': 'horas',
  'days': 'dias'
};

// Status labels and colors
export const STATUS_CONFIG: Record<FollowUpStatus, { label: string; color: string }> = {
  'active': { label: 'Ativo', color: 'bg-green-500' },
  'paused': { label: 'Pausado', color: 'bg-yellow-500' },
  'inactive': { label: 'Inativo', color: 'bg-gray-500' }
};
