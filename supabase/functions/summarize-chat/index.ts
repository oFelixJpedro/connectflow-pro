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

// Helper para converter ArrayBuffer para Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Transcrever áudio com Gemini
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('[summarize-chat] Transcribing audio:', audioUrl);
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('[summarize-chat] Failed to fetch audio');
      return null;
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Transcreva este áudio para texto. Retorne APENAS a transcrição, sem explicações.' },
              { inline_data: { mime_type: contentType, data: base64Audio } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        }),
      }
    );

    if (!response.ok) {
      console.error('[summarize-chat] Gemini transcription error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('[summarize-chat] Transcription error:', error);
    return null;
  }
}

// Buscar imagem como Base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return { data: base64, mimeType };
  } catch (error) {
    console.error('[summarize-chat] Image fetch error:', error);
    return null;
  }
}

// Buscar vídeo como Base64 (limite 20MB)
async function fetchVideoAsBase64(videoUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) {
      console.log('[summarize-chat] Video too large, skipping');
      return null;
    }

    const base64 = arrayBufferToBase64(buffer);
    const mimeType = response.headers.get('content-type') || 'video/mp4';

    return { data: base64, mimeType };
  } catch (error) {
    console.error('[summarize-chat] Video fetch error:', error);
    return null;
  }
}

// MIME types suportados para documentos
const SUPPORTED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

