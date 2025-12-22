import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  analyzeImageWithFileAPI,
  analyzeVideoWithFileAPI,
  analyzeDocumentWithFileAPI,
  transcribeAudioWithFileAPI
} from '../_shared/gemini-file-api.ts';

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

    // Buscar company_id da conversa
    let companyId: string | null = null;
    
    if (conversationId) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('company_id')
        .eq('id', conversationId)
        .single();
      companyId = convData?.company_id;
    } else if (contactId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('company_id')
        .eq('id', contactId)
        .single();
      companyId = contactData?.company_id;
    }

    // Buscar todas as mensagens com campos de mídia
    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        message_type,
        media_url,
        metadata,
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

    // Se for por contactId, buscar todas as conversas do contato
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

    console.log(`[summarize-chat] Processando ${messages.length} mensagens...`);

    // Arrays para coleta de análises de mídia
    const mediaAnalyses: string[] = [];
    const processedMessages: string[] = [];
    let imagesAnalyzed = 0;
    let videosAnalyzed = 0;
    let documentsAnalyzed = 0;
    let audiosAnalyzed = 0;

    // Processar mensagens e analisar mídia usando Gemini File API
    for (const msg of messages) {
      const sender = msg.direction === 'incoming' ? '👤 CLIENTE' : '💼 ATENDENTE';
      const time = new Date(msg.created_at).toLocaleString('pt-BR');
      let content = msg.content || '';
      
      if (msg.message_type === 'audio') {
        // Transcrever áudio com Gemini File API + cache
        if (msg.media_url && companyId) {
          const transcription = await transcribeAudioWithFileAPI(
            msg.media_url, GEMINI_API_KEY, supabase, companyId
          );
          content = transcription 
            ? `[Áudio transcrito]: "${transcription}"`
            : '[Áudio - transcrição não disponível]';
          if (transcription) audiosAnalyzed++;
        } else if (msg.metadata?.transcription) {
          content = `[Áudio transcrito]: "${msg.metadata.transcription}"`;
        } else {
          content = '[Mensagem de áudio]';
        }
      } else if (msg.message_type === 'image') {
        if (msg.media_url && companyId && imagesAnalyzed < 10) {
          const analysis = await analyzeImageWithFileAPI(
            msg.media_url, GEMINI_API_KEY, supabase, companyId
          );
          if (analysis) {
            mediaAnalyses.push(`📸 IMAGEM (${time}): ${analysis}`);
            imagesAnalyzed++;
          }
          content = msg.content 
            ? `[Imagem com legenda: "${msg.content}"]`
            : '[Imagem enviada]';
        } else {
          content = msg.content || '[Imagem enviada]';
        }
      } else if (msg.message_type === 'video') {
        if (msg.media_url && companyId && videosAnalyzed < 5) {
          const analysis = await analyzeVideoWithFileAPI(
            msg.media_url, GEMINI_API_KEY, supabase, companyId
          );
          if (analysis) {
            mediaAnalyses.push(`🎬 VÍDEO (${time}): ${analysis}`);
            videosAnalyzed++;
          }
          content = msg.content 
            ? `[Vídeo com legenda: "${msg.content}"]`
            : '[Vídeo enviado]';
        } else {
          content = msg.content || '[Vídeo enviado]';
        }
      } else if (msg.message_type === 'document') {
        if (msg.media_url && companyId && documentsAnalyzed < 5) {
          const fileName = msg.metadata?.fileName || msg.metadata?.file_name || 'documento';
          const analysis = await analyzeDocumentWithFileAPI(
            msg.media_url, GEMINI_API_KEY, supabase, companyId, fileName
          );
          if (analysis) {
            mediaAnalyses.push(`📄 DOCUMENTO "${fileName}" (${time}): ${analysis}`);
            documentsAnalyzed++;
          }
          content = `[Documento: ${fileName}]`;
        } else {
          const fileName = msg.metadata?.fileName || msg.metadata?.file_name || 'documento';
          content = `[Documento: ${fileName}]`;
        }
      } else if (msg.message_type === 'sticker') {
        content = '[Sticker/Figurinha]';
      }
      
      processedMessages.push(`[${time}] ${sender}: ${content}`);
    }

    const formattedMessages = processedMessages.join('\n');
    const mediaSection = mediaAnalyses.length > 0 
      ? `\n\n## ANÁLISE DE MÍDIAS ENVIADAS\n\n${mediaAnalyses.join('\n\n')}`
      : '';

    const systemPrompt = `Você é um especialista em criar resumos executivos de conversas de atendimento ao cliente.

## SUA TAREFA
Analise TODA a conversa abaixo e crie um resumo COMPLETO, ESTRUTURADO e BEM FORMATADO em Markdown.

## IMPORTANTE - ANÁLISE DE MÍDIA JÁ REALIZADA
${mediaAnalyses.length > 0 
  ? `As mídias enviadas já foram analisadas e as descrições estão incluídas abaixo. Use essas análises no seu resumo.`
  : `Não há mídias para analisar nesta conversa.`
}

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

### 📎 MÍDIA ANALISADA
(Descrição das imagens, vídeos e documentos enviados - se houver)

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
${mediaSection}

Gere o resumo estruturado conforme as instruções.`;

    console.log(`[summarize-chat] Mídias analisadas - Imagens: ${imagesAnalyzed}, Vídeos: ${videosAnalyzed}, Documentos: ${documentsAnalyzed}, Áudios: ${audiosAnalyzed}`);

    // Chamar Gemini 2.5 Flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
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
    const generatedSummary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar o resumo.';

    console.log('[summarize-chat] Resumo gerado com sucesso');

    const mediaAnalyzed = {
      images: imagesAnalyzed,
      videos: videosAnalyzed,
      documents: documentsAnalyzed,
      audios: audiosAnalyzed
    };

    // Get current user for generated_by field
    const { data: { user } } = await supabase.auth.getUser();
    
    // Save or update summary in database
    const { data: savedSummary, error: upsertError } = await supabase
      .from('chat_summaries')
      .upsert({
        conversation_id: conversationId,
        contact_id: contactId || null,
        summary: generatedSummary,
        message_count: messages.length,
        media_analyzed: mediaAnalyzed,
        generated_by: user?.id || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('[summarize-chat] Error saving summary:', upsertError);
    } else {
      console.log('[summarize-chat] Summary saved successfully:', savedSummary?.id);
    }

    return new Response(
      JSON.stringify({ 
        summary: generatedSummary, 
        messageCount: messages.length,
        mediaAnalyzed,
        savedAt: savedSummary?.updated_at || new Date().toISOString()
      }),
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
