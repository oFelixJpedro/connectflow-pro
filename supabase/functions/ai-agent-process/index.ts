import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";

// ═══════════════════════════════════════════════════════════════════
// IMPORT SHARED MODULES
// ═══════════════════════════════════════════════════════════════════
import {
  sha256,
  getCachedAnalysis,
  saveCacheAnalysis,
  SUPPORTED_VIDEO_MIMES,
  SUPPORTED_DOCUMENT_MIMES,
  inferMimeTypeFromFileName
} from "../_shared/media-cache.ts";

import {
  analyzeMedia,
  transcribeAudioWithFileAPI,
  analyzeImageWithFileAPI,
  analyzeVideoWithFileAPI,
  analyzeDocumentWithFileAPI,
  inferMediaType
} from "../_shared/gemini-file-api.ts";

import {
  logAIUsage,
  extractGeminiUsage,
  GEMINI_PRICING,
  isAudioContent
} from "../_shared/usage-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Redis client for idempotency
let redis: Redis | null = null;
try {
  const redisUrl = Deno.env.get('UPSTASH_REDIS_URL');
  const redisToken = Deno.env.get('UPSTASH_REDIS_TOKEN');
  if (redisUrl && redisToken) {
    redis = new Redis({ url: redisUrl, token: redisToken });
  }
} catch (e) {
  console.log('⚠️ Redis not configured for ai-agent-process');
}

