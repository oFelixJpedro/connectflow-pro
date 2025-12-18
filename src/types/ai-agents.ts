// =====================================================
// TIPOS DO SISTEMA DE AGENTES DE IA
// =====================================================

export type AIAgentType = 'single' | 'multi';
export type AIAgentStatus = 'active' | 'paused' | 'inactive';
export type AIConversationStatus = 'active' | 'paused' | 'inactive' | 'deactivated_permanently';
export type DeactivateOnHumanMessage = 'never' | 'always' | 'temporary';
export type AIAgentMediaType = 'image' | 'video' | 'audio' | 'document' | 'text' | 'link';

// Vozes disponíveis para TTS
export const AI_AGENT_VOICES = [
  { name: 'Zephyr', description: 'Voz suave e amigável' },
  { name: 'Kore', description: 'Voz profissional feminina' },
  { name: 'Orus', description: 'Voz masculina grave' },
  { name: 'Autonoe', description: 'Voz feminina expressiva' },
  { name: 'Umbriel', description: 'Voz neutra e clara' },
  { name: 'Erinome', description: 'Voz feminina jovem' },
  { name: 'Laomedeia', description: 'Voz feminina madura' },
  { name: 'Schedar', description: 'Voz masculina profissional' },
  { name: 'Achird', description: 'Voz masculina amigável' },
  { name: 'Sadachbia', description: 'Voz neutra formal' },
  { name: 'Puck', description: 'Voz jovem e dinâmica' },
  { name: 'Fenrir', description: 'Voz masculina forte' },
  { name: 'Aoede', description: 'Voz feminina musical' },
  { name: 'Enceladus', description: 'Voz masculina calma' },
  { name: 'Algieba', description: 'Voz profissional neutra' },
  { name: 'Algenib', description: 'Voz masculina séria' },
  { name: 'Achernar', description: 'Voz feminina elegante' },
  { name: 'Gacrux', description: 'Voz masculina autoritária' },
  { name: 'Zubenelgenubi', description: 'Voz neutra técnica' },
  { name: 'Sadaltager', description: 'Voz masculina gentil' },
  { name: 'Charon', description: 'Voz masculina misteriosa' },
  { name: 'Leda', description: 'Voz feminina suave' },
  { name: 'Callirrhoe', description: 'Voz feminina vibrante' },
  { name: 'Iapetus', description: 'Voz masculina robusta' },
  { name: 'Despina', description: 'Voz feminina animada' },
  { name: 'Rasalgethi', description: 'Voz masculina sábia' },
  { name: 'Alnilam', description: 'Voz neutra moderna' },
  { name: 'Pulcherrima', description: 'Voz feminina sofisticada' },
  { name: 'Vindemiatrix', description: 'Voz feminina confiante' },
  { name: 'Sulafat', description: 'Voz masculina cordial' },
] as const;

export type AIAgentVoiceName = typeof AI_AGENT_VOICES[number]['name'];

// Interface principal do agente
export interface AIAgent {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  agent_type: AIAgentType;
  is_primary: boolean;
  parent_agent_id: string | null;
  status: AIAgentStatus;
  paused_until: string | null;
  
  // Configurações básicas
  delay_seconds: number;
  temperature: number;
  
  // Conteúdo do agente
  rules_content: string | null;
  script_content: string | null;
  faq_content: string | null;
  
  // Informações da empresa
  company_info: AIAgentCompanyInfo;
  contract_link: string | null;
  
  // Configurações de ativação
  activation_triggers: string[];
  require_activation_trigger: boolean;
  deactivate_on_human_message: DeactivateOnHumanMessage;
  deactivate_temporary_minutes: number;
  
  // Configurações de áudio
  audio_enabled: boolean;
  audio_respond_with_audio: boolean;
  audio_always_respond_audio: boolean;
  voice_name: string;
  speech_speed: number;
  audio_temperature: number;
  language_code: string;
  
  // Configurações de resposta (batching e humanização)
  message_batch_seconds: number;
  split_response_enabled: boolean;
  split_message_delay_seconds: number;
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by: string | null;
  
