import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";

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
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `ai-process:${conversationId}:${Math.abs(hash).toString(36)}`;
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

// Helper function to create empty context
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

// Helper function to merge contexts (new info takes precedence, arrays are concatenated uniquely)
function mergeContext(existing: ConversationContext, newInfo: Partial<ConversationContext>): ConversationContext {
  const merged = { ...existing };
  
  // Merge lead info
  if (newInfo.lead) {
    merged.lead = { ...merged.lead };
    for (const [key, value] of Object.entries(newInfo.lead)) {
      if (value && value.trim()) {
        merged.lead[key] = value;
      }
    }
  }
  
  // Merge interesse
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
  
  // Merge qualificacao
  if (newInfo.qualificacao) {
    merged.qualificacao = { ...merged.qualificacao };
    if (newInfo.qualificacao.perguntas_respondidas?.length) {
      merged.qualificacao.perguntas_respondidas = [
        ...new Set([...merged.qualificacao.perguntas_respondidas, ...newInfo.qualificacao.perguntas_respondidas])
      ];
    }
    if (newInfo.qualificacao.informacoes_pendentes?.length) {
      // Remove from pending if already answered
      const answered = new Set(merged.qualificacao.perguntas_respondidas);
      merged.qualificacao.informacoes_pendentes = [
        ...new Set([...merged.qualificacao.informacoes_pendentes, ...newInfo.qualificacao.informacoes_pendentes])
      ].filter(p => !answered.has(p));
    }
    if (newInfo.qualificacao.nivel) {
      merged.qualificacao.nivel = newInfo.qualificacao.nivel;
    }
  }
  
  // Merge situacao
  if (newInfo.situacao) {
    merged.situacao = { ...merged.situacao, ...newInfo.situacao };
  }
  
  // Merge objecoes (unique)
  if (newInfo.objecoes?.length) {
    merged.objecoes = [...new Set([...merged.objecoes, ...newInfo.objecoes])];
  }
  
  // Merge historico_resumido (append new items, keep last 20)
  if (newInfo.historico_resumido?.length) {
    merged.historico_resumido = [...merged.historico_resumido, ...newInfo.historico_resumido].slice(-20);
  }
  
  // Merge acoes_executadas (append new items)
  if (newInfo.acoes_executadas?.length) {
    merged.acoes_executadas = [...merged.acoes_executadas, ...newInfo.acoes_executadas];
  }
  
  merged.ultima_atualizacao = new Date().toISOString();
  
  return merged;
}

// Format context for system prompt injection
function formatContextForPrompt(context: ConversationContext): string {
  const parts: string[] = [];
  
  // Lead info
  const leadEntries = Object.entries(context.lead).filter(([_, v]) => v);
  if (leadEntries.length > 0) {
    parts.push('### INFORMAÇÕES DO LEAD (já coletadas - NÃO pergunte novamente):');
    for (const [key, value] of leadEntries) {
      parts.push(`- ${key}: ${value}`);
    }
  }
  
  // Interesse
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
  
  // Qualificação
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
  
  // Situação
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
  
  // Objeções
  if (context.objecoes.length > 0) {
    parts.push(`\n### OBJEÇÕES LEVANTADAS:`);
    for (const objecao of context.objecoes) {
      parts.push(`- ${objecao}`);
    }
  }
  
  // Histórico resumido (últimas 5 interações)
  if (context.historico_resumido.length > 0) {
    parts.push(`\n### RESUMO DA CONVERSA (últimas interações):`);
    for (const item of context.historico_resumido.slice(-5)) {
      parts.push(`- ${item}`);
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

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to fetch image as base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error('❌ Erro ao baixar imagem:', error);
    return null;
  }
}

// Supported video MIME types by Gemini
const SUPPORTED_VIDEO_MIMES = [
  'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv',
  'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska'
];

// Supported document MIME types by Gemini
const SUPPORTED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/html', 'text/markdown', 'text/rtf',
  'application/rtf', 'application/x-javascript', 'text/javascript',
  'application/json', 'text/xml', 'application/xml'
];

// Helper function to fetch video as base64 (max 20MB for inline_data)
async function fetchVideoAsBase64(videoUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log('🎬 Baixando vídeo:', videoUrl.substring(0, 80) + '...');
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.log('❌ Falha ao baixar vídeo:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Check size limit (20MB for inline_data)
    if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
      console.log('⚠️ Vídeo muito grande para análise inline:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
      return null;
    }
    
    const base64 = arrayBufferToBase64(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'video/mp4';
    
    // Normalize mime type
    let mimeType = 'video/mp4';
    if (contentType.includes('webm')) mimeType = 'video/webm';
    else if (contentType.includes('quicktime') || contentType.includes('mov')) mimeType = 'video/quicktime';
    else if (contentType.includes('avi') || contentType.includes('x-msvideo')) mimeType = 'video/x-msvideo';
    else if (contentType.includes('3gpp')) mimeType = 'video/3gpp';
    else if (contentType.includes('mpeg')) mimeType = 'video/mpeg';
    else if (contentType.includes('matroska') || contentType.includes('mkv')) mimeType = 'video/x-matroska';
    else if (contentType.includes('wmv')) mimeType = 'video/x-ms-wmv';
    else if (contentType.includes('flv')) mimeType = 'video/x-flv';
    else if (contentType.includes('mp4')) mimeType = 'video/mp4';
    
    console.log('✅ Vídeo convertido para base64, tipo:', mimeType, 'tamanho:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
    return { base64, mimeType };
  } catch (error) {
    console.error('❌ Erro ao baixar vídeo:', error);
    return null;
  }
}

// Helper function to fetch document as base64 (max 20MB for inline_data)
async function fetchDocumentAsBase64(docUrl: string, fileName?: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log('📄 Baixando documento:', docUrl.substring(0, 80) + '...');
    
    const response = await fetch(docUrl);
    if (!response.ok) {
      console.log('❌ Falha ao baixar documento:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Check size limit (20MB for inline_data)
    if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
      console.log('⚠️ Documento muito grande para análise inline:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
      return null;
    }
    
    const base64 = arrayBufferToBase64(arrayBuffer);
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Try to infer mime type from filename if content-type is generic
    if (contentType === 'application/octet-stream' && fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'html': 'text/html',
        'htm': 'text/html',
        'md': 'text/markdown',
        'rtf': 'application/rtf',
        'json': 'application/json',
        'xml': 'application/xml',
        'js': 'application/x-javascript'
      };
      if (ext && mimeMap[ext]) {
        contentType = mimeMap[ext];
      }
    }
    
    // Verify it's a supported mime type
    if (!SUPPORTED_DOCUMENT_MIMES.some(m => contentType.includes(m.split('/')[1]))) {
      console.log('⚠️ Tipo de documento não suportado:', contentType);
      return null;
    }
    
    console.log('✅ Documento convertido para base64, tipo:', contentType, 'tamanho:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error('❌ Erro ao baixar documento:', error);
    return null;
  }
}

// Helper function to transcribe audio using Gemini 3 Flash Preview
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('🎤 Transcrevendo áudio com Gemini 3 Flash Preview:', audioUrl.substring(0, 80) + '...');
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.log('❌ Falha ao baixar áudio:', audioResponse.status);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    // Map content type to Gemini's expected MIME types
    let mimeType = 'audio/ogg';
    if (contentType.includes('mp3') || contentType.includes('mpeg')) mimeType = 'audio/mp3';
    else if (contentType.includes('wav')) mimeType = 'audio/wav';
    else if (contentType.includes('webm')) mimeType = 'audio/webm';
    else if (contentType.includes('m4a') || contentType.includes('mp4')) mimeType = 'audio/mp4';
    else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioBase64
                }
              },
              {
                text: "Transcreva o áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação, explicações ou comentários adicionais."
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000
          }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.log('❌ Erro na transcrição Gemini:', geminiResponse.status, errorText);
      return null;
    }
    
    const result = await geminiResponse.json();
    const transcription = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (transcription) {
      console.log('✅ Áudio transcrito:', transcription.substring(0, 50) + '...');
      return transcription;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error);
    return null;
  }
}

