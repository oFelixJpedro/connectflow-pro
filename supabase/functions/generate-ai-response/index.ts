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
}

interface RequestBody {
  messages: MessageInput[];
  contactName: string;
  agentName?: string;
  department?: string;
  tags?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Limit to last 100 messages for better context
    const recentMessages = messages.slice(-100);
    
    // Format messages with clear labels for AI analysis
    const formattedMessages = recentMessages.map(msg => {
      const prefix = msg.direction === 'inbound' ? '[CLIENTE]' : '[ATENDENTE]';
      
      // Handle different message types
      let content = msg.content;
      if (!content || content.trim() === '') {
        const mediaPrefix = msg.direction === 'inbound' ? 'Cliente' : 'Atendente';
        switch (msg.messageType) {
          case 'image':
            content = `[${mediaPrefix} enviou uma imagem]`;
            break;
          case 'audio':
            content = `[${mediaPrefix} enviou um áudio]`;
            break;
          case 'video':
            content = `[${mediaPrefix} enviou um vídeo]`;
            break;
          case 'document':
            content = `[${mediaPrefix} enviou um documento]`;
            break;
          case 'sticker':
            content = `[${mediaPrefix} enviou um sticker]`;
            break;
          default:
            content = '[Mensagem sem texto]';
        }
      }
      
      return `${prefix}: ${content}`;
    }).join('\n');

    // Build enriched system prompt with additional context
    let enrichedSystemPrompt = SYSTEM_PROMPT;
    
    // Add context information
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
    console.log('👤 Atendente:', agentName || 'N/A');
    console.log('🏢 Departamento:', department || 'N/A');
    console.log('🏷️ Tags:', tags?.join(', ') || 'N/A');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
    const generatedResponse = data.choices?.[0]?.message?.content?.trim();

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
