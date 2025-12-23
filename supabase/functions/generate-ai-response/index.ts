import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  analyzeMedia,
  transcribeAudioWithFileAPI,
  analyzeImageWithFileAPI,
  analyzeVideoWithFileAPI,
  analyzeDocumentWithFileAPI
} from '../_shared/gemini-file-api.ts';
import { logAIUsage, extractGeminiUsage } from '../_shared/usage-tracker.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SYSTEM_PROMPT = `Você é um assistente especializado em analisar conversas e gerar respostas que IMITAM PERFEITAMENTE o estilo de comunicação do atendente.

## SUA MISSÃO
Analisar a conversa COMPLETA e gerar uma resposta que:
1. Pareça ter sido escrita pelo próprio atendente (não por uma IA)
2. Use exatamente o mesmo tom, vocabulário e estilo observado
3. Seja contextualmente perfeita para a situação
4. Ajude o atendente quando ele não souber o que responder

## ANÁLISE OBRIGATÓRIA (faça antes de responder)

### Passo 1: Identificar o padrão do ATENDENTE
Analise TODAS as mensagens marcadas como [ATENDENTE] e identifique:
- Nível de formalidade (formal/semiformal/informal/muito informal)
- Uso de emojis (usa muito/pouco/nunca? quais tipos?)
- Cumprimentos típicos (como ele saúda? "Oi", "Olá", "E aí"?, "Bom dia"?)
- Despedidas típicas (como ele finaliza?)
- Comprimento das respostas (curtas e diretas ou elaboradas?)
- Expressões recorrentes (gírias, bordões, frases características)
- Pontuação (usa muitas exclamações? reticências? ponto final?)
- Capitalização (tudo minúsculo? normal? CAPS para ênfase?)
- Uso de abreviações (vc, pq, tb, etc. ou por extenso?)

### Passo 2: Entender o CONTEXTO da conversa
- Qual é o assunto principal sendo discutido?
- Qual é a última pergunta/solicitação do cliente?
- Há algum problema a ser resolvido?
- Qual é o estado emocional do cliente? (satisfeito, irritado, confuso, ansioso?)
- O que o cliente espera como resposta?
- Há informações anteriores na conversa que podem ajudar?

### Passo 3: Gerar resposta IMITANDO o atendente
Use EXATAMENTE o mesmo padrão identificado no Passo 1.

## REGRAS CRÍTICAS

1. IMITE o atendente - se ele usa "vc", use "vc"; se ele usa "você", use "você"
2. COPIE o nível de emoji - se ele usa 😊 frequentemente, use também; se não usa, não use
3. MANTENHA o comprimento típico - se ele é conciso, seja conciso; se é detalhado, seja detalhado
4. PRESERVE o vocabulário - use as mesmas palavras e expressões dele
5. RESPONDA apenas ao que foi perguntado - seja relevante e direto
6. NÃO invente informações que não existem na conversa
7. NÃO use formatação markdown (sem asteriscos, bullets, hashtags, etc.)
8. NÃO inclua saudações se a conversa já está em andamento (meio da conversa)
9. SE não houver mensagens suficientes do atendente, use tom profissional neutro mas amigável
10. SE o cliente está frustrado ou irritado, seja empático e compreensivo
11. Use o nome do cliente quando apropriado para personalização
12. BASEIE sua resposta 100% no contexto da conversa
13. SE houver imagens/vídeos/documentos analisados, considere o conteúdo na resposta

## FORMATO DA CONVERSA
- [CLIENTE]: mensagens enviadas pelo cliente
- [ATENDENTE]: mensagens enviadas pelo atendente (ESTUDE ESTE PADRÃO!)

## EXEMPLOS DE IMITAÇÃO

### Exemplo 1 - Atendente informal
Se o atendente escreveu:
"[ATENDENTE]: oi! td bem? em q posso te ajudar hj? 😊"
"[ATENDENTE]: achei aqui! ta previsto pra amanhã"

Sua resposta deve seguir o mesmo padrão:
"entendi! vou verificar isso pra vc agora, só um momento 😊"