serve(async (req) => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              🤖 AI AGENT PROCESS                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Support both single message (legacy) and batch of messages (new)
    const { 
      connectionId, 
      conversationId, 
      messages, // New: array of messages from batch
      messageContent, // Legacy: single message content
      contactName,
      contactPhone,
      messageType,
      mediaUrl
    } = requestBody;

    // Determine if this is a batch request or legacy single message
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
    // 🔒 IDEMPOTENCY CHECK - Prevent duplicate processing of same batch
    // ═══════════════════════════════════════════════════════════════════════════════
    const messagesToProcess = isBatchRequest ? messages : [{ type: messageType || 'text', content: messageContent, mediaUrl }];
    const idempotencyKey = createBatchHash(conversationId, messagesToProcess);
    
    if (redis) {
      try {
        const alreadyProcessing = await redis.get(idempotencyKey);
        if (alreadyProcessing) {
          console.log(`🔒 [IDEMPOTENCY] Batch already being processed: ${idempotencyKey}`);
          return new Response(
            JSON.stringify({ success: true, skip: true, reason: 'Already processing this batch' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Mark as processing with 5 minute TTL
        await redis.setex(idempotencyKey, 300, 'processing');
        console.log(`✅ [IDEMPOTENCY] Marked batch as processing: ${idempotencyKey}`);
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

    // Check if paused
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

    // 🔄 CRITICAL: If there's an active sub-agent, load and use its prompts
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
          // Use sub-agent prompts while keeping parent agent's audio/delay settings
          // CRÍTICO: Incluir ID do sub-agente para que busca de mídia funcione corretamente
          agent = {
            ...agent,
            id: subAgent.id,  // ← ID do sub-agente para buscar mídia corretamente
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
          console.log('📝 Usando prompts do sub-agente');
        } else {
          console.log('⚠️ Sub-agente inativo:', subAgent.name, '| Status:', subAgent.status);
          // Clear the sub-agent reference since it's inactive
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
            agent_id: agent.id,
            activated_at: new Date().toISOString() 
          })
          .eq('id', convState.id);
        console.log('✅ Estado da conversa atualizado para ativo');
      }
    }

    // 6️⃣ Generate AI Response
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 4️⃣  GERAR RESPOSTA COM IA                                       │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.log('❌ GEMINI_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation history for context (including all message types)
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('content, direction, message_type, created_at, metadata, media_url')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30);

    // Collect media URLs for potential multimodal analysis
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    const documentData: { url: string; fileName: string }[] = [];

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map(m => {
        const metadata = m.metadata as any;
        let messageText = '';
        
        if (m.message_type === 'text') {
          messageText = m.content || '';
        } else if (m.message_type === 'audio') {
          if (metadata?.transcription) {
            messageText = `[Áudio transcrito]: ${metadata.transcription}`;
          } else if (m.content) {
            messageText = m.content;
          } else {
            messageText = '[Mensagem de áudio]';
          }
        } else if (m.message_type === 'image') {
          // Collect image URLs for multimodal analysis
          if (m.media_url && m.direction === 'inbound') {
            imageUrls.push(m.media_url);
          }
          messageText = m.content 
            ? `[Imagem com legenda]: ${m.content}` 
            : '[Cliente enviou uma imagem]';
        } else if (m.message_type === 'video') {
          // Collect video URLs for multimodal analysis
          if (m.media_url && m.direction === 'inbound') {
            videoUrls.push(m.media_url);
          }
          messageText = m.content 
            ? `[Vídeo com legenda]: ${m.content}` 
            : '[Cliente enviou um vídeo]';
        } else if (m.message_type === 'document') {
          const fileName = metadata?.fileName || metadata?.file_name || 'documento';
          // Collect document data for multimodal analysis
          if (m.media_url && m.direction === 'inbound') {
            documentData.push({ url: m.media_url, fileName });
          }
          messageText = m.content 
            ? `[Documento "${fileName}"]: ${m.content}` 
            : `[Cliente enviou documento: ${fileName}]`;
        } else if (m.message_type === 'sticker') {
          messageText = '[Cliente enviou um sticker]';
        } else {
          messageText = m.content || `[Mensagem do tipo ${m.message_type}]`;
        }
        
        return messageText ? {
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: messageText
        } : null;
      })
      .filter(Boolean);

    // Check if current message is image/audio/video/document that needs special processing
    // For batch requests, check the last message type
    let currentMessageIsImage = messageType === 'image';
    let currentMessageIsAudio = messageType === 'audio';
    let currentMessageIsVideo = messageType === 'video';
    let currentMessageIsDocument = messageType === 'document';
    let actualMediaUrl = mediaUrl;
    let currentDocumentFileName = '';
    
    // Process batch messages if this is a batch request
    let processedMessageContent = messageContent || '';
    
    if (isBatchRequest) {
      // Combine all messages from the batch into context
      const batchContents: string[] = [];
      
      for (const msg of messages) {
        if (msg.type === 'text' && msg.content) {
          batchContents.push(msg.content);
        } else if (msg.type === 'audio') {
          // Transcribe audio if we have URL
          if (msg.mediaUrl) {
            const transcription = await transcribeAudio(msg.mediaUrl, GEMINI_API_KEY);
            if (transcription) {
              batchContents.push(`[Áudio transcrito]: ${transcription}`);
            } else {
              batchContents.push('[Mensagem de áudio]');
            }
          } else {
            batchContents.push(msg.content || '[Mensagem de áudio]');
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
      
      // Join all messages with newline for context
      processedMessageContent = batchContents.join('\n');
      
      // Check last message type for special processing
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
      // Legacy single message processing
      processedMessageContent = messageContent || '';
    }
    
    // Get the actual mediaUrl if not provided (media may have been processed in background)
    const needsMediaUrl = currentMessageIsImage || currentMessageIsAudio || currentMessageIsVideo || currentMessageIsDocument;
    if (needsMediaUrl && !actualMediaUrl) {
      // Fetch the most recent message to get the media_url
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
        // Get document filename from metadata if applicable
        if (currentMessageIsDocument && latestMsg.metadata) {
          const meta = latestMsg.metadata as any;
          currentDocumentFileName = meta?.fileName || meta?.file_name || 'documento';
        }
      }
    }
    
    // Handle audio transcription for current message (legacy mode)
    if (!isBatchRequest && currentMessageIsAudio && actualMediaUrl && !processedMessageContent) {
      console.log('🎤 Transcrevendo áudio do cliente...');
      const transcription = await transcribeAudio(actualMediaUrl, GEMINI_API_KEY);
      if (transcription) {
        processedMessageContent = transcription;
        console.log('✅ Transcrição obtida:', transcription.substring(0, 50) + '...');
      } else {
        processedMessageContent = '[Cliente enviou um áudio que não pôde ser transcrito]';
      }
    }

    // Add current image to analysis list
    if (currentMessageIsImage && actualMediaUrl) {
      // Add current image if not already in the list
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
    
    // Update lead info from known data if not already set
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
    // LOAD REAL DATA FOR AVAILABLE ACTIONS (PHASE 1: ERROR-PROOF SYSTEM)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🎯 CARREGAR DADOS REAIS PARA AÇÕES                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Load CRM stages (Kanban columns) for this connection
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

    // Load existing tags from contacts in this company
    const { data: companyData } = await supabase
      .from('whatsapp_connections')
      .select('company_id')
      .eq('id', connectionId)
      .single();
    
    const connectionCompanyId = companyData?.company_id;
    let availableTags: string[] = [];
    if (connectionCompanyId) {
      // Load tags from tags table (not from contacts)
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

    // Load active AI agents (sub-agents) for this company WITH specialty metadata
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
        .neq('id', agent.id); // Exclude current agent
      
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

    // Load departments for this connection
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

    // Tool: mudar_etapa_crm - Only if there are CRM stages
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
              description: `Nome EXATO da etapa destino. Opções disponíveis: ${availableCrmStages.map(s => `"${s.name}"`).join(', ')}. Use o nome EXATAMENTE como mostrado.`
            }
          },
          required: ["stage_name"]
        }
      });
    }

    // Tool: adicionar_etiqueta - With enum if tags exist, otherwise string
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

    // Tool: transferir_agente - Only if there are other agents
    if (availableAgents.length > 0) {
      // Build enhanced agent descriptions with specialty info
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

    // Tool: atribuir_departamento - Only if there are departments
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

    // Tool: transferir_usuario - Free text (search by name)
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

    // Tool: notificar_equipe - Free text message
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

    // Tool: desativar_agente - No parameters
    dynamicTools.push({
      type: "function",
      name: "desativar_agente",
      description: "Desativa o agente de IA permanentemente nesta conversa. Use quando a conversa precisar continuar apenas com humanos.",
      parameters: {
        type: "object",
        properties: {}
      }
    });

    // Tool: atribuir_origem - Free text
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
      systemPrompt += `## ROTEIRO DE ATENDIMENTO
${agent.script_content}

`;
    }

    if (agent.rules_content) {
      systemPrompt += `## REGRAS DE COMPORTAMENTO
${agent.rules_content}

`;
    }

    if (agent.faq_content) {
      systemPrompt += `## PERGUNTAS FREQUENTES (FAQ)
${agent.faq_content}

`;
    }

    if (Object.keys(companyInfo).length > 0) {
      systemPrompt += `## INFORMAÇÕES DA EMPRESA
`;
      for (const [key, value] of Object.entries(companyInfo)) {
        if (value) systemPrompt += `- ${key}: ${value}\n`;
      }
      systemPrompt += '\n';
    }

    // Inject contract link with clear instructions
    const contractLink = agent.contract_link;
    if (contractLink) {
      systemPrompt += `## 📄 LINK DO CONTRATO
O link do contrato para enviar ao cliente é: ${contractLink}

⚠️ INSTRUÇÕES IMPORTANTES:
- Quando o cliente pedir o contrato, modelo de contrato, ou quando for apropriado enviar o link do contrato, envie EXATAMENTE este link: ${contractLink}
- NÃO use placeholders como [LINK], [LINK_CONTRATO], [LINK_DO_CONTRATO], etc.
- Envie o link diretamente na sua mensagem para o cliente poder clicar.
- Você pode apresentar o link de forma natural, como: "Aqui está o link do contrato: ${contractLink}"

`;
    }

    // INJECT STRUCTURED CONTEXT INTO PROMPT
    if (contextSummary) {
      systemPrompt += `## 🧠 MEMÓRIA DA CONVERSA (INFORMAÇÕES JÁ COLETADAS)
${contextSummary}

⚠️ ATENÇÃO: As informações acima já foram coletadas em interações anteriores. 
NÃO pergunte novamente por informações que você já tem!

`;
    }

    systemPrompt += `## CONTEXTO ATUAL
- Cliente: ${conversationContext.lead.nome || contactName || 'Cliente'}
- Telefone: ${contactPhone || 'N/A'}
- Canal: WhatsApp
- Mensagens já processadas: ${convState?.messages_processed || 0}
- É primeira interação: ${isFirstInteraction ? 'Sim' : 'Não'}
${isUsingSubAgent ? `- Você é o sub-agente especializado: ${activeSubAgent.name}` : ''}
${conversationContext.interesse.principal ? `- Interesse identificado: ${conversationContext.interesse.principal}` : ''}
${conversationContext.qualificacao.nivel ? `- Nível do lead: ${conversationContext.qualificacao.nivel}` : ''}

## COMANDOS DISPONÍVEIS
Quando apropriado, INCLUA os comandos abaixo NO INÍCIO da sua resposta (eles serão automaticamente removidos antes de enviar ao cliente):

- /adicionar_etiqueta:nome-da-etiqueta → Adiciona uma etiqueta ao contato
- /transferir_agente:Nome do Agente → Transfere para outro agente de IA
- /transferir_usuario:Nome do Usuário → Transfere para um atendente humano
- /mudar_etapa_crm:nome-da-etapa → Move o card do cliente no CRM
- /atribuir_departamento:Nome do Departamento → Atribui a conversa a um departamento
- /notificar_equipe:mensagem → Notifica a equipe interna
- /desativar_agente → Desativa a IA permanentemente nesta conversa

## ⚠️ OPÇÕES VÁLIDAS PARA COMANDOS (USE EXATAMENTE COMO ESCRITO)

### ETAPAS DO CRM (para /mudar_etapa_crm):
${availableCrmStages.length > 0 
  ? availableCrmStages.map(s => `- "${s.name}" → /mudar_etapa_crm:${s.name}`).join('\n')
  : '- (Nenhuma etapa configurada no CRM)'}

### ETIQUETAS (para /adicionar_etiqueta):
${availableTags.length > 0 
  ? availableTags.map(t => `- ${t}`).join('\n')
  : '- (Nenhuma etiqueta cadastrada ainda - você pode criar novas)'}

### AGENTES DE IA (para /transferir_agente):
${availableAgents.length > 0 
  ? availableAgents.map(a => `- "${a.name}"${a.description ? ` - ${a.description}` : ''}`).join('\n')
  : '- (Nenhum outro agente disponível)'}

${availableAgents.length > 0 && availableAgents.some(a => a.qualification_summary || a.disqualification_signs) ? `
## 🎯 ESPECIALIDADES DOS AGENTES (para transferência inteligente)
Use estas informações para identificar quando transferir o lead para outro agente especializado:

${availableAgents.filter(a => a.qualification_summary || a.disqualification_signs || a.specialty_keywords?.length > 0).map(a => {
  const parts = [`### ${a.name}`];
  if (a.specialty_keywords?.length > 0) {
    parts.push(`- **Palavras-chave**: ${a.specialty_keywords.join(', ')}`);
  }
  if (a.qualification_summary) {
    parts.push(`- **Perfil ideal**: ${a.qualification_summary}`);
  }
  if (a.disqualification_signs) {
    parts.push(`- **NÃO se encaixa se**: ${a.disqualification_signs}`);
  }
  return parts.join('\n');
}).join('\n\n')}

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
- Exemplo: Se há {{video:tutorial-assinatura}}, use exatamente essa tag quando for enviar o vídeo
- A mídia será enviada AUTOMATICAMENTE como um arquivo separado para o cliente
- NUNCA descreva ou comente sobre o arquivo - apenas inclua a tag na sua resposta

CRÍTICO SOBRE COMANDOS:
- Use APENAS os nomes listados acima - eles existem no sistema
- Se a etapa, etiqueta ou agente NÃO estiver na lista, NÃO tente usar
- Coloque os comandos no INÍCIO da resposta, cada um em uma linha separada
- Para etiquetas: use nomes SEM acentos e em minúsculo (ex: salario-maternidade)
- Os comandos serão REMOVIDOS automaticamente antes de enviar a mensagem ao cliente
- SEMPRE use comandos quando o roteiro indicar (ex: ao identificar o interesse, adicione a etiqueta)

## REGRAS CRÍTICAS (OBRIGATÓRIAS)
1. ${isFirstInteraction ? 'Esta é a primeira interação - você pode se apresentar e cumprimentar' : 'NUNCA repita saudações como "Prazer em te conhecer" ou "Olá, tudo bem?" - a conversa já está em andamento'}
2. ${conversationContext.lead.nome ? `VOCÊ JÁ SABE que o nome do cliente é ${conversationContext.lead.nome} - NÃO pergunte novamente` : isFirstInteraction ? 'Pergunte o nome do cliente se ainda não sabe' : 'NÃO pergunte o nome do cliente novamente - você já sabe que é ' + (contactName || 'Cliente')}
3. CONSULTE A SEÇÃO "MEMÓRIA DA CONVERSA" acima - NÃO repita perguntas sobre informações já coletadas
4. Continue de onde parou - se fez uma pergunta, aguarde a resposta antes de fazer outra
5. Se o cliente já respondeu algo, USE essa informação - não pergunte novamente
6. Use conectores naturais como: "Certo", "Entendi", "Perfeito", "Tudo bem"
7. Faça apenas UMA pergunta por mensagem - aguarde a resposta antes de prosseguir

## 🚫 REGRAS ANTI-REPETIÇÃO (CRÍTICO - VOCÊ SERÁ AVALIADO NISSO)
1. NUNCA use "Perfeito" mais de 2 vezes na mesma conversa - VARIE suas confirmações
2. Alternativas para "Perfeito": "Certo", "Entendi", "Anotei", "Combinado", "Ótimo", "Tudo certo", "Beleza"
3. NUNCA confirme informações que o cliente ACABOU de dar claramente - é redundante e irritante
4. Se o cliente diz "Félix" quando você pergunta o nome, NÃO responda "Félix, certo?" - apenas prossiga
5. Mantenha respostas em UMA ÚNICA mensagem - não fragmente em múltiplas mensagens curtas
6. NUNCA repita a mesma estrutura de frase em mensagens consecutivas
7. Seja CONCISO - evite verbosidade desnecessária
8. Quando o cliente confirmar algo ("sim", "ok", "pode ser"), PROSSIGA para o próximo passo imediatamente
9. Evite frases genéricas como "Fico feliz em ajudar" repetidamente

## 🛑 REGRAS DE ENCERRAMENTO (CRÍTICO)
1. Quando o cliente CONFIRMAR o agendamento/contrato/ação final, ENCERRE a conversa
2. Após confirmação final: agradeça brevemente e diga que a equipe entrará em contato
3. EXECUTE /desativar_agente IMEDIATAMENTE após a despedida final
4. NÃO faça perguntas adicionais após o cliente confirmar que pode encerrar
5. Se o cliente disser "ok, pode encerrar" ou similar, ENCERRE IMEDIATAMENTE

## INSTRUÇÕES GERAIS
1. Responda de forma natural e humana - evite parecer robótico ou repetitivo
2. Seja objetivo e direto - vá direto ao ponto
3. Use emojis com MODERAÇÃO (máximo 2-3 por mensagem)
4. Se não souber responder algo específico, direcione para um atendente humano
5. Nunca invente informações - use apenas o que está no roteiro, regras e FAQ
6. Mantenha o tom profissional mas acolhedor
7. Se o cliente enviar uma imagem, vídeo ou documento, ANALISE o conteúdo e responda de forma contextualizada
8. VARIE seu vocabulário - não use as mesmas palavras repetidamente`;

    console.log('📝 System prompt criado (' + systemPrompt.length + ' chars)');
    console.log('📝 Histórico:', conversationHistory.length, 'mensagens');
    console.log('🖼️ Imagens para análise:', imageUrls.length);
    console.log('🎬 Vídeos para análise:', videoUrls.length);
    console.log('📄 Documentos para análise:', documentData.length);

    const agentTemperature = agent.temperature ?? 1.0;
    console.log('🌡️ Temperatura configurada:', agentTemperature);

    let aiResponse: string = '';
    let modelUsed: string = 'gemini-3-flash-preview';
    let toolCallsFromApi: any[] = []; // Store tool calls from API response

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
      
      let mediaData: { base64: string; mimeType: string } | null = null;
      let mediaPrompt: string;
      
      if (shouldUseMultimodalImage) {
        // Image analysis
        console.log('🖼️ Usando Gemini 3 Flash Preview para análise de imagem');
        mediaData = await fetchImageAsBase64(actualMediaUrl);
        mediaPrompt = `${systemPrompt}\n\nHistórico da conversa:\n${historyText}\n\nO cliente acabou de enviar esta imagem${processedMessageContent ? ` com a seguinte mensagem: "${processedMessageContent}"` : ''}. Analise a imagem e responda de forma adequada ao contexto.`;
        
      } else if (shouldUseMultimodalVideo) {
        // Video analysis
        console.log('🎬 Usando Gemini 3 Flash Preview para análise de vídeo');
        mediaData = await fetchVideoAsBase64(actualMediaUrl);
        mediaPrompt = `${systemPrompt}\n\nHistórico da conversa:\n${historyText}\n\nO cliente acabou de enviar este vídeo${processedMessageContent ? ` com a seguinte mensagem: "${processedMessageContent}"` : ''}. Analise o conteúdo visual e de áudio do vídeo e responda de forma adequada ao contexto. Descreva o que você vê e ouve no vídeo se for relevante para a conversa.`;
        
      } else if (shouldUseMultimodalDocument) {
        // Document analysis
        console.log('📄 Usando Gemini 3 Flash Preview para análise de documento');
        mediaData = await fetchDocumentAsBase64(actualMediaUrl, currentDocumentFileName);
        const docName = currentDocumentFileName || 'documento';
        mediaPrompt = `${systemPrompt}\n\nHistórico da conversa:\n${historyText}\n\nO cliente acabou de enviar o documento "${docName}"${processedMessageContent ? ` com a seguinte mensagem: "${processedMessageContent}"` : ''}. Analise o conteúdo do documento e responda de forma adequada ao contexto. Extraia informações relevantes do documento se necessário.`;
        
      } else {
        mediaPrompt = '';
      }
      
      if (!mediaData) {
        const mediaType = shouldUseMultimodalImage ? 'imagem' : shouldUseMultimodalVideo ? 'vídeo' : 'documento';
        console.log(`❌ Não foi possível baixar o ${mediaType}`);
        await supabase.from('ai_agent_logs').insert({
          agent_id: agent.id,
          conversation_id: conversationId,
          action_type: 'response_error',
          input_text: processedMessageContent,
          error_message: `Failed to fetch ${mediaType}`,
          metadata: { messageType, hasMedia: true, mediaType }
        });
        
        // Fallback: continue without multimodal analysis
        console.log(`⚠️ Continuando sem análise multimodal - usando texto como fallback`);
        const fallbackContent = shouldUseMultimodalImage ? '[Cliente enviou uma imagem que não pôde ser analisada]' :
                               shouldUseMultimodalVideo ? '[Cliente enviou um vídeo que não pôde ser analisado]' :
                               `[Cliente enviou documento "${currentDocumentFileName}" que não pôde ser analisado]`;
        processedMessageContent = fallbackContent + (processedMessageContent ? ` - Mensagem do cliente: ${processedMessageContent}` : '');
        // Continue to text-only processing below
      } else {
        // Process with multimodal
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    inline_data: {
                      mime_type: mediaData.mimeType,
                      data: mediaData.base64
                    }
                  },
                  { text: mediaPrompt }
                ]
              }],
              generationConfig: {
                temperature: agentTemperature,
                maxOutputTokens: 1500
              }
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          const mediaType = shouldUseMultimodalImage ? 'image' : shouldUseMultimodalVideo ? 'video' : 'document';
          console.log(`❌ Gemini multimodal error (${mediaType}):`, response.status, errorText);
          
          await supabase.from('ai_agent_logs').insert({
            agent_id: agent.id,
            conversation_id: conversationId,
            action_type: 'response_error',
            input_text: processedMessageContent,
            error_message: `Gemini multimodal error: ${response.status}`,
            metadata: { errorDetails: errorText, messageType, mediaType }
          });

          return new Response(
            JSON.stringify({ success: false, error: 'AI API error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const aiData = await response.json();
        const mediaType = shouldUseMultimodalImage ? 'imagem' : shouldUseMultimodalVideo ? 'vídeo' : 'documento';
        console.log(`📦 Resposta Gemini (${mediaType}):`, JSON.stringify(aiData, null, 2).substring(0, 500) + '...');
        aiResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        
        // Retry with lower temperature if empty
        if (!aiResponse) {
          console.log('⚠️ Resposta multimodal vazia - tentando retry com temperatura 0.5');
          const retryResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: mediaData.mimeType, data: mediaData.base64 } },
                    { text: mediaPrompt }
                  ]
                }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 1500 }
              })
            }
          );
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            console.log('🔄 Retry multimodal result:', JSON.stringify(retryData, null, 2).substring(0, 500) + '...');
            aiResponse = retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          }
        }
      }
    }
    
    // If multimodal didn't produce a response (either not multimodal or fallback), use text-only
    if (!aiResponse) {
      // Use Gemini 3 Flash Preview with Function Calling
      console.log('📝 Usando Gemini 3 Flash Preview com Function Calling');
      console.log('🔧 Tools disponíveis:', dynamicTools.length);
      modelUsed = 'gemini-3-flash-preview';
      
      // Build conversation context as single prompt
      const conversationContextForPrompt = conversationHistory
        .filter(msg => msg !== null)
        .map(msg => `${msg!.role === 'assistant' ? '[ATENDENTE]' : '[CLIENTE]'}: ${msg!.content}`)
        .join('\n');
      
      const fullPrompt = `${systemPrompt}\n\nHistórico da conversa:\n${conversationContextForPrompt}\n\n[CLIENTE]: ${processedMessageContent || '[Mensagem sem texto]'}\n\nGere a resposta do atendente. Se precisar executar ações (mover no CRM, adicionar etiqueta, etc), use as ferramentas disponíveis:`;
      
      const agentTemperature = agent.temperature ?? 1.0;
      
      // Convert OpenAI tool format to Gemini function_declarations format
      const geminiTools = dynamicTools.length > 0 ? [{
        function_declarations: dynamicTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }] : undefined;
      
      // Build request body
      const requestBody: any = {
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: agentTemperature,
          maxOutputTokens: 1500
        }
      };

      // Add tools if available
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
      
      // Extract text response and function calls from Gemini response
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
        }
      }
      
      // Fallback with even lower temperature if still empty
      if (!aiResponse) {
        console.log('⚠️ Ainda vazio - tentando fallback com temperatura 0.3');
        const fallbackResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
            })
          }
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('✅ Fallback result:', JSON.stringify(fallbackData, null, 2).substring(0, 500) + '...');
          aiResponse = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
      }
    }

    if (!aiResponse) {
      console.log('❌ Nenhuma resposta gerada após todos os retries');
      await supabase.from('ai_agent_logs').insert({
        agent_id: agent.id,
        conversation_id: conversationId,
        action_type: 'response_error',
        input_text: processedMessageContent,
        error_message: 'No response generated after all retries',
        metadata: { attemptedRetry: true, attemptedFallback: true }
      });
      
      return new Response(
        JSON.stringify({ success: false, error: 'No response generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Resposta gerada:', aiResponse.substring(0, 100) + '...');

    // 7️⃣ Parse and execute slash commands from response
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 5️⃣  PROCESSAR COMANDOS SLASH NA RESPOSTA                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Get conversation details for command execution
    const { data: conversationData } = await supabase
      .from('conversations')
      .select('contact_id, company_id, whatsapp_connection_id')
      .eq('id', conversationId)
      .single();

    const contactId = conversationData?.contact_id;
    const companyId = conversationData?.company_id;

    // 🚀 FLAGS PARA RESPOSTA IMEDIATA APÓS TRANSFERÊNCIA DE AGENTE
    let agentTransferOccurred = false;
    let transferredToAgentId: string | null = null;
    let transferredToAgentName: string | null = null;

    // Command handlers
    const commandHandlers: Record<string, (value: string) => Promise<void>> = {
      // Add tag to contact - with validation against tags table
      'adicionar_etiqueta': async (tagName: string) => {
        if (!contactId || !companyId) return;
        console.log('🏷️ Tentando adicionar etiqueta:', tagName);
        
        // Validate tag exists in the tags table
        const { data: existingTag, error: tagError } = await supabase
          .from('tags')
          .select('name')
          .eq('company_id', companyId)
          .ilike('name', tagName)
          .maybeSingle();
        
        if (tagError) {
          console.log('⚠️ Erro ao buscar etiqueta:', tagError.message);
          return;
        }
        
        if (!existingTag) {
          // Tag doesn't exist - log warning and DO NOT add
          console.log(`⚠️ [TAG] Etiqueta "${tagName}" não existe na tabela tags. Ignorando.`);
          
          // Debug: list available tags for this company
          const { data: availableTags } = await supabase
            .from('tags')
            .select('name')
            .eq('company_id', companyId);
          console.log('📋 [TAG] Etiquetas disponíveis:', availableTags?.map(t => t.name).join(', ') || 'nenhuma');
          return;
        }
        
        // Use the exact name from the database
        const validTagName = existingTag.name;
        console.log('✅ [TAG] Etiqueta válida encontrada:', validTagName);
        
        // Get current tags
        const { data: contact } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contactId)
          .single();
        
        const currentTags = contact?.tags || [];
        if (!currentTags.includes(validTagName)) {
          await supabase
            .from('contacts')
            .update({ tags: [...currentTags, validTagName] })
            .eq('id', contactId);
          console.log('✅ Etiqueta adicionada com sucesso:', validTagName);
        } else {
          console.log('ℹ️ Contato já possui esta etiqueta:', validTagName);
        }
      },

      // Transfer to another AI agent (sub-agent)
      'transferir_agente': async (agentIdentifier: string) => {
        console.log('🤖 [TRANSFER] Iniciando transferência para agente:', agentIdentifier);
        console.log('🔍 [TRANSFER] Company ID:', companyId);
        
        // Validate if identifier is a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUuid = uuidRegex.test(agentIdentifier);
        
        let targetAgent = null;
        let agentError = null;
        
        if (isUuid) {
          // Search by exact UUID
          console.log('🔍 [TRANSFER] Buscando por UUID:', agentIdentifier);
          const result = await supabase
            .from('ai_agents')
            .select('id, name, parent_agent_id')
            .eq('id', agentIdentifier)
            .eq('company_id', companyId)
            .eq('status', 'active')
            .maybeSingle();
          targetAgent = result.data;
          agentError = result.error;
        } else {
          // Search by name using ILIKE with % wildcard (PostgreSQL standard)
          console.log('🔍 [TRANSFER] Buscando por nome:', agentIdentifier);
          const result = await supabase
            .from('ai_agents')
            .select('id, name, parent_agent_id')
            .ilike('name', `%${agentIdentifier}%`)
            .eq('company_id', companyId)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
          targetAgent = result.data;
          agentError = result.error;
        }
        
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
            
            // 🚀 MARCAR FLAG PARA RESPOSTA IMEDIATA DO NOVO AGENTE
            agentTransferOccurred = true;
            transferredToAgentId = targetAgent.id;
            transferredToAgentName = targetAgent.name;
            console.log('🚀 [TRANSFER] Flag de transferência ativado para resposta imediata');
          }
        } else {
          console.log('⚠️ [TRANSFER] Agente não encontrado:', agentIdentifier);
          
          // Debug: list all active agents for this company
          const { data: allAgents } = await supabase
            .from('ai_agents')
            .select('id, name, status')
            .eq('company_id', companyId)
            .eq('status', 'active');
          console.log('📋 [TRANSFER] Agentes ativos disponíveis:', allAgents?.map(a => a.name).join(', ') || 'nenhum');
        }
      },

      // Transfer to human user
      'transferir_usuario': async (userIdentifier: string) => {
        console.log('👤 Transferindo para usuário:', userIdentifier);
        
        // Find user by name
        const { data: targetUser } = await supabase
          .from('profiles')
          .select('id, full_name')
          .ilike('full_name', `%${userIdentifier}%`)
          .eq('company_id', companyId)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        
        if (targetUser) {
          // Assign conversation to user and deactivate AI
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
        
        // Find the kanban card for this contact
        const { data: card } = await supabase
          .from('kanban_cards')
          .select('id, column_id, kanban_columns!inner(board_id)')
          .eq('contact_id', contactId)
          .limit(1)
          .maybeSingle();
        
        if (card) {
          const boardId = (card as any).kanban_columns.board_id;
          
          // Normalize input for comparison
          const normalizedInput = stageName.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');
          
          // First try exact match, then try normalized match, then ilike
          let targetColumn = null;
          
          // 1. Try exact match by name
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
            // 2. Try case-insensitive ilike match
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
              // 3. Try partial match
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
                // 4. Load all columns and try normalized comparison
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

      // Notify team - Creates real notifications for admins/owners
      'notificar_equipe': async (message: string) => {
        console.log('🔔 [NOTIFICAR_EQUIPE] Iniciando notificação:', message);
        
        try {
          // Step 1: Get company ID from connection
          const { data: connData, error: connError } = await supabase
            .from('whatsapp_connections')
            .select('company_id')
            .eq('id', connectionId)
            .single();
          
          if (connError) {
            console.log('❌ [NOTIFICAR_EQUIPE] Erro ao buscar connection:', connError.message);
            return;
          }
          
          if (!connData?.company_id) {
            console.log('⚠️ [NOTIFICAR_EQUIPE] Company não encontrada para connection:', connectionId);
            return;
          }
          
          console.log('🏢 [NOTIFICAR_EQUIPE] Company ID:', connData.company_id);
          
          // Step 2: Get all profiles from this company (separate query to avoid JOIN issues)
          const { data: companyProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('company_id', connData.company_id)
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
          console.log('👤 [NOTIFICAR_EQUIPE] User IDs para verificar roles:', userIds.join(', '));
          
          // Step 3: Get admins/owners from user_roles (separate query to avoid JOIN issues)
          const { data: adminRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds)
            .in('role', ['owner', 'admin']);
          
          if (rolesError) {
            console.log('❌ [NOTIFICAR_EQUIPE] Erro ao buscar roles:', rolesError.message);
            return;
          }
          
          console.log(`🔑 [NOTIFICAR_EQUIPE] Roles encontrados:`, JSON.stringify(adminRoles));
          
          const companyAdmins = adminRoles || [];
          console.log(`📢 [NOTIFICAR_EQUIPE] Total de ${companyAdmins.length} admins/owners para notificar`);
          
          if (companyAdmins.length === 0) {
            console.log('⚠️ [NOTIFICAR_EQUIPE] Nenhum admin/owner encontrado - verifique a tabela user_roles');
            return;
          }
          
          // Step 4: Get contact info for context
          const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('contact_id, contacts(name, phone_number)')
            .eq('id', conversationId)
            .single();
          
          if (convError) {
            console.log('⚠️ [NOTIFICAR_EQUIPE] Erro ao buscar conversa:', convError.message);
          }
          
          const contactInfo = convData?.contacts as any;
          const notificationMessage = `🤖 Notificação do Agente IA: ${message}${
            contactInfo ? `\n👤 Cliente: ${contactInfo.name || contactInfo.phone_number}` : ''
          }`;
          
          console.log('📝 [NOTIFICAR_EQUIPE] Mensagem de notificação:', notificationMessage);
          
          // Step 5: Create mention notifications for each admin
          let successCount = 0;
          for (const admin of companyAdmins) {
            const { error: insertError } = await supabase.from('mention_notifications').insert({
              mentioned_user_id: admin.user_id,
              mentioner_user_id: admin.user_id, // Self-mention for system notification
              message_id: crypto.randomUUID(), // Placeholder since this is a system notification
              source_type: 'internal_note', // Valid value for the constraint
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
          
          // Step 6: Create an internal note in the conversation for audit trail
          const { error: noteError } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            content: notificationMessage,
            direction: 'outbound',
            sender_type: 'system', // Valid enum value
            message_type: 'text',
            is_internal_note: true,
            status: 'sent'
          });
          
          if (noteError) {
            console.log('⚠️ [NOTIFICAR_EQUIPE] Erro ao criar nota interna:', noteError.message);
          }
          
          console.log(`✅ [NOTIFICAR_EQUIPE] Notificações criadas: ${successCount}/${companyAdmins.length}`);
        } catch (notifyError) {
          console.error('❌ [NOTIFICAR_EQUIPE] Erro inesperado:', notifyError);
        }
      },

      // Assign department
      'atribuir_departamento': async (deptName: string) => {
        console.log('🏢 Atribuindo departamento:', deptName);
        
        // Find department by name
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
    // PROCESS TOOL CALLS FROM API (PRIMARY METHOD)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🔧 PROCESSAR TOOL CALLS DA API                                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let cleanResponse = aiResponse;
    const executedCommands: string[] = [];

    // Execute tool calls from API response FIRST (structured, validated)
    if (toolCallsFromApi.length > 0) {
      console.log(`🔧 Executando ${toolCallsFromApi.length} tool calls da API:`);
      
      for (const toolCall of toolCallsFromApi) {
        const { name, arguments: args } = toolCall;
        console.log(`   📌 Tool: ${name}`, args);
        
        try {
          switch (name) {
            case 'mudar_etapa_crm':
              await commandHandlers['mudar_etapa_crm'](args.stage_slug);
              executedCommands.push(`mudar_etapa_crm:${args.stage_slug} (tool)`);
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
              executedCommands.push(`notificar_equipe:${args.message} (tool)`);
              break;
              
            case 'desativar_agente':
              await commandHandlers['desativar_agente']('');
              executedCommands.push('desativar_agente (tool)');
              break;
              
            case 'atribuir_origem':
              await commandHandlers['atribuir_origem'](args.origin);
              executedCommands.push(`atribuir_origem:${args.origin} (tool)`);
              break;
              
            default:
              console.log(`⚠️ Tool desconhecida: ${name}`);
          }
        } catch (err) {
          console.error(`❌ Erro ao executar tool ${name}:`, err);
        }
      }
    } else {
      console.log('ℹ️ Nenhum tool call da API');
    }

    // ═══════════════════════════════════════════════════════════════════
    // FALLBACK: PROCESS SLASH COMMANDS IN TEXT (LEGACY/BACKUP)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 📝 FALLBACK: COMANDOS SLASH NO TEXTO                           │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Parse and execute commands (fallback for slash commands in text)
    // Supports both bracketed [Value With Spaces] and simple values
    const commandPatterns = [
      { pattern: /\/adicionar_etiqueta:(?:\[([^\]]+)\]|([^\n\/\s]+))/gi, handler: 'adicionar_etiqueta' },
      { pattern: /\/transferir_agente:(?:\[([^\]]+)\]|([^\n\/\s]+))/gi, handler: 'transferir_agente' },
      { pattern: /\/transferir_usuario:(?:\[([^\]]+)\]|([^\n\/\s]+))/gi, handler: 'transferir_usuario' },
      { pattern: /\/atribuir_origem:(?:\[([^\]]+)\]|([^\n\/\s]+))/gi, handler: 'atribuir_origem' },
      { pattern: /\/mudar_etapa_crm:(?:\[([^\]]+)\]|([^\n\/\s]+))/gi, handler: 'mudar_etapa_crm' },
      { pattern: /\/notificar_equipe:(?:\[([^\]]+)\]|([^\n]+))/gi, handler: 'notificar_equipe' },
      { pattern: /\/atribuir_departamento:(?:\[([^\]]+)\]|([^\n\/\s]+))/gi, handler: 'atribuir_departamento' },
      { pattern: /\/desativar_agente/gi, handler: 'desativar_agente' },
    ];

    let slashCommandsFound = 0;
    for (const { pattern, handler } of commandPatterns) {
      const matches = [...aiResponse.matchAll(pattern)];
      for (const match of matches) {
        slashCommandsFound++;
        // Extract value from bracketed group (match[1]) or simple group (match[2])
        const value = (match[1] || match[2] || '').trim();
        
        // Check if this command was already executed via tool call
        const alreadyExecuted = executedCommands.some(cmd => 
          cmd.startsWith(`${handler}:${value}`) || 
          (handler === 'desativar_agente' && cmd.includes('desativar_agente'))
        );
        
        if (!alreadyExecuted) {
          try {
            await commandHandlers[handler](value);
            executedCommands.push(`${handler}:${value} (regex)`);
            console.log(`✅ Comando regex executado: ${handler}:${value}`);
          } catch (err) {
            console.error(`❌ Erro ao executar comando ${handler}:`, err);
          }
        } else {
          console.log(`⏭️ Comando já executado via tool: ${handler}:${value}`);
        }
        
        // Always remove command from response text
        cleanResponse = cleanResponse.replace(match[0], '').trim();
      }
    }

    // 🧹 LIMPEZA DE COMANDOS INVÁLIDOS
    // Remove any remaining slash commands that weren't recognized (supports bracketed values)
    const invalidCommandPattern = /\/[a-z_]+(?::(?:\[[^\]]+\]|[^\n]+))?/gi;
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
      
      // Carregar dados completos do novo agente
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
        
        // Construir prompt simplificado para o novo agente
        const newAgentCompanyInfo = newAgent.company_info || {};
        let newAgentSystemPrompt = `Você é ${newAgent.name}, um assistente virtual especializado.

`;
        
        if (newAgent.script_content) {
          newAgentSystemPrompt += `## ROTEIRO DE ATENDIMENTO
${newAgent.script_content}

`;
        }
        
        if (newAgent.rules_content) {
          newAgentSystemPrompt += `## REGRAS DE COMPORTAMENTO
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
        
        // Adicionar contexto da conversa
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
        
        // Gerar resposta do novo agente
        const newAgentTemperature = newAgent.temperature ?? 1.0;
        const newAgentApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
        
        try {
          const newAgentApiResponse = await fetch(newAgentApiUrl, {
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
          });
          
          const newAgentResult = await newAgentApiResponse.json();
          const newAiResponse = newAgentResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (newAiResponse) {
            console.log('✅ Resposta do novo agente gerada');
            console.log('📝 Preview:', newAiResponse.substring(0, 100) + '...');
            
            // Combinar resposta: mensagem de transferência + resposta do novo agente
            // Limpar a resposta do agente anterior (remover texto após menção de transferência se necessário)
            const transferPatterns = [
              /vou\s+te\s+transferir/gi,
              /transferindo\s+para/gi,
              /vou\s+transferir\s+você/gi,
              /deixa\s+eu\s+te\s+transferir/gi,
              /encaminhando\s+para/gi
            ];
            
            let previousAgentMessage = cleanResponse;
            for (const pattern of transferPatterns) {
              const match = previousAgentMessage.match(pattern);
              if (match) {
                // Encontrar onde a mensagem de transferência termina
                const idx = previousAgentMessage.search(pattern);
                // Pegar apenas até o fim da frase que menciona a transferência
                const afterPattern = previousAgentMessage.substring(idx);
                const sentenceEnd = afterPattern.search(/[.!?]\s*$/);
                if (sentenceEnd > 0) {
                  previousAgentMessage = previousAgentMessage.substring(0, idx + sentenceEnd + 1);
                }
                break;
              }
            }
            
            // Usar apenas a resposta do novo agente (não concatenar com separador)
            // O agente anterior já indicou a transferência, a mensagem do novo agente é a continuação natural
            cleanResponse = newAiResponse.trim();
            
            // Atualizar referência do agente para o return
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
          // Manter a resposta original em caso de erro
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
      
      // Fetch media from database
      const { data: media } = await supabase
        .from('ai_agent_media')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('media_key', mediaKey)
        .maybeSingle();
      
      if (media) {
        let mediaUrl = media.media_url || undefined;
        
        // Generate signed URL for private bucket storage
        if (mediaUrl && mediaUrl.includes('/ai-agent-media/')) {
          try {
            // Extract storage path from full URL
            const urlParts = mediaUrl.split('/ai-agent-media/');
            if (urlParts.length > 1) {
              const storagePath = decodeURIComponent(urlParts[1].split('?')[0]); // Remove any query params
              console.log(`🔑 Gerando signed URL para: ${storagePath}`);
              
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('ai-agent-media')
                .createSignedUrl(storagePath, 3600); // 1 hour validity
              
              if (signedUrlData?.signedUrl) {
                mediaUrl = signedUrlData.signedUrl;
                console.log(`✅ Signed URL gerada com sucesso`);
              } else if (signedUrlError) {
                console.log(`⚠️ Erro ao gerar signed URL: ${signedUrlError.message}`);
              }
            }
          } catch (signedUrlErr) {
            console.log(`⚠️ Erro ao processar signed URL:`, signedUrlErr);
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
      
      // Remove tag from response
      cleanResponse = cleanResponse.replace(fullMatch, '').trim();
    }

    // Clean up multiple spaces and empty lines again after removing media tags
    cleanResponse = cleanResponse.replace(/\n\s*\n/g, '\n').trim();

    if (mediasToSend.length > 0) {
      console.log(`📦 Total de mídias para enviar: ${mediasToSend.length}`);
    }

    // Use cleaned response
    aiResponse = cleanResponse;

    // ═══════════════════════════════════════════════════════════════════
    // EXTRACT AND UPDATE STRUCTURED CONTEXT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 🧠 EXTRAIR E SALVAR CONTEXTO ESTRUTURADO                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let updatedContext = conversationContext;
    
    try {
      // Make extraction call to AI
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
              temperature: 0.1, // Low temperature for consistent extraction
              maxOutputTokens: 1000
            }
          })
        }
      );
      
      if (extractionResponse.ok) {
        const extractionData = await extractionResponse.json();
        const extractedText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        
        console.log('📝 Resposta da extração:', extractedText.substring(0, 200) + '...');
        
        // Parse the JSON response
        try {
          // Clean up potential markdown code blocks
          const cleanedJson = extractedText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          
          const extractedInfo = JSON.parse(cleanedJson) as Partial<ConversationContext>;
          
          // Add executed commands to context
          if (executedCommands.length > 0) {
            extractedInfo.acoes_executadas = executedCommands;
          }
          
          // Merge with existing context
          updatedContext = mergeContext(conversationContext, extractedInfo);
          
          console.log('✅ Contexto atualizado com sucesso');
          console.log('   - Lead info:', Object.keys(updatedContext.lead).filter(k => updatedContext.lead[k]).length, 'campos');
          console.log('   - Interesse:', updatedContext.interesse.principal || 'não identificado');
          console.log('   - Qualificação:', updatedContext.qualificacao.nivel || 'não definido');
          console.log('   - Histórico:', updatedContext.historico_resumido.length, 'interações');
          
        } catch (parseError) {
          console.log('⚠️ Erro ao parsear JSON da extração (não fatal):', parseError);
          // Continue with existing context
        }
      } else {
        console.log('⚠️ Extração falhou (não fatal):', extractionResponse.status);
      }
    } catch (extractionError) {
      console.log('⚠️ Erro na extração de contexto (não fatal):', extractionError);
      // Continue with existing context - extraction failure shouldn't block the response
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

    // 9️⃣ Log the interaction
    await supabase.from('ai_agent_logs').insert({
      agent_id: agent.id,
      conversation_id: conversationId,
      action_type: 'response_generated',
      input_text: processedMessageContent || messageContent,
      output_text: aiResponse,
      tokens_used: 0,
      processing_time_ms: 0,
      metadata: {
        model: modelUsed,
        contactName,
        wasAlreadyActive: isConversationActive,
        messageType,
        hasImage: shouldUseMultimodal,
        wasTranscribed: currentMessageIsAudio,
        executedCommands: executedCommands.length > 0 ? executedCommands : undefined,
        toolCallsCount: toolCallsFromApi.length,
        toolCallsUsed: toolCallsFromApi.length > 0,
        contextUpdated: true,
        agentTransferOccurred,
        transferredToAgentId: agentTransferOccurred ? transferredToAgentId : undefined,
        transferredToAgentName: agentTransferOccurred ? transferredToAgentName : undefined
      }
    });

    // 🔟 Return response with delay info and audio config
    // Determine if audio should be generated based on audio settings
    const shouldGenerateAudio = 
      agent.audio_enabled === true && 
      agent.voice_name && 
      (
        agent.audio_always_respond_audio === true ||
        (agent.audio_respond_with_audio === true && messageType === 'audio')
      );

    console.log('🔊 Audio config:', {
      audio_enabled: agent.audio_enabled,
      audio_always_respond_audio: agent.audio_always_respond_audio,
      audio_respond_with_audio: agent.audio_respond_with_audio,
      voice_name: agent.voice_name,
      messageType,
      shouldGenerateAudio
    });

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        agentId: agent.id,
        agentName: agent.name,
        delaySeconds: agent.delay_seconds || 0,
        voiceName: shouldGenerateAudio ? agent.voice_name : null,
        shouldGenerateAudio,
        speechSpeed: agent.speech_speed || 1.0,
        audioTemperature: agent.audio_temperature || 0.7,
        languageCode: agent.language_code || 'pt-BR',
        mediasToSend: mediasToSend.length > 0 ? mediasToSend : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ AI Agent Process error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
