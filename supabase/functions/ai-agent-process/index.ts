import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Helper function to transcribe audio
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('🎤 Transcrevendo áudio:', audioUrl.substring(0, 80) + '...');
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.log('❌ Falha ao baixar áudio:', audioResponse.status);
      return null;
    }
    
    const audioBlob = await audioResponse.blob();
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    let extension = 'ogg';
    if (contentType.includes('mp3')) extension = 'mp3';
    else if (contentType.includes('wav')) extension = 'wav';
    else if (contentType.includes('webm')) extension = 'webm';
    else if (contentType.includes('m4a')) extension = 'm4a';
    else if (contentType.includes('mpeg')) extension = 'mp3';
    
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${extension}`);
    formData.append('model', 'gpt-4o-transcribe');
    formData.append('language', 'pt');
    
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });
    
    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.log('❌ Erro na transcrição:', transcriptionResponse.status, errorText);
      return null;
    }
    
    const result = await transcriptionResponse.json();
    console.log('✅ Áudio transcrito:', result.text?.substring(0, 50) + '...');
    return result.text || null;
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
          agent = {
            ...agent,
            name: subAgent.name,
            script_content: subAgent.script_content || agent.script_content,
            rules_content: subAgent.rules_content || agent.rules_content,
            faq_content: subAgent.faq_content || agent.faq_content,
            company_info: subAgent.company_info || agent.company_info,
            temperature: subAgent.temperature ?? agent.temperature
          };
          console.log('✅ Sub-agente carregado:', subAgent.name);
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

    const AI_API_KEY = Deno.env.get('AI_AGENTS_OPENAI_API_KEY');
    if (!AI_API_KEY) {
      console.log('❌ AI_AGENTS_OPENAI_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'AI API key not configured' }),
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

    // Collect images for potential multimodal analysis
    const imageUrls: string[] = [];

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
          messageText = m.content 
            ? `[Vídeo com legenda]: ${m.content}` 
            : '[Cliente enviou um vídeo]';
        } else if (m.message_type === 'document') {
          const fileName = metadata?.fileName || metadata?.file_name || 'documento';
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

    // Check if current message is image/audio that needs special processing
    // For batch requests, check the last message type
    let currentMessageIsImage = messageType === 'image';
    let currentMessageIsAudio = messageType === 'audio';
    let actualMediaUrl = mediaUrl;
    
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
            const transcription = await transcribeAudio(msg.mediaUrl, AI_API_KEY);
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
        }
      }
      
      // Join all messages with newline for context
      processedMessageContent = batchContents.join('\n');
      
      // Check last message type for special processing
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        currentMessageIsImage = lastMsg.type === 'image';
        currentMessageIsAudio = lastMsg.type === 'audio';
        if (lastMsg.mediaUrl) actualMediaUrl = lastMsg.mediaUrl;
      }
      
      console.log('📦 Batch combined:', processedMessageContent.substring(0, 100) + '...');
    } else {
      // Legacy single message processing
      processedMessageContent = messageContent || '';
    }
    
    // Get the actual mediaUrl if not provided (media may have been processed in background)
    if ((currentMessageIsImage || currentMessageIsAudio) && !actualMediaUrl) {
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
      }
    }
    
    // Handle audio transcription for current message (legacy mode)
    if (!isBatchRequest && currentMessageIsAudio && actualMediaUrl && !processedMessageContent) {
      console.log('🎤 Transcrevendo áudio do cliente...');
      const transcription = await transcribeAudio(actualMediaUrl, AI_API_KEY);
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
    let availableCrmStages: { name: string; slug: string }[] = [];
    const { data: kanbanBoard } = await supabase
      .from('kanban_boards')
      .select('id')
      .eq('whatsapp_connection_id', connectionId)
      .maybeSingle();
    
    if (kanbanBoard) {
      const { data: columns } = await supabase
        .from('kanban_columns')
        .select('name, position')
        .eq('board_id', kanbanBoard.id)
        .order('position', { ascending: true });
      
      if (columns) {
        availableCrmStages = columns.map(col => ({
          name: col.name,
          slug: col.name.toLowerCase()
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
      const { data: contacts } = await supabase
        .from('contacts')
        .select('tags')
        .eq('company_id', connectionCompanyId)
        .not('tags', 'is', null);
      
      if (contacts) {
        const allTags = new Set<string>();
        for (const contact of contacts) {
          if (Array.isArray(contact.tags)) {
            for (const tag of contact.tags) {
              if (tag) allTags.add(tag);
            }
          }
        }
        availableTags = Array.from(allTags).sort();
      }
    }
    console.log('🏷️ Etiquetas disponíveis:', availableTags.length);

    // Load active AI agents (sub-agents) for this company
    let availableAgents: { name: string; description: string | null }[] = [];
    if (connectionCompanyId) {
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('name, description')
        .eq('company_id', connectionCompanyId)
        .eq('status', 'active')
        .neq('id', agent.id); // Exclude current agent
      
      if (agents) {
        availableAgents = agents.map(a => ({ name: a.name, description: a.description }));
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
        function: {
          name: "mudar_etapa_crm",
          description: "Move o card do cliente para outra etapa no CRM/Kanban. Use quando o lead avançar no funil de vendas.",
          parameters: {
            type: "object",
            properties: {
              stage_slug: {
                type: "string",
                enum: availableCrmStages.map(s => s.slug),
                description: `Slug da etapa destino. Opções: ${availableCrmStages.map(s => `"${s.slug}" (${s.name})`).join(', ')}`
              }
            },
            required: ["stage_slug"],
            additionalProperties: false
          }
        }
      });
    }

    // Tool: adicionar_etiqueta - With enum if tags exist, otherwise string
    dynamicTools.push({
      type: "function",
      function: {
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
          required: ["tag_name"],
          additionalProperties: false
        }
      }
    });

    // Tool: transferir_agente - Only if there are other agents
    if (availableAgents.length > 0) {
      dynamicTools.push({
        type: "function",
        function: {
          name: "transferir_agente",
          description: "Transfere a conversa para outro agente de IA especializado.",
          parameters: {
            type: "object",
            properties: {
              agent_name: {
                type: "string",
                enum: availableAgents.map(a => a.name),
                description: `Nome do agente destino. Opções: ${availableAgents.map(a => `"${a.name}"${a.description ? ` - ${a.description}` : ''}`).join('; ')}`
              }
            },
            required: ["agent_name"],
            additionalProperties: false
          }
        }
      });
    }

    // Tool: atribuir_departamento - Only if there are departments
    if (availableDepartments.length > 0) {
      dynamicTools.push({
        type: "function",
        function: {
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
            required: ["department_name"],
            additionalProperties: false
          }
        }
      });
    }

    // Tool: transferir_usuario - Free text (search by name)
    dynamicTools.push({
      type: "function",
      function: {
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
          required: ["user_name"],
          additionalProperties: false
        }
      }
    });

    // Tool: notificar_equipe - Free text message
    dynamicTools.push({
      type: "function",
      function: {
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
          required: ["message"],
          additionalProperties: false
        }
      }
    });

    // Tool: desativar_agente - No parameters
    dynamicTools.push({
      type: "function",
      function: {
        name: "desativar_agente",
        description: "Desativa o agente de IA permanentemente nesta conversa. Use quando a conversa precisar continuar apenas com humanos.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      }
    });

    // Tool: atribuir_origem - Free text
    dynamicTools.push({
      type: "function",
      function: {
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
          required: ["origin"],
          additionalProperties: false
        }
      }
    });

    console.log('🔧 Tools definidas:', dynamicTools.length);
    console.log('   - Ferramentas:', dynamicTools.map(t => t.function.name).join(', '));

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
  ? availableCrmStages.map(s => `- "${s.name}" → /mudar_etapa_crm:${s.slug}`).join('\n')
  : '- (Nenhuma etapa configurada no CRM)'}

### ETIQUETAS (para /adicionar_etiqueta):
${availableTags.length > 0 
  ? availableTags.map(t => `- ${t}`).join('\n')
  : '- (Nenhuma etiqueta cadastrada ainda - você pode criar novas)'}

### AGENTES DE IA (para /transferir_agente):
${availableAgents.length > 0 
  ? availableAgents.map(a => `- "${a.name}"${a.description ? ` - ${a.description}` : ''}`).join('\n')
  : '- (Nenhum outro agente disponível)'}

### DEPARTAMENTOS (para /atribuir_departamento):
${availableDepartments.length > 0 
  ? availableDepartments.map(d => `- "${d.name}"`).join('\n')
  : '- (Nenhum departamento configurado)'}

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

## INSTRUÇÕES GERAIS
1. Responda de forma natural e amigável
2. Seja objetivo e direto
3. Use emojis moderadamente para criar conexão
4. Se não souber responder algo específico, direcione para um atendente humano
5. Nunca invente informações - use apenas o que está no roteiro, regras e FAQ
6. Mantenha o tom profissional mas acolhedor
7. Se o cliente enviar uma imagem, ANALISE o conteúdo visual e responda de forma contextualizada`;

    console.log('📝 System prompt criado (' + systemPrompt.length + ' chars)');
    console.log('📝 Histórico:', conversationHistory.length, 'mensagens');
    console.log('🖼️ Imagens para análise:', imageUrls.length);

    const agentTemperature = agent.temperature ?? 0.7;
    console.log('🌡️ Temperatura configurada:', agentTemperature);

    let aiResponse: string;
    let modelUsed: string;
    let toolCallsFromApi: any[] = []; // Store tool calls from API response

    // Determine if we should use multimodal (image analysis)
    const shouldUseMultimodal = currentMessageIsImage && actualMediaUrl;

    if (shouldUseMultimodal) {
      // Use multimodal endpoint with gpt-5-nano for image analysis (no tools for now - vision model)
      console.log('🖼️ Usando endpoint multimodal /v1/responses com gpt-5-nano');
      modelUsed = 'gpt-5-nano';
      
      const historyText = conversationHistory.map((m: any) => 
        `${m.role === 'user' ? '[CLIENTE]' : '[AGENTE]'}: ${m.content}`
      ).join('\n');
      
      const contentItems = [
        { 
          type: 'input_text', 
          text: `${systemPrompt}\n\nHistórico da conversa:\n${historyText}\n\nO cliente acabou de enviar esta imagem${processedMessageContent ? ` com a seguinte mensagem: "${processedMessageContent}"` : ''}. Analise a imagem e responda de forma adequada ao contexto.`
        },
        {
          type: 'input_image',
          image_url: actualMediaUrl
        }
      ];
      
      const agentTemperature = agent.temperature ?? 0.7;
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: [
            {
              type: 'message',
              role: 'user',
              content: contentItems
            }
          ],
          text: {
            format: { type: 'text' },
            verbosity: 'medium'
          },
          reasoning: {
            effort: 'low',
            summary: 'concise'
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ OpenAI /v1/responses error:', response.status, errorText);
        
        await supabase.from('ai_agent_logs').insert({
          agent_id: agent.id,
          conversation_id: conversationId,
          action_type: 'response_error',
          input_text: processedMessageContent,
          error_message: `OpenAI /v1/responses error: ${response.status}`,
          metadata: { errorDetails: errorText, messageType, hasImage: true }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'AI API error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await response.json();
      console.log('📦 Resposta API (multimodal):', JSON.stringify(aiData, null, 2));
      aiResponse = aiData.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text?.trim() || '';
      
      // Retry with lower temperature if empty
      if (!aiResponse) {
        console.log('⚠️ Resposta multimodal vazia - tentando retry com temperatura 0.5');
        const retryResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-nano',
            input: [{ type: 'message', role: 'user', content: contentItems }],
            text: { format: { type: 'text' }, verbosity: 'medium' },
            reasoning: { effort: 'low', summary: 'concise' }
          }),
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          console.log('🔄 Retry multimodal result:', JSON.stringify(retryData, null, 2));
          aiResponse = retryData.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text?.trim() || '';
        }
      }
      
    } else {
      // Use /v1/responses endpoint with Tool Calling (compatible with GPT-5 models)
      console.log('📝 Usando endpoint /v1/responses com gpt-5-mini + Tool Calling');
      console.log('🔧 Tools disponíveis:', dynamicTools.length);
      modelUsed = 'gpt-5-mini';
      
      // Build conversation context as single prompt
      const conversationContextForPrompt = conversationHistory
        .filter(msg => msg !== null)
        .map(msg => `${msg!.role === 'assistant' ? '[ATENDENTE]' : '[CLIENTE]'}: ${msg!.content}`)
        .join('\n');
      
      const fullPrompt = `${systemPrompt}\n\nHistórico da conversa:\n${conversationContextForPrompt}\n\n[CLIENTE]: ${processedMessageContent || '[Mensagem sem texto]'}\n\nGere a resposta do atendente. Se precisar executar ações (mover no CRM, adicionar etiqueta, etc), use as ferramentas disponíveis:`;
      
      const agentTemperature = agent.temperature ?? 0.7;
      
      // Build request body with tools
      const requestBody: any = {
        model: 'gpt-5-mini',
        input: fullPrompt,
        text: {
          format: { type: 'text' },
          verbosity: 'medium'
        },
        reasoning: {
          effort: 'low',
          summary: 'concise'
        }
      };

      // Add tools if available
      if (dynamicTools.length > 0) {
        requestBody.tools = dynamicTools;
        requestBody.tool_choice = 'auto'; // Let the model decide when to use tools
      }
      
      const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.log('❌ OpenAI error:', openaiResponse.status, errorText);
        
        await supabase.from('ai_agent_logs').insert({
          agent_id: agent.id,
          conversation_id: conversationId,
          action_type: 'response_error',
          input_text: processedMessageContent,
          error_message: `OpenAI API error: ${openaiResponse.status}`,
          metadata: { errorDetails: errorText, toolsCount: dynamicTools.length }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'AI API error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await openaiResponse.json();
      console.log('📦 Resposta API (texto + tools):', JSON.stringify(aiData, null, 2));
      
      // Extract text response
      aiResponse = aiData.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text?.trim() || '';
      
      // Extract tool calls from the response
      const functionCalls = aiData.output?.filter((o: any) => o.type === 'function_call') || [];
      if (functionCalls.length > 0) {
        console.log('🔧 Tool calls encontrados:', functionCalls.length);
        for (const fc of functionCalls) {
          console.log(`   - ${fc.name}:`, fc.arguments);
          toolCallsFromApi.push({
            name: fc.name,
            arguments: typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : fc.arguments
          });
        }
      }
      
      // Retry with lower temperature if empty
      if (!aiResponse) {
        console.log('⚠️ Resposta texto vazia - tentando retry com temperatura 0.5');
        const retryResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            input: fullPrompt,
            text: { format: { type: 'text' }, verbosity: 'medium' },
            reasoning: { effort: 'low', summary: 'concise' }
          }),
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          console.log('🔄 Retry texto result:', JSON.stringify(retryData, null, 2));
          aiResponse = retryData.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text?.trim() || '';
        }
      }
      
      // Fallback to chat/completions if still empty
      if (!aiResponse) {
        console.log('⚠️ Ainda vazio - tentando fallback com chat/completions (gpt-4o-mini)');
        const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationHistory.filter(Boolean).map((msg: any) => ({
                role: msg.role,
                content: msg.content
              })),
              { role: 'user', content: processedMessageContent || '[Mensagem sem texto]' }
            ],
            temperature: 0.7,
            max_tokens: 500
          }),
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('✅ Fallback result:', JSON.stringify(fallbackData, null, 2));
          aiResponse = fallbackData.choices?.[0]?.message?.content?.trim() || '';
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

    // Command handlers
    const commandHandlers: Record<string, (value: string) => Promise<void>> = {
      // Add tag to contact
      'adicionar_etiqueta': async (tagName: string) => {
        if (!contactId) return;
        console.log('🏷️ Adicionando etiqueta:', tagName);
        
        // Get current tags
        const { data: contact } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contactId)
          .single();
        
        const currentTags = contact?.tags || [];
        if (!currentTags.includes(tagName)) {
          await supabase
            .from('contacts')
            .update({ tags: [...currentTags, tagName] })
            .eq('id', contactId);
          console.log('✅ Etiqueta adicionada');
        }
      },

      // Transfer to another AI agent (sub-agent)
      'transferir_agente': async (agentIdentifier: string) => {
        console.log('🤖 Transferindo para agente:', agentIdentifier);
        
        // Find agent by name or id
        const { data: targetAgent } = await supabase
          .from('ai_agents')
          .select('id, name')
          .or(`name.ilike.%${agentIdentifier}%,id.eq.${agentIdentifier}`)
          .eq('company_id', companyId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        
        if (targetAgent) {
          await supabase
            .from('ai_conversation_states')
            .update({ 
              current_sub_agent_id: targetAgent.id,
              updated_at: new Date().toISOString()
            })
            .eq('conversation_id', conversationId);
          console.log('✅ Transferido para agente:', targetAgent.name);
        } else {
          console.log('⚠️ Agente não encontrado:', agentIdentifier);
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
          // Find target column
          const { data: targetColumn } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', (card as any).kanban_columns.board_id)
            .ilike('name', `%${stageName}%`)
            .limit(1)
            .maybeSingle();
          
          if (targetColumn) {
            await supabase
              .from('kanban_cards')
              .update({ column_id: targetColumn.id })
              .eq('id', card.id);
            console.log('✅ Etapa CRM atualizada');
          } else {
            console.log('⚠️ Coluna não encontrada:', stageName);
          }
        } else {
          console.log('⚠️ Card não encontrado para contato');
        }
      },

      // Notify team
      'notificar_equipe': async (message: string) => {
        console.log('🔔 Notificando equipe:', message);
        
        // Create mention notification for all admins/owners
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['owner', 'admin'])
          .eq('user_id', companyId); // This needs join with profiles
        
        // For now, log the notification - could be expanded to create internal chat message
        console.log('ℹ️ Notificação de equipe registrada:', message);
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
    const commandPatterns = [
      { pattern: /\/adicionar_etiqueta:([^\n\/]+)/gi, handler: 'adicionar_etiqueta' },
      { pattern: /\/transferir_agente:([^\n\/]+)/gi, handler: 'transferir_agente' },
      { pattern: /\/transferir_usuario:([^\n\/]+)/gi, handler: 'transferir_usuario' },
      { pattern: /\/atribuir_origem:([^\n\/]+)/gi, handler: 'atribuir_origem' },
      { pattern: /\/mudar_etapa_crm:([^\n\/]+)/gi, handler: 'mudar_etapa_crm' },
      { pattern: /\/notificar_equipe:([^\n]+)/gi, handler: 'notificar_equipe' },
      { pattern: /\/atribuir_departamento:([^\n\/]+)/gi, handler: 'atribuir_departamento' },
      { pattern: /\/desativar_agente/gi, handler: 'desativar_agente' },
    ];

    let slashCommandsFound = 0;
    for (const { pattern, handler } of commandPatterns) {
      const matches = [...aiResponse.matchAll(pattern)];
      for (const match of matches) {
        slashCommandsFound++;
        const value = (match[1] || '').trim();
        
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
        mediasToSend.push({
          type: media.media_type,
          key: media.media_key,
          url: media.media_url || undefined,
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
      
      const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: extractionPrompt }
          ],
          temperature: 0.1, // Low temperature for consistent extraction
          max_tokens: 1000
        }),
      });
      
      if (extractionResponse.ok) {
        const extractionData = await extractionResponse.json();
        const extractedText = extractionData.choices?.[0]?.message?.content?.trim() || '';
        
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
        contextUpdated: true
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