  // Relacionamentos (quando expandidos)
  connections?: AIAgentConnection[];
  sub_agents?: AIAgent[];
}

// Informações da empresa para FAQ
export interface AIAgentCompanyInfo {
  company_name?: string;
  agent_name?: string;
  cnpj?: string;
  business_area?: string;
  address?: string;
  responsible_person?: string;
  oab?: string;
  fees?: string;
  cancellation_fee?: string;
  minimum_wage?: string;
  [key: string]: string | undefined;
}

// Conexão do agente com WhatsApp
export interface AIAgentConnection {
  id: string;
  agent_id: string;
  connection_id: string;
  created_at: string;
  connection?: {
    id: string;
    name: string;
    phone_number: string;
    status: string;
  };
}

// Mídia do agente
export interface AIAgentMedia {
  id: string;
  agent_id: string;
  media_type: AIAgentMediaType;
  media_key: string;
  media_url: string | null;
  media_content: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

// Estado da IA por conversa
export interface AIConversationState {
  id: string;
  conversation_id: string;
  agent_id: string | null;
  status: AIConversationStatus;
  paused_until: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  current_sub_agent_id: string | null;
  messages_processed: number;
  last_response_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  agent?: AIAgent;
}

// Template de agente
export interface AIAgentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  agent_type: AIAgentType;
  rules_template: string | null;
  script_template: string | null;
  faq_template: string | null;
  company_info_template: AIAgentCompanyInfo;
  default_delay_seconds: number;
  default_voice_name: string;
  default_speech_speed: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Log de ação do agente
export interface AIAgentLog {
  id: string;
  agent_id: string | null;
  conversation_id: string | null;
  action_type: string;
  input_text: string | null;
  output_text: string | null;
  tokens_used: number | null;
  processing_time_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =====================================================
// TIPOS PARA FORMULÁRIOS E CRIAÇÃO
// =====================================================

export interface CreateAIAgentData {
  name: string;
  description?: string;
  agent_type: AIAgentType;
  is_primary?: boolean;
  parent_agent_id?: string;
}

export interface UpdateAIAgentData {
  name?: string;
  description?: string;
  status?: AIAgentStatus;
  delay_seconds?: number;
  temperature?: number;
  rules_content?: string;
  script_content?: string;
  faq_content?: string;
  company_info?: AIAgentCompanyInfo;
  contract_link?: string;
  activation_triggers?: string[];
  require_activation_trigger?: boolean;
  deactivate_on_human_message?: DeactivateOnHumanMessage;
  deactivate_temporary_minutes?: number;
  audio_enabled?: boolean;
  audio_respond_with_audio?: boolean;
  audio_always_respond_audio?: boolean;
  voice_name?: string;
  speech_speed?: number;
  audio_temperature?: number;
  language_code?: string;
  message_batch_seconds?: number;
  split_response_enabled?: boolean;
  split_message_delay_seconds?: number;
}

// Limite de caracteres
export const AI_AGENT_CHAR_LIMITS = {
  rules: 5000,
  script: 7000,
  faq: 3000,
  total: 15000,
} as const;

// Delay options
export const AI_AGENT_DELAY_OPTIONS = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 20, label: '20s ★' },
  { value: 30, label: '30s' },
  { value: 45, label: '45s' },
  { value: 60, label: '60s' },
] as const;

// Batching options (debounce time for message grouping)
export const AI_AGENT_BATCH_OPTIONS = [
  { value: 30, label: '30s' },
  { value: 45, label: '45s' },
  { value: 60, label: '60s' },
  { value: 75, label: '75s ★' },
  { value: 90, label: '90s' },
  { value: 120, label: '2 min' },
] as const;

// Split message delay options (time between each split message)
export const AI_AGENT_SPLIT_DELAY_OPTIONS = [
  { value: 1.0, label: '1.0s' },
  { value: 1.5, label: '1.5s' },
  { value: 2.0, label: '2.0s ★' },
  { value: 2.5, label: '2.5s' },
  { value: 3.0, label: '3.0s' },
] as const;
