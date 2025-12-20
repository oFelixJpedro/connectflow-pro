import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, contactId } = await req.json();

    if (!conversationId && !contactId) {
      throw new Error('conversationId ou contactId é obrigatório');
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar todas as mensagens
    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        message_type,
        direction,
        sender_type,
        created_at,
        is_internal_note,
        is_deleted
      `)
      .eq('is_internal_note', false)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    // Se for por contactId, precisamos buscar todas as conversas do contato
    if (contactId && !conversationId) {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId);

      if (convError) throw convError;

      const conversationIds = conversations?.map(c => c.id) || [];
      if (conversationIds.length === 0) {
        return new Response(
          JSON.stringify({ summary: 'Nenhuma conversa encontrada para este contato.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      query = query.in('conversation_id', conversationIds);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) throw messagesError;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ summary: 'Nenhuma mensagem encontrada para gerar resumo.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar mensagens para o prompt
    const formattedMessages = messages.map(msg => {
      const sender = msg.direction === 'incoming' ? '👤 CLIENTE' : '💼 ATENDENTE';
      const time = new Date(msg.created_at).toLocaleString('pt-BR');
      let content = msg.content || '';
      
      if (msg.message_type === 'audio') {
        content = '[Mensagem de áudio]';
      } else if (msg.message_type === 'image') {
        content = '[Imagem enviada]';
      } else if (msg.message_type === 'video') {
        content = '[Vídeo enviado]';
      } else if (msg.message_type === 'document') {
        content = '[Documento enviado]';
      } else if (msg.message_type === 'sticker') {
        content = '[Sticker]';
      }
      
      return `[${time}] ${sender}: ${content}`;
    }).join('\n');

    const systemPrompt = `Você é um especialista em criar resumos executivos de conversas de atendimento ao cliente.

## SUA TAREFA
Analise TODA a conversa abaixo e crie um resumo COMPLETO, ESTRUTURADO e BEM FORMATADO em Markdown.

## ESTRUTURA OBRIGATÓRIA DO RESUMO

### 📋 RESUMO EXECUTIVO
(2-3 frases resumindo o motivo do contato e o resultado final)

### 👤 DADOS DO CLIENTE
- Nome mencionado (se houver)
- Informações pessoais relevantes identificadas
- Preferências ou características notadas

### 📌 ASSUNTOS DISCUTIDOS
(Lista numerada de TODOS os tópicos abordados na conversa)

### ❓ PERGUNTAS FEITAS PELO CLIENTE
(Lista de todas as perguntas/dúvidas levantadas pelo cliente)

### ✅ SOLUÇÕES/RESPOSTAS FORNECIDAS
(O que foi resolvido, respondido ou oferecido ao cliente)

### ⏳ PENDÊNCIAS/PRÓXIMOS PASSOS
(Se houver algo em aberto, compromissos assumidos, follow-ups necessários)

### 🔑 INFORMAÇÕES-CHAVE
(Dados importantes mencionados: números, datas, valores, endereços, produtos, etc.)

### 📊 STATUS FINAL
- **Satisfação:** (Satisfeito / Neutro / Insatisfeito - baseado no tom da conversa)
- **Resolução:** (Totalmente resolvido / Parcialmente resolvido / Pendente)
- **Próximo contato:** (Se mencionado)

## REGRAS
- Seja objetivo mas completo
- Não invente informações - apenas extraia o que está na conversa
- Use formatação Markdown rica (negrito, listas, etc.)
- Se uma seção não tiver informação relevante, escreva "Não identificado" ou "Não aplicável"`;

    const userPrompt = `Analise a seguinte conversa com ${messages.length} mensagens e gere o resumo completo:

---
${formattedMessages}
---

Gere o resumo estruturado conforme as instruções.`;

    console.log(`[summarize-chat] Processando ${messages.length} mensagens...`);

    // Chamar Gemini 3.0 Flash Preview
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[summarize-chat] Gemini API error:', errorText);
      throw new Error(`Erro na API Gemini: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar o resumo.';

    console.log('[summarize-chat] Resumo gerado com sucesso');

    return new Response(
      JSON.stringify({ summary, messageCount: messages.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[summarize-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
