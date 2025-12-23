import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logAIUsage, extractGeminiUsage } from '../_shared/usage-tracker.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaluationResult {
  overall_score: number;
  communication_score: number;
  objectivity_score: number;
  humanization_score: number;
  objection_handling_score: number;
  closing_score: number;
  response_time_score: number;
  lead_qualification: 'hot' | 'warm' | 'cold' | 'disqualified';
  lead_interest_level: number;
  strengths: string[];
  improvements: string[];
  ai_summary: string;
  lead_pain_points: string[];
}

// ==================== MEDIA CACHE FUNCTIONS ====================

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getCachedAnalysis(
  supabase: any,
  url: string,
  companyId: string
): Promise<any | null> {
  try {
    const urlHash = await sha256(url);
    const { data, error } = await supabase
      .from('media_analysis_cache')
      .select('analysis_result')
      .eq('url_hash', urlHash)
      .eq('company_id', companyId)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    
    supabase.rpc('increment_cache_hit', { p_url_hash: urlHash, p_company_id: companyId }).catch(() => {});
    console.log(`[Cache] HIT for ${url.substring(0, 50)}...`);
    return data.analysis_result;
  } catch {
    return null;
  }
}

async function saveCacheAnalysis(
  supabase: any,
  url: string,
  companyId: string,
  mediaType: string,
  result: any
): Promise<void> {
  try {
    const urlHash = await sha256(url);
    await supabase
      .from('media_analysis_cache')
      .upsert({
        url_hash: urlHash,
        url,
        company_id: companyId,
        media_type: mediaType,
        analysis_result: result,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'url_hash,company_id' });
    console.log(`[Cache] SAVED for ${url.substring(0, 50)}...`);
  } catch (error) {
    console.error('[Cache] Error saving:', error);
  }
}

// ==================== AUDIO TRANSCRIPTION (Base64 required) ====================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function transcribeAudio(
  audioUrl: string, 
  apiKey: string,
  supabase: any,
  companyId: string
): Promise<string | null> {
  try {
    // Check cache first
    const cached = await getCachedAnalysis(supabase, audioUrl, companyId);
    if (cached?.transcription) {
      console.log(`[TranscribeAudio] Cache HIT: ${cached.transcription.substring(0, 50)}...`);
      return cached.transcription;
    }
    
    console.log('[evaluate-conversation] Transcribing audio:', audioUrl.substring(0, 50));
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('[evaluate-conversation] Failed to fetch audio:', audioResponse.status);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    // Normalize MIME type
    let mimeType = 'audio/ogg';
    if (contentType.includes('mp3') || contentType.includes('mpeg')) mimeType = 'audio/mp3';
    else if (contentType.includes('wav')) mimeType = 'audio/wav';
    else if (contentType.includes('webm')) mimeType = 'audio/webm';
    else if (contentType.includes('m4a') || contentType.includes('mp4')) mimeType = 'audio/mp4';
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Audio } },
              { text: "Transcreva este áudio em português. Retorne APENAS a transcrição, sem comentários adicionais." }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    );
    
    if (!geminiResponse.ok) {
      console.error('[evaluate-conversation] Gemini transcription failed:', await geminiResponse.text());
      return null;
    }
    
    const data = await geminiResponse.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (transcription) {
      console.log('[evaluate-conversation] Audio transcribed successfully');
      // Save to cache
      saveCacheAnalysis(supabase, audioUrl, companyId, 'audio', { transcription })
        .catch(err => console.error('[Cache] Save error:', err));
      return transcription;
    }
    
    return null;
  } catch (error) {
    console.error('[evaluate-conversation] Error transcribing audio:', error);
    return null;
  }
}

// ==================== JSON REPAIR UTILITIES ====================

function repairTruncatedJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  
  if (!cleaned.endsWith('}')) {
    console.warn('[JSONRepair] JSON appears truncated, attempting repair');
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/]/g) || []).length;
    
    cleaned += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
    cleaned += '}'.repeat(Math.max(0, openBraces - closeBraces));
  }
  
  return cleaned;
}

function extractJson(text: string): string | null {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) t = fenced[1].trim();
  
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  
  return t.slice(start, end + 1).trim();
}

// ==================== EVALUATION PROMPT ====================