// Buscar documento como Base64
async function fetchDocumentAsBase64(docUrl: string, fileName?: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(docUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) {
      console.log('[summarize-chat] Document too large, skipping');
      return null;
    }

    let mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Tentar detectar pelo nome do arquivo
    if (fileName) {
      const ext = fileName.toLowerCase().split('.').pop();
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
      };
      if (ext && mimeMap[ext]) {
        mimeType = mimeMap[ext];
      }
    }

    if (!SUPPORTED_DOCUMENT_MIMES.includes(mimeType)) {
      console.log('[summarize-chat] Unsupported document type:', mimeType);
      return null;
    }

    const base64 = arrayBufferToBase64(buffer);
    return { data: base64, mimeType };
  } catch (error) {
    console.error('[summarize-chat] Document fetch error:', error);
    return null;
  }
}

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

    // Arrays para coleta de mídia
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    const documentData: { url: string; fileName?: string }[] = [];
    const processedMessages: string[] = [];

    // Processar mensagens e coletar mídia
    for (const msg of messages) {
      const sender = msg.direction === 'incoming' ? '👤 CLIENTE' : '💼 ATENDENTE';
      const time = new Date(msg.created_at).toLocaleString('pt-BR');
      let content = msg.content || '';
      
      if (msg.message_type === 'audio') {
        // Transcrever áudio
        if (msg.media_url) {
          const transcription = await transcribeAudio(msg.media_url, GEMINI_API_KEY);
          content = transcription 
            ? `[Áudio transcrito]: "${transcription}"`
            : '[Áudio - transcrição não disponível]';
        } else if (msg.metadata?.transcription) {
          content = `[Áudio transcrito]: "${msg.metadata.transcription}"`;
        } else {
          content = '[Mensagem de áudio]';
        }
      } else if (msg.message_type === 'image') {
        if (msg.media_url) {
          imageUrls.push(msg.media_url);
          content = msg.content 
            ? `[Imagem com legenda: "${msg.content}"] (analisada abaixo)`
            : '[Imagem enviada] (analisada abaixo)';
        }
      } else if (msg.message_type === 'video') {
        if (msg.media_url) {
          videoUrls.push(msg.media_url);
          content = msg.content 
            ? `[Vídeo com legenda: "${msg.content}"] (analisado abaixo)`
            : '[Vídeo enviado] (analisado abaixo)';
        }
      } else if (msg.message_type === 'document') {
        if (msg.media_url) {
          const fileName = msg.metadata?.fileName || msg.metadata?.file_name || 'documento';
          documentData.push({ url: msg.media_url, fileName });
          content = `[Documento: ${fileName}] (analisado abaixo)`;
        }
      } else if (msg.message_type === 'sticker') {
        content = '[Sticker/Figurinha]';
      }
      
      processedMessages.push(`[${time}] ${sender}: ${content}`);
    }

    const formattedMessages = processedMessages.join('\n');

    const systemPrompt = `Você é um especialista em criar resumos executivos de conversas de atendimento ao cliente.

## SUA TAREFA
Analise TODA a conversa abaixo e crie um resumo COMPLETO, ESTRUTURADO e BEM FORMATADO em Markdown.

## IMPORTANTE - ANÁLISE DE MÍDIA
- SE houver imagens anexadas nesta requisição, DESCREVA detalhadamente o conteúdo visual e inclua na análise do contexto da conversa
- SE houver áudios transcritos no texto, considere o conteúdo falado como parte importante da conversa
- SE houver vídeos anexados, DESCREVA o que está acontecendo no vídeo e como se relaciona com a conversa
- SE houver documentos anexados, ANALISE o conteúdo e extraia todas as informações relevantes mencionadas

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
- Não invente informações - apenas extraia o que está na conversa ou na mídia
- Use formatação Markdown rica (negrito, listas, etc.)
- Se uma seção não tiver informação relevante, escreva "Não identificado" ou "Não aplicável"`;

    const userPrompt = `Analise a seguinte conversa com ${messages.length} mensagens e gere o resumo completo:

---
${formattedMessages}
---

${imageUrls.length > 0 ? `\n⚠️ ATENÇÃO: ${imageUrls.length} imagem(ns) anexada(s) para análise visual.` : ''}
${videoUrls.length > 0 ? `\n⚠️ ATENÇÃO: ${videoUrls.length} vídeo(s) anexado(s) para análise.` : ''}
${documentData.length > 0 ? `\n⚠️ ATENÇÃO: ${documentData.length} documento(s) anexado(s) para análise.` : ''}

Gere o resumo estruturado conforme as instruções.`;

    // Construir parts para Gemini (multimodal)
    const parts: any[] = [{ text: `${systemPrompt}\n\n${userPrompt}` }];

    // Adicionar imagens (últimas 10)
    if (imageUrls.length > 0) {
      const imagesToAnalyze = imageUrls.slice(-10);
      console.log(`[summarize-chat] Processando ${imagesToAnalyze.length} imagens...`);
      
      for (const imageUrl of imagesToAnalyze) {
        const imageData = await fetchImageAsBase64(imageUrl);
        if (imageData) {
          parts.push({
            inline_data: {
              mime_type: imageData.mimeType,
              data: imageData.data
            }
          });
        }
      }
    }

    // Adicionar vídeos (últimos 5)
    if (videoUrls.length > 0) {
      const videosToAnalyze = videoUrls.slice(-5);
      console.log(`[summarize-chat] Processando ${videosToAnalyze.length} vídeos...`);
      
      for (const videoUrl of videosToAnalyze) {
        const videoData = await fetchVideoAsBase64(videoUrl);
        if (videoData) {
          parts.push({
            inline_data: {
              mime_type: videoData.mimeType,
              data: videoData.data
            }
          });
        }
      }
    }

    // Adicionar documentos (últimos 5)
    if (documentData.length > 0) {
      const docsToAnalyze = documentData.slice(-5);
      console.log(`[summarize-chat] Processando ${docsToAnalyze.length} documentos...`);
      
      for (const doc of docsToAnalyze) {
        const docData = await fetchDocumentAsBase64(doc.url, doc.fileName);
        if (docData) {
          parts.push({
            inline_data: {
              mime_type: docData.mimeType,
              data: docData.data
            }
          });
        }
      }
    }

    // Chamar Gemini 3.0 Flash Preview
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
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
      images: Math.min(imageUrls.length, 10),
      videos: Math.min(videoUrls.length, 5),
      documents: Math.min(documentData.length, 5)
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
      // Still return the summary even if save failed
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
