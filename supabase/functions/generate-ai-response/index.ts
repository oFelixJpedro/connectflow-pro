import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
13. SE houver imagens enviadas pelo cliente, ANALISE o conteúdo visual e responda considerando o que está na imagem

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

E NÃO:
"Entendi. Vou verificar isso para você agora. Aguarde um momento."

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, contactName, agentName, department, tags } = await req.json() as RequestBody;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma mensagem fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to last 100 messages
    const recentMessages = messages.slice(-100);
    
    // Collect images for multimodal analysis
    const imageUrls: string[] = [];
    
    // Process messages and collect media
    const processedMessages: string[] = [];
    
    for (const msg of recentMessages) {
      const prefix = msg.direction === 'inbound' ? '[CLIENTE]' : '[ATENDENTE]';
      let content = msg.content;
      const metadata = msg.metadata;
      
      if (msg.messageType === 'audio') {
        // Handle audio - use transcription if available, otherwise transcribe
        if (metadata?.transcription) {
          content = `[Áudio transcrito]: ${metadata.transcription}`;
        } else if (msg.mediaUrl) {
          const transcription = await transcribeAudio(msg.mediaUrl, openAIApiKey);
          content = transcription 
            ? `[Áudio transcrito]: ${transcription}`
            : '[Áudio sem transcrição disponível]';
        } else {
          content = '[Mensagem de áudio]';
        }
      } else if (msg.messageType === 'image') {
        // Collect image URL for multimodal analysis
        if (msg.mediaUrl) {
          imageUrls.push(msg.mediaUrl);
          content = msg.content 
            ? `[Imagem com legenda: ${msg.content}] (imagem será analisada)`
            : '[Cliente enviou uma imagem] (imagem será analisada)';
        } else {
          content = msg.content 
            ? `[Imagem com legenda]: ${msg.content}`
            : '[Cliente enviou uma imagem]';
        }
      } else if (msg.messageType === 'video') {
        content = msg.content 
          ? `[Vídeo com legenda]: ${msg.content}`
          : '[Cliente enviou um vídeo]';
      } else if (msg.messageType === 'document') {
        const fileName = metadata?.fileName || metadata?.file_name || 'documento';
        content = msg.content 
          ? `[Documento "${fileName}"]: ${msg.content}`
          : `[Cliente enviou documento: ${fileName}]`;
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

    console.log('🤖 Gerando resposta com IA para', contactName);
    console.log('📊 Total de mensagens:', recentMessages.length);
    console.log('🖼️ Imagens para analisar:', imageUrls.length);
    console.log('👤 Atendente:', agentName || 'N/A');

    let generatedResponse: string;

    if (imageUrls.length > 0) {
      // Use multimodal endpoint with gpt-5-nano for image analysis
      console.log('🖼️ Usando endpoint multimodal /v1/responses com gpt-5-nano');
      
      const inputContent: any[] = [
        { 
          type: 'input_text', 
          text: `${enrichedSystemPrompt}\n\nAnalise esta conversa e gere a próxima resposta imitando o estilo do atendente. Considere o conteúdo das imagens enviadas na sua análise:\n\n${formattedMessages}` 
        }
      ];
      
      // Add all images (limit to last 5 to avoid token limits)
      const imagesToAnalyze = imageUrls.slice(-5);
      for (const imageUrl of imagesToAnalyze) {
        inputContent.push({
          type: 'input_image',
          image_url: imageUrl
        });
      }
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: [{
            role: 'user',
            content: inputContent
          }]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI /v1/responses API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Erro ao gerar resposta com análise de imagem' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      generatedResponse = data.output?.[0]?.content?.[0]?.text?.trim() || '';
      
    } else {
      // No images - use standard chat/completions (faster)
      console.log('📝 Usando endpoint padrão /v1/chat/completions com gpt-5-nano');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          messages: [
            { role: 'system', content: enrichedSystemPrompt },
            { role: 'user', content: `Analise esta conversa e gere a próxima resposta imitando o estilo do atendente:\n\n${formattedMessages}` }
          ],
          max_tokens: 800,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Erro ao gerar resposta' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      generatedResponse = data.choices?.[0]?.message?.content?.trim() || '';
    }

    if (!generatedResponse) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma resposta gerada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Resposta gerada com sucesso');
    console.log('📝 Resposta:', generatedResponse.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ response: generatedResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-ai-response function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