// Helper to create idempotency key from batch
function createBatchHash(conversationId: string, messages: any[]): string {
  const content = messages.map(m => `${m.type}:${m.content || m.mediaUrl || ''}`).join('|');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `ai-process:${conversationId}:${Math.abs(hash).toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════
// COPY MEDIA TO PUBLIC BUCKET FOR PERMANENT URLs
// ═══════════════════════════════════════════════════════════════════
async function copyMediaToPublicBucket(
  supabase: any,
  privateUrl: string,
  agentId: string,
  mediaKey: string,
  mimeType?: string
): Promise<string | null> {
  try {
    console.log(`📋 Copiando mídia para bucket público: ${mediaKey}`);
    
    if (privateUrl.includes('/whatsapp-media/') && !privateUrl.includes('token=')) {
      console.log(`✅ Mídia já está no bucket público`);
      return privateUrl;
    }
    
    const response = await fetch(privateUrl);
    if (!response.ok) {
      console.error(`❌ Erro ao baixar mídia: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const contentType = mimeType || response.headers.get('content-type') || 'application/octet-stream';
    
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
      'application/pdf': 'pdf', 'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    const ext = extMap[contentType] || contentType.split('/')[1] || 'bin';
    const uniquePath = `ai-agent/${agentId}/${mediaKey}-${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage
      .from('whatsapp-media')
      .upload(uniquePath, new Uint8Array(arrayBuffer), {
        contentType,
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Erro ao fazer upload para bucket público:`, error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uniquePath);
    
    console.log(`✅ Mídia copiada para bucket público: ${publicUrl}`);
    return publicUrl;
  } catch (e) {
    console.error(`❌ Erro ao copiar mídia:`, e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// STRUCTURED CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════
interface LeadInfo {
  nome?: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  estado?: string;
  idade?: string;
  profissao?: string;
  [key: string]: string | undefined;
}

interface ConversationContext {
  lead: LeadInfo;
  interesse: {
    principal?: string;
    secundarios?: string[];
    detalhes?: string;
  };
  qualificacao: {
    perguntas_respondidas: string[];
    informacoes_pendentes: string[];
    nivel?: 'frio' | 'morno' | 'quente';
  };
  situacao: {
    problema_relatado?: string;
    urgencia?: 'baixa' | 'media' | 'alta';
    expectativas?: string;
  };
  objecoes: string[];
  historico_resumido: string[];
  acoes_executadas: string[];
  ultima_atualizacao: string;
}

function createEmptyContext(): ConversationContext {
  return {
    lead: {},
    interesse: {},
    qualificacao: {
      perguntas_respondidas: [],
      informacoes_pendentes: []
    },
    situacao: {},
    objecoes: [],
    historico_resumido: [],
    acoes_executadas: [],
    ultima_atualizacao: new Date().toISOString()
  };
}

function mergeContext(existing: ConversationContext, newInfo: Partial<ConversationContext>): ConversationContext {
  const merged = { ...existing };
  
  if (newInfo.lead) {
    merged.lead = { ...merged.lead };
    for (const [key, value] of Object.entries(newInfo.lead)) {
      if (value && value.trim()) {
        merged.lead[key] = value;
      }
    }
  }
  
  if (newInfo.interesse) {
    merged.interesse = { ...merged.interesse };
    if (newInfo.interesse.principal) {
      merged.interesse.principal = newInfo.interesse.principal;
    }
    if (newInfo.interesse.secundarios?.length) {
      const existing = merged.interesse.secundarios || [];
      merged.interesse.secundarios = [...new Set([...existing, ...newInfo.interesse.secundarios])];
    }
    if (newInfo.interesse.detalhes) {
      merged.interesse.detalhes = newInfo.interesse.detalhes;
    }
  }
  
  if (newInfo.qualificacao) {
    merged.qualificacao = { ...merged.qualificacao };
    if (newInfo.qualificacao.perguntas_respondidas?.length) {
      merged.qualificacao.perguntas_respondidas = [
        ...new Set([...merged.qualificacao.perguntas_respondidas, ...newInfo.qualificacao.perguntas_respondidas])
      ];
    }
    if (newInfo.qualificacao.informacoes_pendentes?.length) {
      const answered = new Set(merged.qualificacao.perguntas_respondidas);
      merged.qualificacao.informacoes_pendentes = [
        ...new Set([...merged.qualificacao.informacoes_pendentes, ...newInfo.qualificacao.informacoes_pendentes])
      ].filter(p => !answered.has(p));
    }
    if (newInfo.qualificacao.nivel) {
      merged.qualificacao.nivel = newInfo.qualificacao.nivel;
    }
  }
  
  if (newInfo.situacao) {
    merged.situacao = { ...merged.situacao, ...newInfo.situacao };
  }
  
  if (newInfo.objecoes?.length) {
    merged.objecoes = [...new Set([...merged.objecoes, ...newInfo.objecoes])];
  }
  
  if (newInfo.historico_resumido?.length) {
    merged.historico_resumido = [...merged.historico_resumido, ...newInfo.historico_resumido].slice(-20);
  }
  
  if (newInfo.acoes_executadas?.length) {
    merged.acoes_executadas = [...merged.acoes_executadas, ...newInfo.acoes_executadas];
  }
  
  merged.ultima_atualizacao = new Date().toISOString();
  
  return merged;
}

function formatContextForPrompt(context: ConversationContext): string {
  const parts: string[] = [];
  
  const leadEntries = Object.entries(context.lead).filter(([_, v]) => v);
  if (leadEntries.length > 0) {
    parts.push('### INFORMAÇÕES DO LEAD (já coletadas - NÃO pergunte novamente):');
    for (const [key, value] of leadEntries) {
      parts.push(`- ${key}: ${value}`);
    }
  }
  
  if (context.interesse.principal) {
    parts.push(`\n### INTERESSE IDENTIFICADO:`);
    parts.push(`- Principal: ${context.interesse.principal}`);
    if (context.interesse.secundarios?.length) {
      parts.push(`- Secundários: ${context.interesse.secundarios.join(', ')}`);
    }
    if (context.interesse.detalhes) {
      parts.push(`- Detalhes: ${context.interesse.detalhes}`);
    }
  }
  
  if (context.qualificacao.perguntas_respondidas.length > 0 || context.qualificacao.nivel) {
    parts.push(`\n### QUALIFICAÇÃO:`);
    if (context.qualificacao.nivel) {
      parts.push(`- Nível: ${context.qualificacao.nivel}`);
    }
    if (context.qualificacao.perguntas_respondidas.length > 0) {
      parts.push(`- Já respondeu sobre: ${context.qualificacao.perguntas_respondidas.join(', ')}`);
    }
    if (context.qualificacao.informacoes_pendentes.length > 0) {
      parts.push(`- Ainda precisa responder: ${context.qualificacao.informacoes_pendentes.join(', ')}`);
    }
  }
  
  if (context.situacao.problema_relatado || context.situacao.urgencia) {
    parts.push(`\n### SITUAÇÃO:`);
    if (context.situacao.problema_relatado) {
      parts.push(`- Problema: ${context.situacao.problema_relatado}`);
    }
    if (context.situacao.urgencia) {
      parts.push(`- Urgência: ${context.situacao.urgencia}`);
    }
    if (context.situacao.expectativas) {
      parts.push(`- Expectativas: ${context.situacao.expectativas}`);
    }
  }
  
  // Limit objections to 5 items (optimization)
  if (context.objecoes.length > 0) {
    parts.push(`\n### OBJEÇÕES LEVANTADAS:`);
    for (const objecao of context.objecoes.slice(-5)) {
      parts.push(`- ${objecao.length > 150 ? objecao.substring(0, 150) + '...' : objecao}`);
    }
  }
  
  // Limit history summary to 3 items (optimization - reduced from 5)
  if (context.historico_resumido.length > 0) {
    parts.push(`\n### RESUMO DA CONVERSA (últimas interações):`);
    for (const item of context.historico_resumido.slice(-3)) {
      parts.push(`- ${item.length > 100 ? item.substring(0, 100) + '...' : item}`);
    }
  }
  
  return parts.length > 0 ? parts.join('\n') : '';
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION PROMPT
// ═══════════════════════════════════════════════════════════════════
function buildExtractionPrompt(userMessage: string, aiResponse: string, existingContext: ConversationContext): string {
  return `Você é um extrator de informações. Analise a mensagem do cliente e a resposta do agente para extrair NOVAS informações relevantes.

MENSAGEM DO CLIENTE:
"${userMessage}"

RESPOSTA DO AGENTE:
"${aiResponse}"

CONTEXTO EXISTENTE (já coletado anteriormente):
${JSON.stringify(existingContext, null, 2)}

EXTRAIA APENAS INFORMAÇÕES NOVAS que NÃO estão no contexto existente. Retorne um JSON com a estrutura abaixo, incluindo APENAS campos com valores novos:

{
  "lead": {
    "nome": "string ou null",
    "telefone": "string ou null",
    "email": "string ou null",
    "cidade": "string ou null",
    "estado": "string ou null",
    "idade": "string ou null",
    "profissao": "string ou null"
  },
  "interesse": {
    "principal": "string ou null (ex: salario-maternidade, bpc-loas, aposentadoria)",
    "secundarios": ["array de strings ou vazio"],
    "detalhes": "string ou null"
  },
  "qualificacao": {
    "perguntas_respondidas": ["lista de tópicos que o cliente respondeu nesta mensagem"],
    "informacoes_pendentes": ["lista de informações que ainda precisam ser coletadas"],
    "nivel": "frio, morno ou quente (baseado no engajamento)"
  },
  "situacao": {
    "problema_relatado": "string ou null",
    "urgencia": "baixa, media ou alta",
    "expectativas": "string ou null"
  },
  "objecoes": ["lista de objeções ou preocupações mencionadas"],
  "historico_resumido": ["uma frase resumindo esta interação"]
}

REGRAS:
1. Extraia APENAS informações NOVAS mencionadas nesta interação
2. NÃO repita informações já presentes no contexto existente
3. Para arrays, inclua apenas novos itens
4. Se não houver nova informação para um campo, omita-o ou use null/array vazio
5. O historico_resumido deve ter UMA frase curta resumindo o que aconteceu nesta interação
6. Seja preciso e objetivo

Retorne APENAS o JSON, sem explicações.`;
}

// ═══════════════════════════════════════════════════════════════════
// ANALYZE MEDIA WITH GEMINI FILE API (replaces URL Context Tool)
// ═══════════════════════════════════════════════════════════════════
async function analyzeMediaWithFileAPI(
  supabase: any,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'document',
  companyId: string,
  apiKey: string,
  contextPrompt: string,
  fileName?: string
): Promise<string | null> {
  try {
    console.log(`🔍 [FILE_API] Analisando ${mediaType}: ${mediaUrl.substring(0, 60)}...`);
    
    let prompt = contextPrompt;
    if (!prompt) {
      switch (mediaType) {
        case 'image':
          prompt = 'Descreva esta imagem de forma concisa para contexto de atendimento ao cliente.';
          break;
        case 'video':
          prompt = 'Descreva este vídeo de forma concisa. Inclua ações, objetos, pessoas e áudio se houver.';
          break;
        case 'document':
          prompt = `Extraia as informações relevantes deste documento${fileName ? ` "${fileName}"` : ''} para atendimento ao cliente.`;
          break;
      }
    }
    
    // Usa o novo módulo Gemini File API
    const result = await analyzeMedia(
      mediaUrl,
      inferMimeTypeFromFileName(fileName || mediaUrl) || 
        (mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'application/pdf'),
      prompt,
      apiKey,
      supabase,
      companyId,
      `${mediaType}-analysis`
    );
    
    if (result.error) {
      console.error(`❌ [FILE_API] Erro: ${result.error}`);
      return null;
    }
    
    if (result.fromCache) {
      console.log(`✅ [FILE_API] Cache HIT para ${mediaType}`);
    } else {
      console.log(`✅ [FILE_API] Análise obtida via File API (${result.analysis?.length || 0} chars)`);
    }
    
    return result.analysis;
  } catch (error) {
    console.error(`❌ [FILE_API] Erro ao analisar ${mediaType}:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// RAG: SEARCH KNOWLEDGE BASE WITH SEMANTIC SEARCH
// ═══════════════════════════════════════════════════════════════════
async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] }
        })
      }
    );

    if (!response.ok) return null;
    const result = await response.json();
    return result.embedding?.values || null;
  } catch (error) {
    console.error('❌ Error generating query embedding:', error);
    return null;
  }
}

async function searchAgentKnowledgeBase(
  supabase: any,
  agentId: string,
  queryText: string,
  apiKey: string,
  limit: number = 3,
  minSimilarity: number = 0.65
): Promise<string[]> {
  try {
    console.log('🔍 [RAG] Searching knowledge base for:', queryText.substring(0, 50) + '...');
    
    // Generate embedding for the query
    const embedding = await generateQueryEmbedding(queryText, apiKey);
    if (!embedding) {
      console.log('⚠️ [RAG] Failed to generate query embedding');
      return [];
    }

    // Search using the database function
    const { data: results, error } = await supabase.rpc('search_agent_knowledge', {
      p_agent_id: agentId,
      p_query_embedding: JSON.stringify(embedding),
      p_limit: limit,
      p_min_similarity: minSimilarity
    });

    if (error) {
      console.error('❌ [RAG] Search error:', error);
      return [];
    }

    if (!results || results.length === 0) {
      console.log('📭 [RAG] No relevant knowledge found');
      return [];
    }

    console.log(`✅ [RAG] Found ${results.length} relevant chunks`);
    return results.map((r: any) => r.content);
  } catch (error) {
    console.error('❌ [RAG] Error in knowledge search:', error);
    return [];
  }
}

serve(async (req) => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              🤖 AI AGENT PROCESS (OPTIMIZED)                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    const { 
      connectionId, 
      conversationId, 
      messages,
      messageContent,
      contactName,
      contactPhone,
      messageType,
      mediaUrl
    } = requestBody;

    const isBatchRequest = Array.isArray(messages) && messages.length > 0;
    
    console.log('📥 Input:', { 
      connectionId, 
      conversationId, 
      isBatchRequest,
      messageCount: isBatchRequest ? messages.length : 1,
      contactName 
    });

    if (!connectionId || !conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId and conversationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔒 IDEMPOTENCY CHECK
    // ═══════════════════════════════════════════════════════════════════════════════
    const messagesToProcess = isBatchRequest ? messages : [{ type: messageType || 'text', content: messageContent, mediaUrl }];
    
    // Store idempotency key in outer scope so we can release it in finally block
    let currentIdempotencyKey: string | null = null;
    
    try {
      currentIdempotencyKey = createBatchHash(conversationId, messagesToProcess);
      
      if (redis) {
        try {
          const alreadyProcessing = await redis.get(currentIdempotencyKey);
          if (alreadyProcessing) {
            console.log(`🔒 [IDEMPOTENCY] Batch already being processed: ${currentIdempotencyKey}`);
            return new Response(
              JSON.stringify({ success: true, skip: true, reason: 'Already processing this batch' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          await redis.setex(currentIdempotencyKey, 300, 'processing');
          console.log(`✅ [IDEMPOTENCY] Marked batch as processing: ${currentIdempotencyKey}`);
        } catch (redisError) {
          console.log('⚠️ [IDEMPOTENCY] Redis error, continuing anyway:', redisError);
        }
      }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1️⃣ Find AI agent linked to this connection
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 1️⃣  BUSCAR AGENTE DE IA                                         │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const { data: agentConnection, error: agentConnError } = await supabase
      .from('ai_agent_connections')
      .select(`
        agent_id,
        ai_agents (
          id,
          name,
          status,
          agent_type,
          script_content,
          rules_content,
          faq_content,
          company_info,
          contract_link,
          activation_triggers,
          require_activation_trigger,
          delay_seconds,
          voice_name,
          speech_speed,
          audio_temperature,
          audio_enabled,
          audio_respond_with_audio,
          audio_always_respond_audio,
          language_code,
          paused_until,
          temperature
        )
      `)
      .eq('connection_id', connectionId)
      .maybeSingle();

    if (agentConnError) {
      console.log('❌ Erro ao buscar agente:', agentConnError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error finding agent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agentConnection?.ai_agents) {
      console.log('ℹ️ Nenhum agente vinculado a esta conexão');
      return new Response(
        JSON.stringify({ success: false, skip: true, reason: 'No agent linked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let agent = agentConnection.ai_agents as any;
    let activeSubAgent: any = null;
    console.log('✅ Agente primário encontrado:', agent.name, '| Status:', agent.status);

    // 2️⃣ Check if agent is active
    if (agent.status !== 'active') {
      console.log('ℹ️ Agente não está ativo');
      return new Response(
        JSON.stringify({ success: false, skip: true, reason: 'Agent not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (agent.paused_until) {
      const pausedUntil = new Date(agent.paused_until);
      if (pausedUntil > new Date()) {
        console.log('ℹ️ Agente pausado até:', pausedUntil.toISOString());
        return new Response(
          JSON.stringify({ success: false, skip: true, reason: 'Agent paused' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get company ID early for cache operations
    const { data: connData } = await supabase
      .from('whatsapp_connections')
      .select('company_id')
      .eq('id', connectionId)
      .single();
    
    const companyId = connData?.company_id || '';

    // 3️⃣ Check conversation state
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 2️⃣  VERIFICAR ESTADO DA CONVERSA                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let { data: convState } = await supabase
      .from('ai_conversation_states')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    const isConversationActive = convState?.status === 'active';
    console.log('📋 Estado atual:', convState?.status || 'nenhum');
    console.log('📋 Conversa ativa:', isConversationActive);
    console.log('📋 Sub-agente atual:', convState?.current_sub_agent_id || 'nenhum');

    // 🔄 Load sub-agent if active
    if (convState?.current_sub_agent_id) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 🔄  CARREGANDO SUB-AGENTE                                       │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      const { data: subAgent, error: subAgentError } = await supabase
        .from('ai_agents')
        .select(`
          id,
          name,
          status,
          agent_type,
          script_content,
          rules_content,
          faq_content,
          company_info,
          contract_link,
          temperature
        `)
        .eq('id', convState.current_sub_agent_id)
        .maybeSingle();
      
      if (subAgentError) {
        console.log('⚠️ Erro ao buscar sub-agente:', subAgentError.message);
      } else if (subAgent) {
        if (subAgent.status === 'active') {
          activeSubAgent = subAgent;
          agent = {
            ...agent,
            id: subAgent.id,
            name: subAgent.name,
            script_content: subAgent.script_content || agent.script_content,
            rules_content: subAgent.rules_content || agent.rules_content,
            faq_content: subAgent.faq_content || agent.faq_content,
            company_info: subAgent.company_info || agent.company_info,
            contract_link: subAgent.contract_link || agent.contract_link,
            temperature: subAgent.temperature ?? agent.temperature
          };
          console.log('✅ Sub-agente carregado:', subAgent.name);
          console.log('🆔 Agent ID atualizado para sub-agente:', agent.id);
        } else {
          console.log('⚠️ Sub-agente inativo:', subAgent.name, '| Status:', subAgent.status);
          await supabase
            .from('ai_conversation_states')
            .update({ current_sub_agent_id: null })
            .eq('conversation_id', conversationId);
          console.log('🔄 Voltando para agente primário');
        }
      } else {
        console.log('⚠️ Sub-agente não encontrado, usando agente primário');
      }
    }

    if (isConversationActive) {
      console.log('✅ Conversa já ativada - pulando verificação de trigger');
      
      if (convState.status === 'deactivated_permanently') {
        console.log('ℹ️ IA desativada permanentemente nesta conversa');
        return new Response(
          JSON.stringify({ success: false, skip: true, reason: 'AI deactivated permanently' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (convState.status === 'paused' && convState.paused_until) {
        const pausedUntil = new Date(convState.paused_until);
        if (pausedUntil > new Date()) {
          console.log('ℹ️ IA pausada até:', pausedUntil.toISOString());
          return new Response(
            JSON.stringify({ success: false, skip: true, reason: 'AI paused for conversation' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // 4️⃣ Not active - check trigger
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 3️⃣  VERIFICAR TRIGGERS DE ATIVAÇÃO (1ª MENSAGEM)               │');
      console.log('└─────────────────────────────────────────────────────────────────┘');

      const triggers = agent.activation_triggers || [];
      const requireTrigger = agent.require_activation_trigger === true;

      console.log('📋 Triggers:', triggers);
      console.log('📋 Require trigger:', requireTrigger);

      if (requireTrigger && triggers.length > 0) {
        const messageNormalized = (messageContent || '').toLowerCase().trim();
        const triggered = triggers.some((trigger: string) => 
          messageNormalized.includes(trigger.toLowerCase().trim())
        );

        if (!triggered) {
          console.log('ℹ️ Primeira mensagem não contém trigger - aguardando ativação');
          return new Response(
            JSON.stringify({ success: false, skip: true, reason: 'Waiting for activation trigger' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('✅ Trigger de ativação encontrado! Ativando conversa...');
      }

      // 5️⃣ Create or update state to 'active'
      if (!convState) {
        const { data: newState, error: createError } = await supabase
          .from('ai_conversation_states')
          .insert({
            conversation_id: conversationId,
            agent_id: agent.id,
            status: 'active',
            activated_at: new Date().toISOString(),
            messages_processed: 0
          })
          .select()
          .single();

        if (createError) {
          console.log('❌ Erro ao criar estado:', createError.message);
        } else {
          convState = newState;
          console.log('✅ Estado da conversa criado (ativo)');
        }
      } else {
        await supabase
          .from('ai_conversation_states')
          .update({ 
            status: 'active', 
            activated_at: new Date().toISOString() 
          })
          .eq('conversation_id', conversationId);
        console.log('✅ Estado da conversa atualizado para ativo');
      }
    }

    // 6️⃣ Load conversation history (OPTIMIZED: limit to 15 messages + use summary)
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 4️⃣  CARREGAR HISTÓRICO DA CONVERSA (OTIMIZADO)                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Optimized: Load only last 15 messages instead of 50 (~30% token reduction)
    const { data: historyMessages } = await supabase
      .from('messages')
      .select('content, direction, sender_type, message_type, media_url, created_at, metadata, is_internal_note')
      .eq('conversation_id', conversationId)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: false })
      .limit(15);
    
    // Reverse to get chronological order
    const orderedMessages = historyMessages ? [...historyMessages].reverse() : [];
    
    // Check if conversation has more history and load summary if available
    let historySummary: string | null = null;
    if (orderedMessages.length >= 15) {
      const { data: summaryData } = await supabase
        .from('chat_summaries')
        .select('summary')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (summaryData?.summary) {
        historySummary = summaryData.summary;
        console.log('📋 Using existing conversation summary for context');
      }
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
    
    // Build conversation history with media analysis using URL Context Tool + Cache
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    const documentData: Array<{ url: string; fileName?: string }> = [];

    // Add summary as first message if available (provides context for older messages)
    if (historySummary) {
      conversationHistory.push({
        role: 'assistant',
        content: `[RESUMO DA CONVERSA ANTERIOR: ${historySummary}]`
      });
    }

    // Process ordered messages (last 15)
    for (const msg of orderedMessages) {
      if (!msg.content && !msg.media_url) continue;
      
      const role: 'user' | 'assistant' = msg.direction === 'inbound' ? 'user' : 'assistant';
      let content = msg.content || '';
      
      // Handle media types with Gemini File API
      if (msg.message_type === 'audio' && msg.media_url) {
        const transcription = await transcribeAudioWithFileAPI(
          msg.media_url, 
          GEMINI_API_KEY,
          supabase,
          companyId
        );
        content = transcription || '[Áudio não transcrito]';
      } else if (msg.message_type === 'image' && msg.media_url) {
        imageUrls.push(msg.media_url);
        const analysis = await analyzeMediaWithFileAPI(
          supabase,
          msg.media_url,
          'image',
          companyId,
          GEMINI_API_KEY,
          'Descreva esta imagem de forma concisa para contexto de atendimento.',
        );
        content = analysis 
          ? `[Imagem: ${analysis}]${content ? ` - ${content}` : ''}`
          : content || '[Imagem enviada]';
      } else if (msg.message_type === 'video' && msg.media_url) {
        videoUrls.push(msg.media_url);
        const analysis = await analyzeMediaWithFileAPI(
          supabase,
          msg.media_url,
          'video',
          companyId,
          GEMINI_API_KEY,
          'Descreva este vídeo de forma concisa para contexto de atendimento.',
        );
        content = analysis 
          ? `[Vídeo: ${analysis}]${content ? ` - ${content}` : ''}`
          : content || '[Vídeo enviado]';
      } else if (msg.message_type === 'document' && msg.media_url) {
        const meta = msg.metadata as any;
        const fileName = meta?.fileName || meta?.file_name || 'documento';
        documentData.push({ url: msg.media_url, fileName });
        const analysis = await analyzeMediaWithFileAPI(
          supabase,
          msg.media_url,
          'document',
          companyId,
          GEMINI_API_KEY,
          `Extraia informações relevantes deste documento para atendimento.`,
          fileName
        );
        content = analysis 
          ? `[Documento "${fileName}": ${analysis}]${content ? ` - ${content}` : ''}`
          : content || `[Documento "${fileName}" enviado]`;
      } else if (msg.message_type === 'sticker') {
        content = '[Figurinha enviada]';
      }
      
      if (content) {
        conversationHistory.push({ role, content });
      }
    }
    
    console.log('📚 Histórico processado:', conversationHistory.length, 'mensagens');
    console.log('🖼️ Imagens:', imageUrls.length, '| 🎬 Vídeos:', videoUrls.length, '| 📄 Documentos:', documentData.length);

    // 7️⃣ Process current message(s)
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 5️⃣  PROCESSAR MENSAGEM ATUAL                                    │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let processedMessageContent = '';
    let currentMessageIsImage = false;
    let currentMessageIsAudio = false;
    let currentMessageIsVideo = false;
    let currentMessageIsDocument = false;
    let actualMediaUrl = mediaUrl;
    let currentDocumentFileName = '';

    if (isBatchRequest) {
      const batchContents: string[] = [];
      
      for (const msg of messages) {
        if (msg.type === 'text' && msg.content) {
          batchContents.push(msg.content);
        } else if (msg.type === 'audio') {
          currentMessageIsAudio = true;
          if (msg.mediaUrl) actualMediaUrl = msg.mediaUrl;
          if (msg.content) {
            batchContents.push(msg.content);
          } else if (msg.mediaUrl) {
            const transcription = await transcribeAudioWithFileAPI(
              msg.mediaUrl, 
              GEMINI_API_KEY,
              supabase,
              companyId
            );
            batchContents.push(transcription || '[Áudio recebido]');
          }
        } else if (msg.type === 'image') {
          currentMessageIsImage = true;
          if (msg.mediaUrl) actualMediaUrl = msg.mediaUrl;
          batchContents.push(msg.content ? `[Imagem com legenda]: ${msg.content}` : '[Cliente enviou uma imagem]');
        } else if (msg.type === 'video') {
          currentMessageIsVideo = true;
          if (msg.mediaUrl) actualMediaUrl = msg.mediaUrl;
          batchContents.push(msg.content ? `[Vídeo com legenda]: ${msg.content}` : '[Cliente enviou um vídeo]');
        } else if (msg.type === 'document') {
          currentMessageIsDocument = true;
          if (msg.mediaUrl) actualMediaUrl = msg.mediaUrl;
          currentDocumentFileName = msg.fileName || 'documento';
          batchContents.push(msg.content ? `[Documento "${currentDocumentFileName}"]: ${msg.content}` : `[Cliente enviou documento: ${currentDocumentFileName}]`);
        }
      }
      
      processedMessageContent = batchContents.join('\n');
      
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        currentMessageIsImage = lastMsg.type === 'image';
        currentMessageIsAudio = lastMsg.type === 'audio';
        currentMessageIsVideo = lastMsg.type === 'video';
        currentMessageIsDocument = lastMsg.type === 'document';
        if (lastMsg.mediaUrl) actualMediaUrl = lastMsg.mediaUrl;
        if (lastMsg.fileName) currentDocumentFileName = lastMsg.fileName;
      }
      
      console.log('📦 Batch combined:', processedMessageContent.substring(0, 100) + '...');
    } else {
      processedMessageContent = messageContent || '';
    }
    
    // Get media URL if not provided
    const needsMediaUrl = currentMessageIsImage || currentMessageIsAudio || currentMessageIsVideo || currentMessageIsDocument;
    if (needsMediaUrl && !actualMediaUrl) {
      const { data: latestMsg } = await supabase
        .from('messages')
        .select('media_url, metadata')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .eq('message_type', isBatchRequest ? (messages[messages.length - 1]?.type || 'text') : messageType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestMsg?.media_url) {
        actualMediaUrl = latestMsg.media_url;
        console.log('📎 Media URL obtida do banco:', actualMediaUrl.substring(0, 50) + '...');
        if (currentMessageIsDocument && latestMsg.metadata) {
          const meta = latestMsg.metadata as any;
          currentDocumentFileName = meta?.fileName || meta?.file_name || 'documento';
        }
      }
    }
    
    // Handle audio transcription for current message (legacy mode)
    if (!isBatchRequest && currentMessageIsAudio && actualMediaUrl && !processedMessageContent) {
      console.log('🎤 Transcrevendo áudio do cliente...');
      const transcription = await transcribeAudioWithFileAPI(
        actualMediaUrl, 
        GEMINI_API_KEY,
        supabase,
        companyId
      );
      if (transcription) {
        processedMessageContent = transcription;
        console.log('✅ Transcrição obtida:', transcription.substring(0, 50) + '...');
      } else {
        processedMessageContent = '[Cliente enviou um áudio que não pôde ser transcrito]';
      }
    }

    // Add current image to analysis list
    if (currentMessageIsImage && actualMediaUrl) {
      if (!imageUrls.includes(actualMediaUrl)) {
        imageUrls.push(actualMediaUrl);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // LOAD STRUCTURED CONTEXT FROM METADATA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 📚 CARREGAR CONTEXTO ESTRUTURADO                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    const existingMetadata = (convState?.metadata as Record<string, unknown>) || {};
    let conversationContext: ConversationContext = existingMetadata.context as ConversationContext || createEmptyContext();
    
    if (contactName && !conversationContext.lead.nome) {
      conversationContext.lead.nome = contactName;
    }
    if (contactPhone && !conversationContext.lead.telefone) {
      conversationContext.lead.telefone = contactPhone;
    }
    
    const contextSummary = formatContextForPrompt(conversationContext);
    if (contextSummary) {
      console.log('✅ Contexto carregado:');
      console.log(contextSummary.substring(0, 300) + (contextSummary.length > 300 ? '...' : ''));
    } else {
      console.log('ℹ️ Nenhum contexto estruturado anterior');
    }

    // ═══════════════════════════════════════════════════════════════════
    // LOAD REAL DATA FOR AVAILABLE ACTIONS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🎯 CARREGAR DADOS REAIS PARA AÇÕES                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Load CRM stages
    let availableCrmStages: { id: string; name: string; normalized: string }[] = [];
    const { data: kanbanBoard } = await supabase
      .from('kanban_boards')
      .select('id')
      .eq('whatsapp_connection_id', connectionId)
      .maybeSingle();
    
    if (kanbanBoard) {
      const { data: columns } = await supabase
        .from('kanban_columns')
        .select('id, name, position')
        .eq('board_id', kanbanBoard.id)
        .order('position', { ascending: true });
      
      if (columns) {
        availableCrmStages = columns.map(col => ({
          id: col.id,
          name: col.name,
          normalized: col.name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
        }));
      }
    }
    console.log('📊 Etapas CRM disponíveis:', availableCrmStages.length);

    // Load existing tags
    const connectionCompanyId = companyId;
    let availableTags: string[] = [];
    if (connectionCompanyId) {
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('name')
        .eq('company_id', connectionCompanyId);
      
      if (tagsData && !tagsError) {
        availableTags = tagsData.map(t => t.name).sort();
      } else {
        console.log('⚠️ Erro ao carregar tags:', tagsError?.message);
      }
    }
    console.log('🏷️ Etiquetas disponíveis:', availableTags.length);

    // Load active AI agents (sub-agents)
    let availableAgents: { 
      name: string; 
      description: string | null;
      specialty_keywords: string[];
      qualification_summary: string | null;
      disqualification_signs: string | null;
    }[] = [];
    if (connectionCompanyId) {
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('name, description, specialty_keywords, qualification_summary, disqualification_signs')
        .eq('company_id', connectionCompanyId)
        .eq('status', 'active')
        .neq('id', agent.id);
      
      if (agents) {
        availableAgents = agents.map(a => ({ 
          name: a.name, 
          description: a.description,
          specialty_keywords: a.specialty_keywords || [],
          qualification_summary: a.qualification_summary,
          disqualification_signs: a.disqualification_signs
        }));
      }
    }
    console.log('🤖 Agentes disponíveis:', availableAgents.length);

    // Load departments
    let availableDepartments: { name: string }[] = [];
    const { data: departments } = await supabase
      .from('departments')
      .select('name')
      .eq('whatsapp_connection_id', connectionId)
      .eq('active', true);
    
    if (departments) {
      availableDepartments = departments;
    }
    console.log('🏢 Departamentos disponíveis:', availableDepartments.length);

    // Load available media for this agent
    let availableMedias: { type: string; key: string; description?: string }[] = [];
    const { data: agentMedias } = await supabase
      .from('ai_agent_media')
      .select('media_type, media_key, file_name, media_content')
      .eq('agent_id', agent.id);
    
    if (agentMedias) {
      availableMedias = agentMedias.map(m => ({
        type: m.media_type,
        key: m.media_key,
        description: m.file_name || m.media_content?.substring(0, 50) || undefined
      }));
    }
    console.log('📎 Mídias disponíveis:', availableMedias.length);

    // ═══════════════════════════════════════════════════════════════════
    // BUILD DYNAMIC TOOLS DEFINITION FOR TOOL CALLING
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🔧 CONSTRUIR DEFINIÇÕES DE TOOLS                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const dynamicTools: any[] = [];

    // Tool: mudar_etapa_crm
    if (availableCrmStages.length > 0) {
      dynamicTools.push({
        type: "function",
        name: "mudar_etapa_crm",
        description: "Move o card do cliente para outra etapa no CRM/Kanban. Use quando o lead avançar no funil de vendas.",
        parameters: {
          type: "object",
          properties: {
            stage_name: {
              type: "string",
              enum: availableCrmStages.map(s => s.name),
              description: `Nome EXATO da etapa destino. Opções disponíveis: ${availableCrmStages.map(s => `"${s.name}"`).join(', ')}.`
            }
          },
          required: ["stage_name"]
        }
      });
    }

    // Tool: adicionar_etiqueta
    dynamicTools.push({
      type: "function",
      name: "adicionar_etiqueta",
      description: "Adiciona uma etiqueta ao contato para categorização. Use para marcar o interesse do lead ou status.",
      parameters: {
        type: "object",
        properties: {
          tag_name: {
            type: "string",
            ...(availableTags.length > 0 ? { enum: availableTags } : {}),
            description: availableTags.length > 0 
              ? `Nome da etiqueta. Opções disponíveis: ${availableTags.join(', ')}`
              : "Nome da etiqueta (use nomes sem acentos e em minúsculo, separados por hífen)"
          }
        },
        required: ["tag_name"]
      }
    });

    // Tool: transferir_agente
    if (availableAgents.length > 0) {
      const agentDescriptions = availableAgents.map(a => {
        let desc = `"${a.name}"`;
        if (a.qualification_summary) {
          desc += ` - Especializado em: ${a.qualification_summary.substring(0, 100)}${a.qualification_summary.length > 100 ? '...' : ''}`;
        } else if (a.description) {
          desc += ` - ${a.description}`;
        }
        return desc;
      }).join('; ');

      dynamicTools.push({
        type: "function",
        name: "transferir_agente",
        description: "Transfere a conversa para outro agente de IA especializado. Use quando o lead se encaixa melhor no perfil de outro agente.",
        parameters: {
          type: "object",
          properties: {
            agent_name: {
              type: "string",
              enum: availableAgents.map(a => a.name),
              description: `Nome do agente destino. Opções: ${agentDescriptions}`
            }
          },
          required: ["agent_name"]
        }
      });
    }

    // Tool: atribuir_departamento
    if (availableDepartments.length > 0) {
      dynamicTools.push({
        type: "function",
        name: "atribuir_departamento",
        description: "Atribui a conversa a um departamento específico.",
        parameters: {
          type: "object",
          properties: {
            department_name: {
              type: "string",
              enum: availableDepartments.map(d => d.name),
              description: `Nome do departamento. Opções: ${availableDepartments.map(d => `"${d.name}"`).join(', ')}`
            }
          },
          required: ["department_name"]
        }
      });
    }

    // Tool: transferir_usuario
    dynamicTools.push({
      type: "function",
      name: "transferir_usuario",
      description: "Transfere a conversa para um atendente humano. Use quando o lead precisar de atendimento personalizado ou a IA não puder resolver.",
      parameters: {
        type: "object",
        properties: {
          user_name: {
            type: "string",
            description: "Nome do atendente para transferir a conversa"
          }
        },
        required: ["user_name"]
      }
    });

    // Tool: notificar_equipe
    dynamicTools.push({
      type: "function",
      name: "notificar_equipe",
      description: "Envia uma notificação para a equipe sobre algo importante na conversa.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Mensagem de notificação para a equipe"
          }
        },
        required: ["message"]
      }
    });

    // Tool: desativar_agente
    dynamicTools.push({
      type: "function",
      name: "desativar_agente",
      description: "Desativa o agente de IA permanentemente nesta conversa. Use quando a conversa precisar continuar apenas com humanos.",
      parameters: {
        type: "object",
        properties: {}
      }
    });

    // Tool: atribuir_origem
    dynamicTools.push({
      type: "function",
      name: "atribuir_origem",
      description: "Define a origem/canal de onde veio o lead (ex: Instagram, Google, Indicação).",
      parameters: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            description: "Nome da origem do lead"
          }
        },
        required: ["origin"]
      }
    });

    console.log('🔧 Tools definidas:', dynamicTools.length);
    console.log('   - Ferramentas:', dynamicTools.map(t => t.name).join(', '));

    // Build system prompt
    const companyInfo = agent.company_info || {};
    const isFirstInteraction = (convState?.messages_processed || 0) === 0;
    const isUsingSubAgent = activeSubAgent !== null;
    
    let systemPrompt = `Você é ${agent.name}, um assistente virtual de atendimento ao cliente.

`;

    if (agent.script_content) {
      systemPrompt += `## FLUXO DE ATENDIMENTO
${agent.script_content}

`;
    }

    if (agent.rules_content) {
      systemPrompt += `## DIRETRIZES DO AGENTE
${agent.rules_content}

`;
    }

    if (agent.faq_content) {
      systemPrompt += `## PERGUNTAS FREQUENTES (FAQ)
${agent.faq_content}

`;
    }

    // Add knowledge base content (static)
    if (agent.knowledge_base_content) {
      systemPrompt += `## 📖 BASE DE CONHECIMENTO
${agent.knowledge_base_content}

`;
    }

    // RAG: Search for relevant knowledge from documents
    const GEMINI_API_KEY_RAG = Deno.env.get('GEMINI_API_KEY');
    if (GEMINI_API_KEY_RAG && processedMessageContent) {
      const relevantKnowledge = await searchAgentKnowledgeBase(
        supabase,
        agent.id,
        processedMessageContent,
        GEMINI_API_KEY_RAG,
        3,
        0.65
      );

      if (relevantKnowledge.length > 0) {
        systemPrompt += `## 📚 CONHECIMENTO RELEVANTE (extraído de documentos)
${relevantKnowledge.map((k, i) => `[${i + 1}] ${k}`).join('\n\n')}

Use estas informações para responder ao cliente se forem relevantes para a pergunta.

`;
        console.log(`📚 [RAG] Added ${relevantKnowledge.length} knowledge chunks to prompt`);
      }
    }

    if (Object.keys(companyInfo).length > 0) {
      systemPrompt += `## INFORMAÇÕES DA EMPRESA
`;
      for (const [key, value] of Object.entries(companyInfo)) {
        if (value) systemPrompt += `- ${key}: ${value}\n`;
      }
      systemPrompt += '\n';
    }

    if (agent.contract_link) {
      systemPrompt += `## 📄 LINK DO CONTRATO
O link do contrato para enviar ao cliente é: ${agent.contract_link}

`;
    }

    if (contextSummary) {
      systemPrompt += `## 🧠 MEMÓRIA DA CONVERSA (INFORMAÇÕES JÁ COLETADAS - NÃO PERGUNTE NOVAMENTE)
${contextSummary}

`;
    }

    if (isUsingSubAgent) {
      systemPrompt += `## ℹ️ CONTEXTO DO SUB-AGENTE
Você é um agente especializado (${agent.name}). O cliente foi transferido para você por outro agente.
Continue o atendimento de forma natural, sem repetir saudações extensas.

`;
    }

    systemPrompt += `## 🎯 AÇÕES DISPONÍVEIS (use ferramentas de função quando aplicável)

### ETAPAS CRM (para mover o lead no funil):
${availableCrmStages.length > 0 
  ? availableCrmStages.map(s => `- "${s.name}"`).join('\n')
  : '- (Nenhuma etapa configurada)'}

### ETIQUETAS (para marcar interesse/categoria):
${availableTags.length > 0 
  ? availableTags.map(t => `- "${t}"`).join('\n')
  : '- (Nenhuma etiqueta cadastrada - você pode criar novas)'}

### AGENTES ESPECIALIZADOS (para /transferir_agente):
${availableAgents.length > 0 
  ? availableAgents.map(a => {
    const parts = [`- **${a.name}**`];
    if (a.specialty_keywords?.length) {
      parts.push(`  - Palavras-chave: ${a.specialty_keywords.join(', ')}`);
    }
    if (a.qualification_summary) {
      parts.push(`  - Se encaixa quando: ${a.qualification_summary}`);
    }
    if (a.disqualification_signs) {
      parts.push(`  - **NÃO se encaixa se**: ${a.disqualification_signs}`);
    }
    return parts.join('\n');
  }).join('\n\n')
  : '- (Nenhum agente adicional)'}

${availableAgents.length > 0 ? `
⚠️ REGRAS DE REDIRECIONAMENTO INTELIGENTE:
1. Se o lead mencionar palavras-chave de outro agente, considere transferir
2. Se o lead NÃO se encaixa no seu perfil mas se encaixa em outro, transfira com: /transferir_agente:Nome do Agente
3. Antes de transferir, confirme com o lead se ele tem interesse no outro serviço
4. Ao transferir, explique brevemente ao lead que há um especialista para o caso dele
` : ''}

### DEPARTAMENTOS (para /atribuir_departamento):
${availableDepartments.length > 0 
  ? availableDepartments.map(d => `- "${d.name}"`).join('\n')
  : '- (Nenhum departamento configurado)'}

### 📎 MÍDIAS DISPONÍVEIS (para enviar ao cliente):
${availableMedias.length > 0 
  ? availableMedias.map(m => `- {{${m.type}:${m.key}}}${m.description ? ` → ${m.description}` : ''}`).join('\n')
  : '- (Nenhuma mídia cadastrada)'}

⚠️ REGRAS PARA MÍDIAS (CRÍTICO):
- Para enviar uma mídia ao cliente, use EXATAMENTE a tag: {{tipo:chave}}
- NUNCA use placeholders como [LINK], [LINK_CONTRATO], [LINK_DO_VÍDEO], [VÍDEO], etc.
- Se o roteiro mencionar "enviar vídeo", "enviar contrato" ou similar, USE A TAG DA MÍDIA CORRESPONDENTE
- A mídia será enviada AUTOMATICAMENTE como um arquivo separado para o cliente
- NUNCA descreva ou comente sobre o arquivo - apenas inclua a tag na sua resposta

CRÍTICO SOBRE COMANDOS:
- Use APENAS os nomes listados acima - eles existem no sistema
- Se a etapa, etiqueta ou agente NÃO estiver na lista, NÃO tente usar
- Para etiquetas: use nomes SEM acentos e em minúsculo (ex: salario-maternidade)

## REGRAS CRÍTICAS (OBRIGATÓRIAS)
1. ${isFirstInteraction ? 'Esta é a primeira interação - você pode se apresentar e cumprimentar' : 'NUNCA repita saudações como "Prazer em te conhecer" ou "Olá, tudo bem?" - a conversa já está em andamento'}
2. ${conversationContext.lead.nome ? `VOCÊ JÁ SABE que o nome do cliente é ${conversationContext.lead.nome} - NÃO pergunte novamente` : isFirstInteraction ? 'Pergunte o nome do cliente se ainda não sabe' : 'NÃO pergunte o nome do cliente novamente - você já sabe que é ' + (contactName || 'Cliente')}
3. CONSULTE A SEÇÃO "MEMÓRIA DA CONVERSA" acima - NÃO repita perguntas sobre informações já coletadas
4. Continue de onde parou - se fez uma pergunta, aguarde a resposta antes de fazer outra
5. Se o cliente já respondeu algo, USE essa informação - não pergunte novamente
6. Use conectores naturais como: "Certo", "Entendi", "Perfeito", "Tudo bem"
7. Faça apenas UMA pergunta por mensagem - aguarde a resposta antes de prosseguir

## 🚫 REGRAS ANTI-REPETIÇÃO (CRÍTICO)
1. NUNCA use "Perfeito" mais de 2 vezes na mesma conversa - VARIE suas confirmações
2. Alternativas para "Perfeito": "Certo", "Entendi", "Anotei", "Combinado", "Ótimo", "Tudo certo", "Beleza"
3. NUNCA confirme informações que o cliente ACABOU de dar claramente - é redundante
4. Mantenha respostas em UMA ÚNICA mensagem - não fragmente em múltiplas mensagens curtas
5. NUNCA repita a mesma estrutura de frase em mensagens consecutivas
6. Seja CONCISO - evite verbosidade desnecessária

## 🛑 REGRAS DE ENCERRAMENTO (CRÍTICO)
1. Quando o cliente CONFIRMAR o agendamento/contrato/ação final, ENCERRE a conversa
2. Após confirmação final: agradeça brevemente e diga que a equipe entrará em contato
3. EXECUTE /desativar_agente IMEDIATAMENTE após a despedida final
4. NÃO faça perguntas adicionais após o cliente confirmar que pode encerrar

## INSTRUÇÕES GERAIS
1. Responda de forma natural e humana - evite parecer robótico ou repetitivo
2. Seja objetivo e direto - vá direto ao ponto
3. Use emojis com MODERAÇÃO (máximo 2-3 por mensagem)
4. Se não souber responder algo específico, direcione para um atendente humano
5. Nunca invente informações - use apenas o que está no fluxo, diretrizes e FAQ
6. Mantenha o tom profissional mas acolhedor
7. Se o cliente enviar uma imagem, vídeo ou documento, ANALISE o conteúdo e responda de forma contextualizada
8. VARIE seu vocabulário - não use as mesmas palavras repetidamente`;

    console.log('📝 System prompt criado (' + systemPrompt.length + ' chars)');
    console.log('📝 Histórico:', conversationHistory.length, 'mensagens');

    const agentTemperature = agent.temperature ?? 1.0;
    console.log('🌡️ Temperatura configurada:', agentTemperature);

    let aiResponse: string = '';
    let modelUsed: string = 'gemini-3-flash-preview';
    let toolCallsFromApi: any[] = [];

    // Determine if we should use multimodal analysis (image, video or document)
    const shouldUseMultimodalImage = currentMessageIsImage && actualMediaUrl;
    const shouldUseMultimodalVideo = currentMessageIsVideo && actualMediaUrl;
    const shouldUseMultimodalDocument = currentMessageIsDocument && actualMediaUrl;
    const shouldUseMultimodal = shouldUseMultimodalImage || shouldUseMultimodalVideo || shouldUseMultimodalDocument;

    if (shouldUseMultimodal) {
      modelUsed = 'gemini-3-flash-preview';
      
      const historyText = conversationHistory.map((m: any) => 
        `${m.role === 'user' ? '[CLIENTE]' : '[AGENTE]'}: ${m.content}`
      ).join('\n');
      
      // Use Gemini File API for multimodal analysis
      const mediaType = shouldUseMultimodalImage ? 'image' : shouldUseMultimodalVideo ? 'video' : 'document';
      console.log(`📡 Usando Gemini File API para análise de ${mediaType}`);
      
      const mediaAnalysis = await analyzeMediaWithFileAPI(
        supabase,
        actualMediaUrl,
        mediaType as 'image' | 'video' | 'document',
        companyId,
        GEMINI_API_KEY,
        `Analise esta mídia no contexto de atendimento ao cliente.`,
        currentDocumentFileName || undefined
      );
      
      if (mediaAnalysis) {
        // Build prompt with analysis result
        const mediaContext = shouldUseMultimodalImage 
          ? `[Imagem analisada: ${mediaAnalysis}]`
          : shouldUseMultimodalVideo
          ? `[Vídeo analisado: ${mediaAnalysis}]`
          : `[Documento "${currentDocumentFileName}" analisado: ${mediaAnalysis}]`;
        
        const fullPrompt = `${systemPrompt}

Histórico da conversa:
${historyText}

[CLIENTE]: ${mediaContext}${processedMessageContent ? ` - Mensagem: "${processedMessageContent}"` : ''}

Gere a resposta do atendente. Se precisar executar ações (mover no CRM, adicionar etiqueta, etc), use as ferramentas disponíveis:`;

        // Convert tools to Gemini format
        const geminiTools = dynamicTools.length > 0 ? [{
          function_declarations: dynamicTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }))
        }] : undefined;

        const requestBody: any = {
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: agentTemperature,
            maxOutputTokens: 4096
          }
        };

        if (geminiTools) {
          requestBody.tools = geminiTools;
          requestBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
        }

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );

        if (geminiResponse.ok) {
          const aiData = await geminiResponse.json();
          const candidate = aiData.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          
          for (const part of parts) {
            if (part.text) {
              aiResponse = part.text.trim();
            }
            if (part.functionCall) {
              console.log(`🔧 Function call encontrado: ${part.functionCall.name}`, part.functionCall.args);
              toolCallsFromApi.push({
                name: part.functionCall.name,
                arguments: part.functionCall.args || {}
              });
            }
          }
        } else {
          console.log('❌ Erro na resposta multimodal com URL Context Tool:', geminiResponse.status);
        }
      } else {
        console.log('⚠️ Análise de mídia falhou, usando fallback texto');
        const fallbackContent = shouldUseMultimodalImage ? '[Cliente enviou uma imagem que não pôde ser analisada]' :
                               shouldUseMultimodalVideo ? '[Cliente enviou um vídeo que não pôde ser analisado]' :
                               `[Cliente enviou documento "${currentDocumentFileName}" que não pôde ser analisado]`;
        processedMessageContent = fallbackContent + (processedMessageContent ? ` - Mensagem do cliente: ${processedMessageContent}` : '');
      }
    }
    
    // If multimodal didn't produce a response, use text-only
    if (!aiResponse) {
      console.log('📝 Usando Gemini 3 Flash Preview com Function Calling');
      console.log('🔧 Tools disponíveis:', dynamicTools.length);
      modelUsed = 'gemini-3-flash-preview';
      
      const conversationContextForPrompt = conversationHistory
        .filter(msg => msg !== null)
        .map(msg => `${msg!.role === 'assistant' ? '[ATENDENTE]' : '[CLIENTE]'}: ${msg!.content}`)
        .join('\n');
      
      const fullPrompt = `${systemPrompt}

Histórico da conversa:
${conversationContextForPrompt}

[CLIENTE]: ${processedMessageContent || '[Mensagem sem texto]'}

Gere a resposta do atendente. Se precisar executar ações (mover no CRM, adicionar etiqueta, etc), use as ferramentas disponíveis:`;
      
      // Convert tools to Gemini format
      const geminiTools = dynamicTools.length > 0 ? [{
        function_declarations: dynamicTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }] : undefined;
      
      const requestBody: any = {
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: agentTemperature,
          maxOutputTokens: 4096
        }
      };

      if (geminiTools) {
        requestBody.tools = geminiTools;
        requestBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
      }
      
      const aiStartTime = Date.now();
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );
      const aiProcessingTime = Date.now() - aiStartTime;

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.log('❌ Gemini error:', geminiResponse.status, errorText);
        
        await supabase.from('ai_agent_logs').insert({
          agent_id: agent.id,
          conversation_id: conversationId,
          action_type: 'response_error',
          input_text: processedMessageContent,
          error_message: `Gemini API error: ${geminiResponse.status}`,
          metadata: { errorDetails: errorText, toolsCount: dynamicTools.length }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'AI API error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await geminiResponse.json();
      console.log('📦 Resposta Gemini (texto + tools):', JSON.stringify(aiData, null, 2).substring(0, 500) + '...');
      
      // Log AI usage
      const usage = extractGeminiUsage(aiData);
      logAIUsage(
        supabase,
        companyId,
        'ai-agent-process',
        'gemini-3-flash-preview',
        usage.inputTokens,
        usage.outputTokens,
        aiProcessingTime,
        { 
          agentId: agent.id,
          conversationId,
          hasTools: dynamicTools.length > 0
        },
        false // Text-based agent processing, audio is transcribed separately
      ).catch(err => console.error('[UsageTracker] Error:', err));
      
      const candidate = aiData.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      
      for (const part of parts) {
        if (part.text) {
          aiResponse = part.text.trim();
        }
        if (part.functionCall) {
          console.log(`🔧 Function call encontrado: ${part.functionCall.name}`, part.functionCall.args);
          toolCallsFromApi.push({
            name: part.functionCall.name,
            arguments: part.functionCall.args || {}
          });
        }
      }
      
      if (toolCallsFromApi.length > 0) {
        console.log('🔧 Tool calls encontrados:', toolCallsFromApi.length);
      }
      
      // Retry with lower temperature if empty
      if (!aiResponse) {
        console.log('⚠️ Resposta texto vazia - tentando retry com temperatura 0.5');
        const retryResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 1500 }
            })
          }
        );
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          console.log('🔄 Retry texto result:', JSON.stringify(retryData, null, 2).substring(0, 500) + '...');
          aiResponse = retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          
          // Log retry usage
          const retryUsage = extractGeminiUsage(retryData);
          logAIUsage(
            supabase, companyId, 'ai-agent-process', 'gemini-3-flash-preview',
            retryUsage.inputTokens, retryUsage.outputTokens, 0,
            { agentId: agent.id, conversationId, isRetry: true },
            false
          ).catch(err => console.error('[UsageTracker] Retry Error:', err));
        }
      }
      
      // Fallback with even lower temperature if still empty
      if (!aiResponse) {
        console.log('⚠️ Ainda sem resposta - fallback final com temp 0.2');
        const fallbackResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ 
                parts: [{ 
                  text: `${systemPrompt}\n\nO cliente disse: "${processedMessageContent || 'Olá'}"\n\nResponda de forma breve e profissional:` 
                }] 
              }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
            })
          }
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          aiResponse = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 
            'Olá! Como posso ajudá-lo hoje?';
        }
      }
    }

    console.log('\n✅ RESPOSTA GERADA');
    console.log('📝 Modelo:', modelUsed);
    console.log('📝 Preview:', aiResponse.substring(0, 100) + '...');

    // Get conversation and contact info for command handlers
    const { data: conversationData } = await supabase
      .from('conversations')
      .select('contact_id, whatsapp_connection_id, whatsapp_connections!inner(company_id)')
      .eq('id', conversationId)
      .single();
    
    const contactId = conversationData?.contact_id;
    const connectionCompanyIdFromConv = (conversationData?.whatsapp_connections as any)?.company_id;

    // Variables for agent transfer handling
    let agentTransferOccurred = false;
    let transferredToAgentId: string | null = null;
    let transferredToAgentName: string | null = null;

    // ═══════════════════════════════════════════════════════════════════
    // COMMAND HANDLERS
    // ═══════════════════════════════════════════════════════════════════
    const commandHandlers: Record<string, (value: string) => Promise<void>> = {
      // Add tag
      'adicionar_etiqueta': async (tagName: string) => {
        if (!contactId) return;
        console.log('🏷️ Adicionando etiqueta:', tagName);
        
        const normalizedTag = tagName.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-');
        
        const { data: contact } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contactId)
          .single();
        
        const currentTags = contact?.tags || [];
        if (!currentTags.includes(normalizedTag)) {
          await supabase
            .from('contacts')
            .update({ tags: [...currentTags, normalizedTag] })
            .eq('id', contactId);
          console.log('✅ Etiqueta adicionada');
        } else {
          console.log('ℹ️ Etiqueta já existe');
        }
      },

      // Transfer to AI agent
      'transferir_agente': async (agentIdentifier: string) => {
        console.log('🤖 [TRANSFER] Transferindo para agente:', agentIdentifier);
        console.log('🏢 [TRANSFER] Company ID:', connectionCompanyIdFromConv);
        
        const { data: targetAgent, error: agentError } = await supabase
          .from('ai_agents')
          .select('id, name')
          .eq('company_id', connectionCompanyIdFromConv)
          .eq('status', 'active')
          .ilike('name', `%${agentIdentifier}%`)
          .limit(1)
          .maybeSingle();
        
        if (agentError) {
          console.log('❌ [TRANSFER] Erro na busca de agente:', agentError.message);
        }
        
        console.log('📋 [TRANSFER] Resultado da busca:', targetAgent ? `${targetAgent.name} (${targetAgent.id})` : 'NULL');
        
        if (targetAgent) {
          const { error: updateError } = await supabase
            .from('ai_conversation_states')
            .update({ 
              current_sub_agent_id: targetAgent.id,
              updated_at: new Date().toISOString()
            })
            .eq('conversation_id', conversationId);
          
          if (updateError) {
            console.log('❌ [TRANSFER] Erro ao atualizar estado:', updateError.message);
          } else {
            console.log('✅ [TRANSFER] Transferido com sucesso para:', targetAgent.name, '| ID:', targetAgent.id);
            agentTransferOccurred = true;
            transferredToAgentId = targetAgent.id;
            transferredToAgentName = targetAgent.name;
            console.log('🚀 [TRANSFER] Flag de transferência ativado para resposta imediata');
          }
        } else {
          console.log('⚠️ [TRANSFER] Agente não encontrado:', agentIdentifier);
          
          const { data: allAgents } = await supabase
            .from('ai_agents')
            .select('id, name, status')
            .eq('company_id', connectionCompanyIdFromConv)
            .eq('status', 'active');
          console.log('📋 [TRANSFER] Agentes ativos disponíveis:', allAgents?.map(a => a.name).join(', ') || 'nenhum');
        }
      },

      // Transfer to human user
      'transferir_usuario': async (userIdentifier: string) => {
        console.log('👤 Transferindo para usuário:', userIdentifier);
        
        const { data: targetUser } = await supabase
          .from('profiles')
          .select('id, full_name')
          .ilike('full_name', `%${userIdentifier}%`)
          .eq('company_id', connectionCompanyIdFromConv)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        
        if (targetUser) {
          await supabase
            .from('conversations')
            .update({ 
              assigned_user_id: targetUser.id,
              assigned_at: new Date().toISOString()
            })
            .eq('id', conversationId);
          
          await supabase
            .from('ai_conversation_states')
            .update({ 
              status: 'deactivated_permanently',
              deactivated_at: new Date().toISOString(),
              deactivation_reason: `Transferido para ${targetUser.full_name}`
            })
            .eq('conversation_id', conversationId);
          
          console.log('✅ Transferido para usuário:', targetUser.full_name);
        } else {
          console.log('⚠️ Usuário não encontrado:', userIdentifier);
        }
      },

      // Set contact origin
      'atribuir_origem': async (origin: string) => {
        if (!contactId) return;
        console.log('📍 Atribuindo origem:', origin);
        
        const { data: contact } = await supabase
          .from('contacts')
          .select('custom_fields')
          .eq('id', contactId)
          .single();
        
        const customFields = contact?.custom_fields || {};
        await supabase
          .from('contacts')
          .update({ 
            custom_fields: { ...customFields, origem: origin }
          })
          .eq('id', contactId);
        console.log('✅ Origem atribuída');
      },

      // Change CRM stage (Kanban column)
      'mudar_etapa_crm': async (stageName: string) => {
        if (!contactId) return;
        console.log('📊 Mudando etapa CRM:', stageName);
        
        const { data: card } = await supabase
          .from('kanban_cards')
          .select('id, column_id, kanban_columns!inner(board_id)')
          .eq('contact_id', contactId)
          .limit(1)
          .maybeSingle();
        
        if (card) {
          const boardId = (card as any).kanban_columns.board_id;
          
          const normalizedInput = stageName.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');
          
          let targetColumn = null;
          
          // Try exact match
          const { data: exactMatch } = await supabase
            .from('kanban_columns')
            .select('id, name')
            .eq('board_id', boardId)
            .eq('name', stageName)
            .limit(1)
            .maybeSingle();
          
          if (exactMatch) {
            targetColumn = exactMatch;
            console.log('✅ Match exato encontrado:', exactMatch.name);
          } else {
            // Try ilike match
            const { data: ilikeMatch } = await supabase
              .from('kanban_columns')
              .select('id, name')
              .eq('board_id', boardId)
              .ilike('name', stageName)
              .limit(1)
              .maybeSingle();
            
            if (ilikeMatch) {
              targetColumn = ilikeMatch;
              console.log('✅ Match ilike encontrado:', ilikeMatch.name);
            } else {
              // Try partial match
              const { data: partialMatch } = await supabase
                .from('kanban_columns')
                .select('id, name')
                .eq('board_id', boardId)
                .ilike('name', `%${stageName}%`)
                .limit(1)
                .maybeSingle();
              
              if (partialMatch) {
                targetColumn = partialMatch;
                console.log('✅ Match parcial encontrado:', partialMatch.name);
              } else {
                // Try normalized comparison
                const { data: allColumns } = await supabase
                  .from('kanban_columns')
                  .select('id, name')
                  .eq('board_id', boardId);
                
                if (allColumns) {
                  for (const col of allColumns) {
                    const normalizedColName = col.name.toLowerCase()
                      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                      .replace(/\s+/g, '-');
                    
                    if (normalizedColName === normalizedInput || 
                        normalizedColName.includes(normalizedInput) ||
                        normalizedInput.includes(normalizedColName)) {
                      targetColumn = col;
                      console.log('✅ Match normalizado encontrado:', col.name);
                      break;
                    }
                  }
                }
              }
            }
          }
          
          if (targetColumn) {
            await supabase
              .from('kanban_cards')
              .update({ column_id: targetColumn.id })
              .eq('id', card.id);
            console.log('✅ Etapa CRM atualizada para:', targetColumn.name);
          } else {
            console.log('⚠️ Coluna não encontrada:', stageName, '- Input normalizado:', normalizedInput);
          }
        } else {
          console.log('⚠️ Card não encontrado para contato');
        }
      },

      // Notify team
      'notificar_equipe': async (message: string) => {
        console.log('🔔 [NOTIFICAR_EQUIPE] Iniciando notificação:', message);
        
        try {
          const { data: companyProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('company_id', connectionCompanyIdFromConv)
            .eq('active', true);
          
          if (profilesError) {
            console.log('❌ [NOTIFICAR_EQUIPE] Erro ao buscar profiles:', profilesError.message);
            return;
          }
          
          console.log(`👥 [NOTIFICAR_EQUIPE] Profiles ativos na empresa: ${companyProfiles?.length || 0}`);
          
          if (!companyProfiles?.length) {
            console.log('⚠️ [NOTIFICAR_EQUIPE] Nenhum profile ativo encontrado na empresa');
            return;
          }
          
          const userIds = companyProfiles.map(p => p.id);
          
          const { data: adminRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds)
            .in('role', ['owner', 'admin']);
          
          if (rolesError) {
            console.log('❌ [NOTIFICAR_EQUIPE] Erro ao buscar roles:', rolesError.message);
            return;
          }
          
          const companyAdmins = adminRoles || [];
          console.log(`📢 [NOTIFICAR_EQUIPE] Total de ${companyAdmins.length} admins/owners para notificar`);
          
          if (companyAdmins.length === 0) {
            console.log('⚠️ [NOTIFICAR_EQUIPE] Nenhum admin/owner encontrado');
            return;
          }
          
          const { data: convData } = await supabase
            .from('conversations')
            .select('contact_id, contacts(name, phone_number)')
            .eq('id', conversationId)
            .single();
          
          const contactInfo = convData?.contacts as any;
          const notificationMessage = `🤖 Notificação do Agente IA: ${message}${
            contactInfo ? `\n👤 Cliente: ${contactInfo.name || contactInfo.phone_number}` : ''
          }`;
          
          let successCount = 0;
          for (const admin of companyAdmins) {
            const { error: insertError } = await supabase.from('mention_notifications').insert({
              mentioned_user_id: admin.user_id,
              mentioner_user_id: admin.user_id,
              message_id: crypto.randomUUID(),
              source_type: 'internal_note',
              conversation_id: conversationId,
              has_access: true,
              is_read: false
            });
            
            if (insertError) {
              console.log(`❌ [NOTIFICAR_EQUIPE] Erro ao criar notificação para ${admin.user_id}:`, insertError.message);
            } else {
              successCount++;
              console.log(`✅ [NOTIFICAR_EQUIPE] Notificação criada para ${admin.user_id} (role: ${admin.role})`);
            }
          }
          
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            content: notificationMessage,
            direction: 'outbound',
            sender_type: 'system',
            message_type: 'text',
            is_internal_note: true,
            status: 'sent'
          });
          
          console.log(`✅ [NOTIFICAR_EQUIPE] Notificações criadas: ${successCount}/${companyAdmins.length}`);
        } catch (notifyError) {
          console.error('❌ [NOTIFICAR_EQUIPE] Erro inesperado:', notifyError);
        }
      },

      // Assign department
      'atribuir_departamento': async (deptName: string) => {
        console.log('🏢 Atribuindo departamento:', deptName);
        
        const { data: dept } = await supabase
          .from('departments')
          .select('id')
          .eq('whatsapp_connection_id', connectionId)
          .ilike('name', `%${deptName}%`)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        
        if (dept) {
          await supabase
            .from('conversations')
            .update({ department_id: dept.id })
            .eq('id', conversationId);
          console.log('✅ Departamento atribuído');
        } else {
          console.log('⚠️ Departamento não encontrado:', deptName);
        }
      },

      // Deactivate AI agent
      'desativar_agente': async () => {
        console.log('🛑 Desativando agente de IA');
        
        await supabase
          .from('ai_conversation_states')
          .update({ 
            status: 'deactivated_permanently',
            deactivated_at: new Date().toISOString(),
            deactivation_reason: 'Desativado pelo roteiro'
          })
          .eq('conversation_id', conversationId);
        console.log('✅ Agente desativado permanentemente');
      }
    };

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS TOOL CALLS FROM API
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🔧 PROCESSAR TOOL CALLS DA API                                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let cleanResponse = aiResponse;
    const executedCommands: string[] = [];

    // Execute tool calls from API response
    if (toolCallsFromApi.length > 0) {
      console.log(`🔧 Executando ${toolCallsFromApi.length} tool calls da API:`);
      
      for (const toolCall of toolCallsFromApi) {
        const { name, arguments: args } = toolCall;
        console.log(`   📌 Tool: ${name}`, args);
        
        try {
          switch (name) {
            case 'mudar_etapa_crm':
              await commandHandlers['mudar_etapa_crm'](args.stage_name || args.stage_slug);
              executedCommands.push(`mudar_etapa_crm:${args.stage_name || args.stage_slug} (tool)`);
              break;
              
            case 'adicionar_etiqueta':
              await commandHandlers['adicionar_etiqueta'](args.tag_name);
              executedCommands.push(`adicionar_etiqueta:${args.tag_name} (tool)`);
              break;
              
            case 'transferir_agente':
              await commandHandlers['transferir_agente'](args.agent_name);
              executedCommands.push(`transferir_agente:${args.agent_name} (tool)`);
              break;
              
            case 'atribuir_departamento':
              await commandHandlers['atribuir_departamento'](args.department_name);
              executedCommands.push(`atribuir_departamento:${args.department_name} (tool)`);
              break;
              
            case 'transferir_usuario':
              await commandHandlers['transferir_usuario'](args.user_name);
              executedCommands.push(`transferir_usuario:${args.user_name} (tool)`);
              break;
              
            case 'notificar_equipe':
              await commandHandlers['notificar_equipe'](args.message);
              executedCommands.push(`notificar_equipe (tool)`);
              break;
              
            case 'desativar_agente':
              await commandHandlers['desativar_agente']('');
              executedCommands.push(`desativar_agente (tool)`);
              break;
              
            case 'atribuir_origem':
              await commandHandlers['atribuir_origem'](args.origin);
              executedCommands.push(`atribuir_origem:${args.origin} (tool)`);
              break;
              
            default:
              console.log(`⚠️ Tool não implementada: ${name}`);
          }
        } catch (toolError) {
          console.error(`❌ Erro ao executar tool ${name}:`, toolError);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS LEGACY SLASH COMMANDS FROM TEXT (FALLBACK)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 📝 PROCESSAR SLASH COMMANDS DO TEXTO (FALLBACK)                 │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const slashCommandPattern = /\/(adicionar_etiqueta|transferir_agente|transferir_usuario|atribuir_origem|mudar_etapa_crm|notificar_equipe|atribuir_departamento|desativar_agente):?([^\n\/]*)?/gi;
    let match;
    let slashCommandsFound = 0;

    while ((match = slashCommandPattern.exec(cleanResponse)) !== null) {
      slashCommandsFound++;
      const [fullMatch, command, value] = match;
      const handler = commandHandlers[command.toLowerCase()];
      
      if (handler) {
        console.log(`📌 Slash command encontrado: /${command}:${value || ''}`);
        await handler((value || '').trim());
        executedCommands.push(`${command}:${value || ''} (slash)`);
      }
      
      // Remove command from response
      cleanResponse = cleanResponse.replace(fullMatch, '').trim();
    }

    // Remove any remaining invalid commands
    const invalidCommandPattern = /\/[a-zA-Z_]+:?[^\n\/]*/gi;
    const invalidCommands = [...cleanResponse.matchAll(invalidCommandPattern)];
    
    if (invalidCommands.length > 0) {
      console.log(`⚠️ Removendo ${invalidCommands.length} comando(s) inválido(s):`);
      for (const match of invalidCommands) {
        console.log(`   - "${match[0]}"`);
        cleanResponse = cleanResponse.replace(match[0], '').trim();
      }
    }

    // Clean up multiple spaces and empty lines
    cleanResponse = cleanResponse.replace(/\n\s*\n/g, '\n').trim();

    if (slashCommandsFound > 0) {
      console.log(`📝 Slash commands no texto: ${slashCommandsFound}`);
    } else {
      console.log('ℹ️ Nenhum slash command no texto');
    }

    // Summary
    if (executedCommands.length > 0) {
      console.log('\n✅ TOTAL de comandos executados:', executedCommands.length);
      for (const cmd of executedCommands) {
        console.log(`   - ${cmd}`);
      }
    } else {
      console.log('ℹ️ Nenhum comando executado nesta resposta');
    }

    // 🚀 RESPOSTA IMEDIATA APÓS TRANSFERÊNCIA DE AGENTE
    if (agentTransferOccurred && transferredToAgentId) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 🔄 GERANDO RESPOSTA IMEDIATA DO NOVO AGENTE                     │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      console.log('🤖 Novo agente:', transferredToAgentName, '| ID:', transferredToAgentId);
      
      const { data: newAgent, error: newAgentError } = await supabase
        .from('ai_agents')
        .select(`
          id, name, status, agent_type, description,
          script_content, rules_content, faq_content,
          company_info, contract_link, temperature,
          delay_seconds, audio_enabled, voice_name,
          audio_always_respond_audio, audio_respond_with_audio,
          speech_speed, audio_temperature, language_code
        `)
        .eq('id', transferredToAgentId)
        .single();
      
      if (newAgent && !newAgentError) {
        console.log('✅ Dados do novo agente carregados');
        
        const newAgentCompanyInfo = newAgent.company_info || {};
        let newAgentSystemPrompt = `Você é ${newAgent.name}, um assistente virtual especializado.

`;
        
        if (newAgent.script_content) {
          newAgentSystemPrompt += `## FLUXO DE ATENDIMENTO
${newAgent.script_content}

`;
        }
        
        if (newAgent.rules_content) {
          newAgentSystemPrompt += `## DIRETRIZES DO AGENTE
${newAgent.rules_content}

`;
        }
        
        if (newAgent.faq_content) {
          newAgentSystemPrompt += `## PERGUNTAS FREQUENTES (FAQ)
${newAgent.faq_content}

`;
        }
        
        if (Object.keys(newAgentCompanyInfo).length > 0) {
          newAgentSystemPrompt += `## INFORMAÇÕES DA EMPRESA
`;
          for (const [key, value] of Object.entries(newAgentCompanyInfo)) {
            if (value) newAgentSystemPrompt += `- ${key}: ${value}\n`;
          }
          newAgentSystemPrompt += '\n';
        }
        
        if (newAgent.contract_link) {
          newAgentSystemPrompt += `## 📄 LINK DO CONTRATO
O link do contrato para enviar ao cliente é: ${newAgent.contract_link}

`;
        }
        
        if (contextSummary) {
          newAgentSystemPrompt += `## 🧠 MEMÓRIA DA CONVERSA (INFORMAÇÕES JÁ COLETADAS)
${contextSummary}

`;
        }
        
        newAgentSystemPrompt += `## CONTEXTO DA TRANSFERÊNCIA
- Cliente: ${conversationContext.lead.nome || contactName || 'Cliente'}
- O cliente foi transferido para você pelo agente anterior (${agent.name})
- Contexto da última mensagem do cliente: ${processedMessageContent || messageContent || '(sem texto)'}
- Resposta do agente anterior (que mencionou a transferência): ${cleanResponse.substring(0, 300)}

## INSTRUÇÕES PARA ESTA RESPOSTA
1. Apresente-se brevemente como ${newAgent.name}
2. Mostre que você entendeu o contexto da conversa
3. Continue o atendimento de forma natural
4. NÃO repita saudações extensas - seja objetivo
5. NÃO use comandos/ações nesta primeira resposta após transferência
6. Responda de forma concisa (máximo 2-3 frases)`;

        console.log('📝 Prompt do novo agente criado (' + newAgentSystemPrompt.length + ' chars)');
        
        const newAgentTemperature = newAgent.temperature ?? 1.0;
        
        try {
          const newAgentApiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [{ text: newAgentSystemPrompt }]
                }],
                generationConfig: {
                  temperature: newAgentTemperature,
                  maxOutputTokens: 1024
                }
              })
            }
          );
          
          const newAgentResult = await newAgentApiResponse.json();
          const newAiResponse = newAgentResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (newAiResponse) {
            console.log('✅ Resposta do novo agente gerada');
            console.log('📝 Preview:', newAiResponse.substring(0, 100) + '...');
            
            cleanResponse = newAiResponse.trim();
            
            agent = {
              ...agent,
              id: newAgent.id,
              name: newAgent.name,
              delay_seconds: newAgent.delay_seconds,
              audio_enabled: newAgent.audio_enabled,
              voice_name: newAgent.voice_name,
              audio_always_respond_audio: newAgent.audio_always_respond_audio,
              audio_respond_with_audio: newAgent.audio_respond_with_audio,
              speech_speed: newAgent.speech_speed,
              audio_temperature: newAgent.audio_temperature,
              language_code: newAgent.language_code
            };
            
            console.log('✅ Resposta combinada gerada com sucesso');
            console.log('🤖 Agente atualizado para:', agent.name);
          } else {
            console.log('⚠️ Resposta do novo agente vazia, mantendo resposta original');
          }
        } catch (newAgentError) {
          console.error('❌ Erro ao gerar resposta do novo agente:', newAgentError);
        }
      } else {
        console.log('⚠️ Não foi possível carregar dados do novo agente:', newAgentError?.message);
      }
    }

    // 6️⃣ Parse and extract media tags from response
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 6️⃣  PROCESSAR TAGS DE MÍDIA NA RESPOSTA                         │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const mediaPattern = /\{\{(image|video|audio|document|text|link):([a-zA-Z0-9_-]+)\}\}/gi;
    const mediaMatches = [...cleanResponse.matchAll(mediaPattern)];
    const mediasToSend: Array<{ type: string; key: string; url?: string; content?: string; fileName?: string }> = [];

    for (const match of mediaMatches) {
      const [fullMatch, mediaType, mediaKey] = match;
      console.log(`📎 Tag de mídia encontrada: ${mediaType}:${mediaKey}`);
      
      const { data: media } = await supabase
        .from('ai_agent_media')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('media_key', mediaKey)
        .maybeSingle();
      
      if (media) {
        let mediaUrl = media.media_url || undefined;
        
        if (mediaUrl && mediaUrl.includes('/ai-agent-media/')) {
          try {
            const urlParts = mediaUrl.split('/ai-agent-media/');
            if (urlParts.length > 1) {
              const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
              console.log(`🔑 Gerando signed URL temporária para copiar: ${storagePath}`);
              
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('ai-agent-media')
                .createSignedUrl(storagePath, 300);
              
              if (signedUrlData?.signedUrl) {
                const publicUrl = await copyMediaToPublicBucket(
                  supabase,
                  signedUrlData.signedUrl,
                  agent.id,
                  media.media_key,
                  media.mime_type
                );
                
                if (publicUrl) {
                  mediaUrl = publicUrl;
                  console.log(`✅ URL permanente gerada: ${publicUrl.substring(0, 60)}...`);
                } else {
                  const { data: fallbackUrl } = await supabase.storage
                    .from('ai-agent-media')
                    .createSignedUrl(storagePath, 86400);
                  if (fallbackUrl?.signedUrl) {
                    mediaUrl = fallbackUrl.signedUrl;
                    console.log(`⚠️ Usando signed URL de 24h como fallback`);
                  }
                }
              } else if (signedUrlError) {
                console.log(`⚠️ Erro ao gerar signed URL: ${signedUrlError.message}`);
              }
            }
          } catch (signedUrlErr) {
            console.log(`⚠️ Erro ao processar mídia:`, signedUrlErr);
          }
        }
        
        mediasToSend.push({
          type: media.media_type,
          key: media.media_key,
          url: mediaUrl,
          content: media.media_content || undefined,
          fileName: media.file_name || undefined
        });
        console.log(`✅ Mídia encontrada: ${media.media_type} - ${media.media_key}`);
      } else {
        console.log(`⚠️ Mídia não encontrada: ${mediaKey}`);
      }
      
      cleanResponse = cleanResponse.replace(fullMatch, '').trim();
    }

    cleanResponse = cleanResponse.replace(/\n\s*\n/g, '\n').trim();

    if (mediasToSend.length > 0) {
      console.log(`📦 Total de mídias para enviar: ${mediasToSend.length}`);
    }

    aiResponse = cleanResponse;

    // ═══════════════════════════════════════════════════════════════════
    // EXTRACT AND UPDATE STRUCTURED CONTEXT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🧠 EXTRAIR E SALVAR CONTEXTO ESTRUTURADO                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let updatedContext = conversationContext;
    
    try {
      const extractionPrompt = buildExtractionPrompt(
        processedMessageContent || messageContent || '',
        aiResponse,
        conversationContext
      );
      
      console.log('🔍 Fazendo chamada de extração de contexto...');
      
      const extractionResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: extractionPrompt }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000
            }
          })
        }
      );
      
      if (extractionResponse.ok) {
        const extractionData = await extractionResponse.json();
        const extractedText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        
        console.log('📝 Resposta da extração:', extractedText.substring(0, 200) + '...');
        
        try {
          const cleanedJson = extractedText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          
          const extractedInfo = JSON.parse(cleanedJson) as Partial<ConversationContext>;
          
          if (executedCommands.length > 0) {
            extractedInfo.acoes_executadas = executedCommands;
          }
          
          updatedContext = mergeContext(conversationContext, extractedInfo);
          
          console.log('✅ Contexto atualizado com sucesso');
          console.log('   - Lead info:', Object.keys(updatedContext.lead).filter(k => updatedContext.lead[k]).length, 'campos');
          console.log('   - Interesse:', updatedContext.interesse.principal || 'não identificado');
          console.log('   - Qualificação:', updatedContext.qualificacao.nivel || 'não definido');
          console.log('   - Histórico:', updatedContext.historico_resumido.length, 'interações');
          
        } catch (parseError) {
          console.log('⚠️ Erro ao parsear JSON da extração (não fatal):', parseError);
        }
      } else {
        console.log('⚠️ Extração falhou (não fatal):', extractionResponse.status);
      }
    } catch (extractionError) {
      console.log('⚠️ Erro na extração de contexto (não fatal):', extractionError);
    }

    // 8️⃣ Update conversation state WITH CONTEXT
    const updatedMetadata = {
      ...existingMetadata,
      context: updatedContext
    };
    
    await supabase
      .from('ai_conversation_states')
      .update({
        last_response_at: new Date().toISOString(),
        messages_processed: (convState?.messages_processed || 0) + 1,
        updated_at: new Date().toISOString(),
        metadata: updatedMetadata
      })
      .eq('conversation_id', conversationId);
    
    console.log('✅ Estado da conversa e contexto salvos');

    // Log successful response
    await supabase.from('ai_agent_logs').insert({
      agent_id: agent.id,
      conversation_id: conversationId,
      action_type: 'response_generated',
      input_text: processedMessageContent?.substring(0, 500),
      output_text: aiResponse?.substring(0, 500),
      metadata: { 
        model: modelUsed, 
        hasMedia: mediasToSend.length > 0,
        toolCalls: toolCallsFromApi.length,
        commandsExecuted: executedCommands.length,
        usedUrlContextTool: true
      }
    });

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ AI AGENT PROCESS CONCLUÍDO                       ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        medias: mediasToSend.length > 0 ? mediasToSend : undefined,
        agentId: agent.id,
        agentName: agent.name,
        delaySeconds: agent.delay_seconds || 0,
        audioEnabled: agent.audio_enabled || false,
        voiceName: agent.voice_name,
        audioAlwaysRespondAudio: agent.audio_always_respond_audio || false,
        audioRespondWithAudio: agent.audio_respond_with_audio || false,
        speechSpeed: agent.speech_speed || 1.0,
        audioTemperature: agent.audio_temperature || 0.7,
        languageCode: agent.language_code || 'pt-BR'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    } catch (error) {
      console.error('❌ Erro fatal no ai-agent-process:', error);
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      // 🔓 ALWAYS release idempotency lock when done (success or error)
      if (redis && currentIdempotencyKey) {
        try {
          await redis.del(currentIdempotencyKey);
          console.log(`🔓 [IDEMPOTENCY] Lock released: ${currentIdempotencyKey}`);
        } catch (unlockError) {
          console.error('⚠️ [IDEMPOTENCY] Error releasing lock:', unlockError);
        }
      }
    }

  } catch (error) {
    // Outer error handling for request parsing errors
    console.error('❌ Erro fatal no ai-agent-process (outer):', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
