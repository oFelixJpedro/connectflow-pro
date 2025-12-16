import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente de atendimento ao cliente via WhatsApp.
Sua função é analisar a conversa e gerar a MELHOR resposta para o cliente.

CONTEXTO:
- Você está ajudando um atendente a responder o cliente
- Analise todo o histórico da conversa para entender o contexto

REGRAS:
1. Gere uma resposta natural, educada e profissional
2. Mantenha o tom da conversa (se informal, seja informal)
3. Seja direto e objetivo
4. Responda em português brasileiro
5. NÃO use formatação markdown (sem asteriscos, bullets, etc.)
6. Se houver uma pergunta, responda-a claramente
7. Se o cliente parecer frustrado, seja empático
8. Personalize a resposta usando o nome do cliente quando apropriado
9. NÃO inclua saudações se a conversa já estiver em andamento
10. Responda apenas o necessário, sem ser prolixo

Retorne APENAS a resposta, sem explicações adicionais.`;

interface MessageInput {
  content: string | null;
  direction: 'inbound' | 'outbound';
  messageType: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, contactName } = await req.json() as { 
      messages: MessageInput[]; 
      contactName: string;
    };

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

    // Format messages for OpenAI
    // Limit to last 50 messages to avoid excessive token usage
    const recentMessages = messages.slice(-50);
    
    const formattedMessages = recentMessages.map(msg => {
      // inbound = client message, outbound = agent message
      const role = msg.direction === 'inbound' ? 'user' : 'assistant';
      
      // For non-text messages, describe the content type
      let content = msg.content;
      if (!content || content.trim() === '') {
        switch (msg.messageType) {
          case 'image':
            content = '[Cliente enviou uma imagem]';
            break;
          case 'audio':
            content = '[Cliente enviou um áudio]';
            break;
          case 'video':
            content = '[Cliente enviou um vídeo]';
            break;
          case 'document':
            content = '[Cliente enviou um documento]';
            break;
          case 'sticker':
            content = '[Cliente enviou um sticker]';
            break;
          default:
            content = '[Mensagem sem texto]';
        }
      }
      
      return { role, content };
    });

    // Build system prompt with contact name
    const systemPrompt = contactName 
      ? `${SYSTEM_PROMPT}\n\nO nome do cliente é: ${contactName}`
      : SYSTEM_PROMPT;

    console.log('🤖 Gerando resposta com IA para', contactName);
    console.log('📊 Total de mensagens:', formattedMessages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedMessages
        ],
        max_tokens: 500,
        temperature: 0.7,
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
