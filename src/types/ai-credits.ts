// =====================================================
// TIPOS DO SISTEMA DE CRÉDITOS DE IA
// =====================================================

export type CreditType = 'standard_text' | 'advanced_text' | 'standard_audio' | 'advanced_audio';
export type TransactionType = 'purchase' | 'usage' | 'auto_recharge' | 'refund';
export type AIModelType = 'standard' | 'advanced';

// Credit balances interface
export interface AICredits {
  standard_text: number;
  advanced_text: number;
  standard_audio: number;
  advanced_audio: number;
  auto_recharge_enabled: boolean;
  auto_recharge_threshold: number;
  auto_recharge_types?: string[];
}

// Transaction record interface
export interface AITransaction {
  id: string;
  company_id: string;
  transaction_type: TransactionType;
  credit_type: CreditType;
  tokens_amount: number;
  tokens_balance_after: number;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  amount_paid_cents?: number;
  function_name?: string;
  input_tokens?: number;
  output_tokens?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// Auto-recharge settings
export interface AutoRechargeSettings {
  companyId: string;
  enabled: boolean;
  threshold: number;
  types: CreditType[];
}

// Credit type configuration
export interface CreditTypeConfig {
  type: CreditType;
  label: string;
  description: string;
  price: string;
  priceValue: number;
  tokens: number;
  category: 'text' | 'audio';
  features: string[];
}

// Credit types with full configuration
export const AI_CREDIT_TYPES: Record<CreditType, CreditTypeConfig> = {
  standard_text: {
    type: 'standard_text',
    label: 'IA Padrão',
    description: 'Modelo padrão para todas as funções de IA',
    price: 'R$ 10,00',
    priceValue: 1000,
    tokens: 1_000_000,
    category: 'text',
    features: [
      'Correção de texto e gramática',
      'Transcrição de áudio',
      'Análise de mídias (imagens, vídeos, documentos)',
      'Resumo de conversas',
      'Gerente Comercial',
      'Agente de IA (opção padrão)',
    ],
  },
  advanced_text: {
    type: 'advanced_text',
    label: 'IA Avançada',
    description: 'Modelo avançado para agentes de IA complexos',
    price: 'R$ 30,00',
    priceValue: 3000,
    tokens: 1_000_000,
    category: 'text',
    features: [
      'Melhor desempenho em conversas complexas',
      'Raciocínio avançado e nuances',
      'Compreensão superior de contexto',
      'Recomendado para atendimentos complexos',
      'Disponível apenas para Agente de IA',
    ],
  },
  standard_audio: {
    type: 'standard_audio',
    label: 'IA Padrão para Áudio',
    description: 'Geração de áudio padrão para respostas do agente',
    price: 'R$ 60,00',
    priceValue: 6000,
    tokens: 1_000_000,
    category: 'audio',
    features: [
      'Geração de áudio em tempo real',
      'Múltiplas vozes disponíveis',
      'Velocidade e entonação configuráveis',
      'Qualidade padrão de áudio',
    ],
  },
  advanced_audio: {
    type: 'advanced_audio',
    label: 'IA Avançada para Áudio',
    description: 'Qualidade superior de voz com entonação mais natural',
    price: 'R$ 120,00',
    priceValue: 12000,
    tokens: 1_000_000,
    category: 'audio',
    features: [
      'Qualidade superior de áudio',
      'Entonação mais natural e expressiva',
      'Melhor para conversas longas',
      'Vozes com maior naturalidade',
    ],
  },
} as const;

// Model type labels for display
export const AI_MODEL_LABELS: Record<AIModelType, string> = {
  standard: 'IA Padrão',
  advanced: 'IA Avançada',
};