### Exemplo 2 - Atendente formal
Se o atendente escreveu:
"[ATENDENTE]: Bom dia! Como posso ajudá-lo hoje?"
"[ATENDENTE]: Perfeito, vou verificar essa informação para você."

Sua resposta deve seguir o mesmo padrão:
"Compreendo sua preocupação. Vou analisar a situação e retornar com uma solução."

### Exemplo 3 - Atendente direto sem emoji
Se o atendente escreveu:
"[ATENDENTE]: oi"
"[ATENDENTE]: ok, vou ver"

Sua resposta deve ser igualmente direta:
"entendi, vou resolver"

## INFORMAÇÕES ADICIONAIS DISPONÍVEIS
- Nome do atendente: pode ser usado internamente para contexto
- Departamento: indica a área de atuação (vendas, suporte, etc.)
- Tags da conversa: indicam o assunto/categoria

Retorne APENAS a resposta final, sem análises, explicações ou comentários.`;

interface MessageInput {
  content: string | null;
  direction: 'inbound' | 'outbound';
  messageType: string;
  mediaUrl?: string;
  metadata?: {
    transcription?: string;
    fileName?: string;
    file_name?: string;
  };
}

interface RequestBody {
  messages: MessageInput[];
  contactName: string;
  agentName?: string;
  department?: string;
  tags?: string[];
  companyId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, contactName, agentName, department, tags, companyId } = await req.json() as RequestBody;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma mensagem fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('❌ GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase para cache
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Limit to last 100 messages
    const recentMessages = messages.slice(-100);
    
    // Collect media analyses
    const mediaAnalyses: string[] = [];
    let imagesAnalyzed = 0;
    let videosAnalyzed = 0;
    let documentsAnalyzed = 0;
    let audiosAnalyzed = 0;
    
    // Process messages and analyze media
    const processedMessages: string[] = [];
    
    for (const msg of recentMessages) {
      const prefix = msg.direction === 'inbound' ? '[CLIENTE]' : '[ATENDENTE]';
      let content = msg.content;
      const metadata = msg.metadata;
      
      if (msg.messageType === 'audio') {
        // Handle audio - use transcription if available, otherwise transcribe with Gemini File API
        if (metadata?.transcription) {
          content = `[Áudio transcrito]: ${metadata.transcription}`;
        } else if (msg.mediaUrl && companyId) {
          const transcription = await transcribeAudioWithFileAPI(
            msg.mediaUrl, geminiApiKey, supabase, companyId
          );
          content = transcription 
            ? `[Áudio transcrito]: ${transcription}`
            : '[Áudio sem transcrição disponível]';
          if (transcription) audiosAnalyzed++;
        } else {
          content = '[Mensagem de áudio]';
        }
      } else if (msg.messageType === 'image') {
        // Analyze image with Gemini File API + cache
        if (msg.mediaUrl && msg.direction === 'inbound' && companyId && imagesAnalyzed < 5) {
          const analysis = await analyzeImageWithFileAPI(
            msg.mediaUrl, geminiApiKey, supabase, companyId
          );
          if (analysis) {
            mediaAnalyses.push(`📸 Imagem do cliente: ${analysis}`);
            imagesAnalyzed++;
          }
          content = msg.content 
            ? `[Imagem com legenda: ${msg.content}]`
            : '[Cliente enviou uma imagem]';
        } else {
          content = msg.content 
            ? `[Imagem com legenda]: ${msg.content}`
            : '[Cliente enviou uma imagem]';
        }
      } else if (msg.messageType === 'video') {
        // Analyze video with Gemini File API + cache
        if (msg.mediaUrl && msg.direction === 'inbound' && companyId && videosAnalyzed < 3) {
          const analysis = await analyzeVideoWithFileAPI(
            msg.mediaUrl, geminiApiKey, supabase, companyId
          );
          if (analysis) {
            mediaAnalyses.push(`🎬 Vídeo do cliente: ${analysis}`);
            videosAnalyzed++;
          }
          content = msg.content 
            ? `[Vídeo com legenda: ${msg.content}]`
            : '[Cliente enviou um vídeo]';
        } else {
          content = msg.content 
            ? `[Vídeo com legenda]: ${msg.content}`
            : '[Cliente enviou um vídeo]';
        }
      } else if (msg.messageType === 'document') {
        const fileName = metadata?.fileName || metadata?.file_name || 'documento';
        // Analyze document with Gemini File API + cache
        if (msg.mediaUrl && msg.direction === 'inbound' && companyId && documentsAnalyzed < 5) {
          const analysis = await analyzeDocumentWithFileAPI(
            msg.mediaUrl, geminiApiKey, supabase, companyId, fileName
          );
          if (analysis) {
            mediaAnalyses.push(`📄 Documento "${fileName}": ${analysis}`);
            documentsAnalyzed++;
          }
          content = msg.content 
            ? `[Documento "${fileName}": ${msg.content}]`
            : `[Cliente enviou documento: ${fileName}]`;
        } else {
          content = msg.content 
            ? `[Documento "${fileName}"]: ${msg.content}`
            : `[Cliente enviou documento: ${fileName}]`;
        }
      } else if (msg.messageType === 'sticker') {
        content = '[Cliente enviou um sticker]';
      } else if (!content || content.trim() === '') {
        content = '[Mensagem sem texto]';
      }
      
      processedMessages.push(`${prefix}: ${content}`);
    }
    
    const formattedMessages = processedMessages.join('\n');

    // Build enriched system prompt
    let enrichedSystemPrompt = SYSTEM_PROMPT;
    const contextParts: string[] = [];
    
    if (contactName && contactName !== 'Cliente') {
      contextParts.push(`Nome do cliente: ${contactName}`);
    }
    if (agentName) {
      contextParts.push(`Nome do atendente: ${agentName}`);
    }
    if (department) {
      contextParts.push(`Departamento: ${department}`);
    }
    if (tags && tags.length > 0) {
      contextParts.push(`Tags da conversa: ${tags.join(', ')}`);
    }
    
    if (contextParts.length > 0) {
      enrichedSystemPrompt += `\n\n## CONTEXTO DESTA CONVERSA\n${contextParts.join('\n')}`;
    }

    // Add media analyses to context if available
    if (mediaAnalyses.length > 0) {
      enrichedSystemPrompt += `\n\n## MÍDIAS ANALISADAS\n${mediaAnalyses.join('\n')}`;
    }

    console.log('🤖 Gerando resposta com Gemini para', contactName);
    console.log('📊 Total de mensagens:', recentMessages.length);
    console.log('🖼️ Imagens analisadas:', imagesAnalyzed);
    console.log('🎬 Vídeos analisados:', videosAnalyzed);
    console.log('📄 Documentos analisados:', documentsAnalyzed);
    console.log('🎙️ Áudios transcritos:', audiosAnalyzed);
    console.log('👤 Atendente:', agentName || 'N/A');

    // Build the prompt
    const fullPrompt = `${enrichedSystemPrompt}\n\nAnalise esta conversa e gere a próxima resposta imitando o estilo do atendente:\n\n${formattedMessages}`;

    // Call Gemini API
    const startTime = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048
          }
        }),
      }
    );
    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar resposta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('📦 Gemini response received');
    
    // Log AI usage
    const usage = extractGeminiUsage(data);
    if (companyId) {
      logAIUsage(
        supabase,
        companyId,
        'generate-ai-response',
        'gemini-3-flash-preview',
        usage.inputTokens,
        usage.outputTokens,
        processingTime,
        { 
          messageCount: recentMessages.length,
          mediaAnalyzed: { images: imagesAnalyzed, videos: videosAnalyzed, documents: documentsAnalyzed, audios: audiosAnalyzed }
        }
      ).catch(err => console.error('[UsageTracker] Error:', err));
    }
    
    const generatedResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedResponse) {
      console.error('❌ No content in response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: 'Nenhuma resposta gerada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Resposta gerada com sucesso');
    console.log('📝 Resposta:', generatedResponse.substring(0, 100) + '...');
    console.log(`📊 Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`);

    return new Response(
      JSON.stringify({ response: generatedResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in generate-ai-response function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