const EVALUATION_PROMPT = `Você é um especialista em análise de qualidade de atendimento comercial via WhatsApp.

## IMPORTANTE - ANÁLISE DE MÍDIA VIA URL
- SE houver URLs de imagens listadas, analise visualmente o conteúdo usando URL Context Tool
- SE houver URLs de vídeos listadas, analise o conteúdo visual usando URL Context Tool
- SE houver URLs de documentos listadas, analise o conteúdo do documento usando URL Context Tool
- Considere como o atendente utilizou recursos visuais (catálogos, fotos, prints)

Analise a conversa e avalie o desempenho do atendente nos seguintes critérios (notas de 0 a 10):

1. **Comunicação** (communication_score): Clareza, gramática, ortografia
2. **Objetividade** (objectivity_score): Foco nos objetivos comerciais
3. **Humanização** (humanization_score): Tratamento personalizado, empático
4. **Tratamento de Objeções** (objection_handling_score): Capacidade de contornar objeções
5. **Fechamento** (closing_score): Uso de técnicas de fechamento de venda
6. **Tempo de Resposta** (response_time_score): Baseado nos timestamps, agilidade

Também avalie:
- **Qualificação do Lead**: hot (muito interessado), warm (interessado), cold (pouco interesse), disqualified (não é público alvo)
- **Nível de Interesse** (1-5): 1=nenhum, 5=máximo
- **Pontos Fortes**: 2-4 aspectos positivos
- **Melhorias**: 2-4 sugestões de melhoria
- **Resumo**: Breve resumo da conversa (máx 100 palavras)
- **Pontos de Dor**: Problemas/necessidades do cliente

IMPORTANTE:
- Seja justo e preciso nas notas
- A nota geral (overall_score) deve ser a média ponderada dos 6 critérios
- Se não houver mensagens suficientes, use 5.0 como nota neutra

Responda APENAS em JSON válido no formato:
{
  "overall_score": 7.5,
  "communication_score": 8.0,
  "objectivity_score": 7.0,
  "humanization_score": 8.5,
  "objection_handling_score": 6.5,
  "closing_score": 7.0,
  "response_time_score": 8.0,
  "lead_qualification": "warm",
  "lead_interest_level": 3,
  "strengths": ["Comunicação clara", "Atendimento cordial"],
  "improvements": ["Usar mais técnicas de fechamento", "Fazer follow-up"],
  "ai_summary": "Atendimento cordial com cliente interessado em produto X...",
  "lead_pain_points": ["Preço alto", "Prazo de entrega"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { conversation_id, company_id, evaluate_all } = await req.json();

    console.log(`[evaluate-conversation] Starting evaluation`, { conversation_id, company_id, evaluate_all });

    let conversationsToEvaluate: string[] = [];

    if (evaluate_all && company_id) {
      const { data: allClosed, error: closedError } = await supabase
        .from('conversations')
        .select('id')
        .eq('company_id', company_id)
        .in('status', ['closed', 'resolved']);

      if (closedError) {
        console.error('[evaluate-conversation] Error fetching closed conversations:', closedError);
        throw new Error('Erro ao buscar conversas fechadas');
      }

      const { data: evaluated } = await supabase
        .from('conversation_evaluations')
        .select('conversation_id')
        .eq('company_id', company_id);

      const evaluatedIds = new Set(evaluated?.map(e => e.conversation_id) || []);
      conversationsToEvaluate = (allClosed || [])
        .filter(c => !evaluatedIds.has(c.id))
        .map(c => c.id);

      console.log(`[evaluate-conversation] Found ${conversationsToEvaluate.length} conversations to evaluate`);
    } else if (conversation_id) {
      const { data: existing } = await supabase
        .from('conversation_evaluations')
        .select('id')
        .eq('conversation_id', conversation_id)
        .maybeSingle();
        
      if (existing) {
        console.log(`[evaluate-conversation] Conversa ${conversation_id} já avaliada, pulando`);
        return new Response(
          JSON.stringify({ success: true, message: 'Conversa já avaliada anteriormente', already_evaluated: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      conversationsToEvaluate = [conversation_id];
    } else {
      throw new Error('conversation_id ou evaluate_all + company_id são obrigatórios');
    }

    if (conversationsToEvaluate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma conversa para avaliar',
        evaluated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const toEvaluate = conversationsToEvaluate.slice(0, 10);
    const results: { conversation_id: string; success: boolean; error?: string }[] = [];

    for (const convId of toEvaluate) {
      try {
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('id, company_id, contact:contacts(name, phone_number)')
          .eq('id', convId)
          .single();

        if (convError || !conversation) {
          results.push({ conversation_id: convId, success: false, error: 'Conversa não encontrada' });
          continue;
        }

        const currentCompanyId = conversation.company_id;
        
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('content, direction, sender_type, created_at, message_type, media_url, metadata')
          .eq('conversation_id', convId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        if (msgError || !messages || messages.length < 3) {
          results.push({ conversation_id: convId, success: false, error: 'Mensagens insuficientes' });
          continue;
        }

        // Collect media URLs for URL Context Tool (no Base64 download)
        const contact = conversation.contact as any;
        const contactName = contact?.name || 'Cliente';
        
        const imageUrls: string[] = [];
        const videoUrls: string[] = [];
        const documentUrls: { url: string; fileName: string }[] = [];
        const processedMessages: string[] = [];
        const urlsToCache: { url: string; type: string }[] = [];
        const cachedAnalyses: { url: string; result: any }[] = [];

        for (const m of messages) {
          if (!m.content && !m.media_url) continue;
          
          const sender = m.direction === 'incoming' ? contactName : 'Atendente';
          const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          let content = m.content || '';
          
          switch (m.message_type) {
            case 'audio':
              if (m.media_url) {
                const transcription = await transcribeAudio(m.media_url, geminiApiKey, supabase, currentCompanyId);
                content = transcription 
                  ? `[Áudio transcrito]: "${transcription}"`
                  : '[Áudio - transcrição não disponível]';
              }
              break;
              
            case 'image':
              if (m.media_url) {
                // Check cache first
                const cached = await getCachedAnalysis(supabase, m.media_url, currentCompanyId);
                if (cached) {
                  cachedAnalyses.push({ url: m.media_url, result: cached });
                } else {
                  imageUrls.push(m.media_url);
                  urlsToCache.push({ url: m.media_url, type: 'image' });
                }
                content = m.content 
                  ? `[Imagem com legenda: "${m.content}"]`
                  : '[Imagem enviada]';
              }
              break;
              
            case 'video':
              if (m.media_url) {
                const cached = await getCachedAnalysis(supabase, m.media_url, currentCompanyId);
                if (cached) {
                  cachedAnalyses.push({ url: m.media_url, result: cached });
                } else {
                  videoUrls.push(m.media_url);
                  urlsToCache.push({ url: m.media_url, type: 'video' });
                }
                content = m.content 
                  ? `[Vídeo com legenda: "${m.content}"]`
                  : '[Vídeo enviado]';
              }
              break;
              
            case 'document':
              if (m.media_url) {
                const metadata = m.metadata as any;
                const fileName = metadata?.fileName || metadata?.filename || 'documento';
                const cached = await getCachedAnalysis(supabase, m.media_url, currentCompanyId);
                if (cached) {
                  cachedAnalyses.push({ url: m.media_url, result: cached });
                } else {
                  documentUrls.push({ url: m.media_url, fileName });
                  urlsToCache.push({ url: m.media_url, type: 'document' });
                }
                content = `[Documento: ${fileName}]`;
              }
              break;
              
            case 'sticker':
              content = '[Sticker/Figurinha]';
              break;
          }
          
          if (content) {
            processedMessages.push(`[${time}] ${sender}: ${content}`);
          }
        }

        const formattedMessages = processedMessages.join('\n');

        if (formattedMessages.length < 50) {
          results.push({ conversation_id: convId, success: false, error: 'Conteúdo de texto insuficiente' });
          continue;
        }

        // Build URL sections for URL Context Tool (NO Base64!)
        let mediaUrlSection = '';
        const MAX_IMAGES = 10;
        const MAX_VIDEOS = 3;
        const MAX_DOCS = 3;
        
        if (imageUrls.length > 0) {
          mediaUrlSection += '\n\n## IMAGENS PARA ANALISAR (use URL Context para acessar):\n';
          imageUrls.slice(0, MAX_IMAGES).forEach((url, i) => {
            mediaUrlSection += `${i + 1}. ${url}\n`;
          });
        }
        
        if (videoUrls.length > 0) {
          mediaUrlSection += '\n## VÍDEOS PARA ANALISAR (use URL Context para acessar):\n';
          videoUrls.slice(0, MAX_VIDEOS).forEach((url, i) => {
            mediaUrlSection += `${i + 1}. ${url}\n`;
          });
        }
        
        if (documentUrls.length > 0) {
          mediaUrlSection += '\n## DOCUMENTOS PARA ANALISAR (use URL Context para acessar):\n';
          documentUrls.slice(0, MAX_DOCS).forEach((doc, i) => {
            mediaUrlSection += `${i + 1}. [${doc.fileName}]: ${doc.url}\n`;
          });
        }
        
        // Add cached analyses summary if any
        if (cachedAnalyses.length > 0) {
          mediaUrlSection += `\n## MÍDIAS JÁ ANALISADAS (${cachedAnalyses.length} do cache):\n`;
          cachedAnalyses.forEach((c, i) => {
            mediaUrlSection += `${i + 1}. Análise anterior disponível: ${JSON.stringify(c.result).substring(0, 100)}...\n`;
          });
        }

        const textPrompt = `${EVALUATION_PROMPT}\n\n--- CONVERSA ---\n${formattedMessages}\n--- FIM DA CONVERSA ---${mediaUrlSection}`;
        
        const parts: any[] = [{ text: textPrompt }];
        const hasUrlsToAnalyze = imageUrls.length > 0 || videoUrls.length > 0 || documentUrls.length > 0;

        console.log(`[evaluate-conversation] Calling Gemini for ${convId} with URL Context Tool: ${imageUrls.length} images, ${videoUrls.length} videos, ${documentUrls.length} docs`);

        // Build request with URL Context Tool and responseMimeType
        const requestBody: any = {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        };

        // Add URL Context Tool if we have media URLs to analyze
        if (hasUrlsToAnalyze) {
          requestBody.tools = [{ url_context: {} }];
        }

        const evalStartTime = Date.now();
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );
        const evalProcessingTime = Date.now() - evalStartTime;

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`[evaluate-conversation] Gemini API error for ${convId}:`, errorText);
          results.push({ conversation_id: convId, success: false, error: 'Erro na API Gemini' });
          continue;
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        // Log AI usage
        const usage = extractGeminiUsage(geminiData);
        logAIUsage(
          supabase,
          currentCompanyId,
          'evaluate-conversation',
          'gemini-3-flash-preview',
          usage.inputTokens,
          usage.outputTokens,
          evalProcessingTime,
          { 
            conversationId: convId,
            hasMedia: urlsToCache.length > 0
          }
        ).catch(err => console.error('[UsageTracker] Error:', err));

        if (!responseText) {
          results.push({ conversation_id: convId, success: false, error: 'Resposta vazia da IA' });
          continue;
        }

        // Parse JSON with repair
        let evaluation: EvaluationResult;
        try {
          // With responseMimeType, should be clean JSON, but still apply repair
          const cleanedJson = repairTruncatedJson(responseText);
          const jsonText = extractJson(cleanedJson) || cleanedJson;
          evaluation = JSON.parse(jsonText);
        } catch (parseError) {
          console.error(`[evaluate-conversation] Error parsing Gemini response for ${convId}:`, parseError);
          console.log('Response text:', responseText.substring(0, 500));
          results.push({ conversation_id: convId, success: false, error: 'Erro ao processar resposta da IA' });
          continue;
        }

        // Save evaluation
        const { error: insertError } = await supabase
          .from('conversation_evaluations')
          .upsert({
            conversation_id: convId,
            company_id: conversation.company_id,
            overall_score: evaluation.overall_score,
            communication_score: evaluation.communication_score,
            objectivity_score: evaluation.objectivity_score,
            humanization_score: evaluation.humanization_score,
            objection_handling_score: evaluation.objection_handling_score,
            closing_score: evaluation.closing_score,
            response_time_score: evaluation.response_time_score,
            lead_qualification: evaluation.lead_qualification,
            lead_interest_level: evaluation.lead_interest_level,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
            ai_summary: evaluation.ai_summary,
            lead_pain_points: evaluation.lead_pain_points,
            evaluated_at: new Date().toISOString(),
          }, { onConflict: 'conversation_id' });

        if (insertError) {
          results.push({ conversation_id: convId, success: false, error: 'Erro ao salvar avaliação' });
          continue;
        }

        // Cache analyzed URLs (fire and forget)
        if (urlsToCache.length > 0) {
          const analysisResult = { analyzed: true, score: evaluation.overall_score };
          for (const urlData of urlsToCache) {
            saveCacheAnalysis(supabase, urlData.url, currentCompanyId, urlData.type, analysisResult)
              .catch(err => console.error('[Cache] Save error:', err));
          }
          console.log(`[evaluate-conversation] Caching ${urlsToCache.length} new media URLs`);
        }

        console.log(`[evaluate-conversation] Successfully evaluated conversation ${convId}`);
        results.push({ conversation_id: convId, success: true });

      } catch (error) {
        console.error(`[evaluate-conversation] Unexpected error for ${convId}:`, error);
        results.push({ conversation_id: convId, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const remaining = conversationsToEvaluate.length - toEvaluate.length;

    console.log(`[evaluate-conversation] Completed: ${successCount} success, ${failCount} failed, ${remaining} remaining`);

    return new Response(JSON.stringify({
      success: true,
      evaluated: successCount,
      failed: failCount,
      remaining,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[evaluate-conversation] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
