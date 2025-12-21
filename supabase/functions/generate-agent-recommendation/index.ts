import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= Media Cache Functions =============

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
    
    // Increment hit count (fire and forget)
    supabase.rpc('increment_cache_hit', { p_url_hash: urlHash, p_company_id: companyId }).then(() => {});
    
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
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }, { onConflict: 'url_hash,company_id' });
    
    console.log(`[Cache] SAVED for ${url.substring(0, 50)}...`);
  } catch (error) {
    console.error('[Cache] Error saving:', error);
  }
}

// ==================== INTERFACES ====================

interface MediaSample {
  url: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
  direction: 'inbound' | 'outbound';
  messageContent?: string;
}

interface ConversationWithMedia {
  conversationId: string;
  contactName?: string;
  medias: MediaSample[];
  evaluationScore?: number;
}

interface BatchAnalysisResult {
  batchIndex: number;
  totalMedias: number;
  relevantes: number;
  problematicas: ProblematicMedia[];
  padroesPositivos: string[];
  padroesNegativos: string[];
  error?: string;
}

interface ProblematicMedia {
  url: string;
  problema: string;
  gravidade: 'baixa' | 'media' | 'alta';
  conversationId: string;
  tipo: string;
}

interface AgentRecommendationRequest {
  agentName: string;
  level: 'junior' | 'pleno' | 'senior';
  overallScore: number;
  criteriaScores: {
    communication: number;
    objectivity: number;
    humanization: number;
    objection_handling: number;
    closing: number;
    response_time: number;
  };
  conversionRate: number;
  totalConversations: number;
  closedDeals: number;
  lostDeals: number;
  avgResponseTime: number;
  strengths: string[];
  weaknesses: string[];
  alertsCount: number;
  criticalAlertsCount: number;
  alertTypes: string[];
  recentPerformance: 'improving' | 'stable' | 'declining';
  // Nova estrutura: conversas com suas mídias agrupadas
  conversationsWithMedia?: ConversationWithMedia[];
  // Mantém compatibilidade com formato antigo
  mediaSamples?: MediaSample[];
}

// ==================== FUNÇÕES AUXILIARES ====================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Transcreve áudio usando Gemini (única função que ainda baixa conteúdo)
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('[generate-agent-recommendation] 🎙️ Transcribing audio:', audioUrl.substring(0, 50));
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('[generate-agent-recommendation] ❌ Failed to fetch audio:', audioResponse.status);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
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
                  mime_type: contentType,
                  data: base64Audio
                }
              },
              {
                text: "Transcreva este áudio em português. Retorne APENAS a transcrição, sem comentários adicionais."
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );
    
    if (!geminiResponse.ok) {
      console.error('[generate-agent-recommendation] ❌ Gemini transcription failed:', await geminiResponse.text());
      return null;
    }
    
    const data = await geminiResponse.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('[generate-agent-recommendation] ✅ Audio transcribed successfully');
    return transcription || null;
  } catch (error) {
    console.error('[generate-agent-recommendation] ❌ Error transcribing audio:', error);
    return null;
  }
}

// Divide array em chunks
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// NOTA: Vídeos agora usam URL Context Tool (sem download)

// ==================== ETAPA 1: ANÁLISE POR BATCH (URL Context Tool with Cache) ====================

async function analyzeConversationBatch(
  conversations: ConversationWithMedia[],
  batchIndex: number,
  geminiApiKey: string,
  supabase?: any,
  companyId?: string
): Promise<BatchAnalysisResult> {
  try {
    console.log(`[generate-agent-recommendation] 📦 Analyzing batch ${batchIndex + 1} with ${conversations.length} conversations`);
    
    const cacheEnabled = !!supabase && !!companyId;
    const cachedResults: { url: string; analysis: any }[] = [];
    const urlsToAnalyze: { url: string; type: string; convId: string }[] = [];
    
    let mediaCount = { images: 0, videos: 0, documents: 0, audios: 0 };
    const audioTranscriptions: string[] = [];
    
    // Collect URLs for URL Context Tool (todas as mídias visuais)
    const imageUrls: { url: string; convId: string }[] = [];
    const documentUrls: { url: string; convId: string }[] = [];
    const videoUrls: { url: string; convId: string }[] = []; // URL Context Tool
    
    const MAX_IMAGES = 15;
    const MAX_DOCUMENTS = 5;
    const MAX_VIDEOS_PER_BATCH = 3; // URL Context Tool
    const MAX_AUDIOS_PER_BATCH = 2; // Limite reduzido para economizar memória

    // Processa todas as mídias das conversas do batch - check cache first
    for (const conv of conversations) {
      for (const media of conv.medias) {
        try {
          // Check cache if enabled
          if (cacheEnabled) {
            const cached = await getCachedAnalysis(supabase, media.url, companyId);
            if (cached) {
              cachedResults.push({ url: media.url, analysis: cached });
              if (media.type === 'image') mediaCount.images++;
              else if (media.type === 'document') mediaCount.documents++;
              else if (media.type === 'video') mediaCount.videos++;
              continue; // Skip to next media, this one is cached
            }
          }
          
          if (media.type === 'image' && imageUrls.length < MAX_IMAGES) {
            // Collect URL for URL Context Tool
            imageUrls.push({ url: media.url, convId: conv.conversationId.substring(0, 8) });
            mediaCount.images++;
            urlsToAnalyze.push({ url: media.url, type: 'image', convId: conv.conversationId });
          } else if (media.type === 'document' && documentUrls.length < MAX_DOCUMENTS) {
            documentUrls.push({ url: media.url, convId: conv.conversationId.substring(0, 8) });
            mediaCount.documents++;
            urlsToAnalyze.push({ url: media.url, type: 'document', convId: conv.conversationId });
          } else if (media.type === 'video' && videoUrls.length < MAX_VIDEOS_PER_BATCH) {
            // URL Context Tool para vídeos (sem download)
            videoUrls.push({ url: media.url, convId: conv.conversationId.substring(0, 8) });
            mediaCount.videos++;
            urlsToAnalyze.push({ url: media.url, type: 'video', convId: conv.conversationId });
          } else if (media.type === 'audio' && mediaCount.audios < MAX_AUDIOS_PER_BATCH) {
            // Áudio ainda precisa de transcrição (download necessário)
            const transcription = await transcribeAudio(media.url, geminiApiKey);
            if (transcription) {
              audioTranscriptions.push(`[Áudio da conversa ${conv.conversationId.substring(0, 8)}]: ${transcription}`);
              mediaCount.audios++;
            }
          }
        } catch (error) {
          console.error(`[generate-agent-recommendation] ⚠️ Error processing media:`, error);
        }
      }
    }

    const totalMedia = mediaCount.images + mediaCount.videos + mediaCount.documents + mediaCount.audios;
    console.log(`[generate-agent-recommendation] 📊 Batch ${batchIndex + 1} media count:`, mediaCount);

    if (totalMedia === 0) {
      return {
        batchIndex,
        totalMedias: 0,
        relevantes: 0,
        problematicas: [],
        padroesPositivos: [],
        padroesNegativos: [],
      };
    }

    // Build media URLs section for URL Context Tool (todas as mídias visuais)
    let mediaUrlsSection = '';
    if (imageUrls.length > 0) {
      mediaUrlsSection += '\n## IMAGENS PARA ANALISAR:\n';
      imageUrls.forEach((img, i) => {
        mediaUrlsSection += `${i + 1}. [Conv ${img.convId}]: ${img.url}\n`;
      });
    }
    if (videoUrls.length > 0) {
      mediaUrlsSection += '\n## VÍDEOS PARA ANALISAR:\n';
      videoUrls.forEach((vid, i) => {
        mediaUrlsSection += `${i + 1}. [Conv ${vid.convId}]: ${vid.url}\n`;
      });
    }
    if (documentUrls.length > 0) {
      mediaUrlsSection += '\n## DOCUMENTOS PARA ANALISAR:\n';
      documentUrls.forEach((doc, i) => {
        mediaUrlsSection += `${i + 1}. [Conv ${doc.convId}]: ${doc.url}\n`;
      });
    }

    // Prompt para análise do batch
    const batchPrompt = `Você é um analista de qualidade de atendimento comercial.

Analise as mídias enviadas pelo vendedor nestas ${conversations.length} conversas de vendas.

## ESTATÍSTICAS DO BATCH
- Imagens: ${mediaCount.images}
- Vídeos: ${mediaCount.videos}
- Documentos: ${mediaCount.documents}
- Áudios transcritos: ${mediaCount.audios}
${mediaUrlsSection}

${audioTranscriptions.length > 0 ? `## TRANSCRIÇÕES DE ÁUDIOS:\n${audioTranscriptions.join('\n\n')}` : ''}

## INSTRUÇÕES

Para CADA mídia (imagem/vídeo/documento), analise:
1. O que é o conteúdo? Descreva brevemente.
2. É relevante para um contexto de vendas? (catálogo, proposta, produto, etc.)
3. Há algo problemático? (pessoal, inapropriado, irrelevante, baixa qualidade)

Para áudios, analise o tom, profissionalismo e relevância.

## RESPOSTA

Retorne APENAS um JSON válido (sem markdown, sem \`\`\`) no formato:
{
  "totalMedias": ${totalMedia},
  "relevantes": <número de mídias relevantes para vendas>,
  "problematicas": [
    {
      "url": "<url da mídia>",
      "problema": "<descrição do problema>",
      "gravidade": "baixa|media|alta",
      "tipo": "image|video|audio|document"
    }
  ],
  "padroesPositivos": ["<padrão positivo identificado>"],
  "padroesNegativos": ["<padrão negativo identificado>"]
}

Se não houver problemas, retorne array vazio em "problematicas".`;

    // Build parts array - apenas texto (URLs no prompt para URL Context Tool)
    const parts: any[] = [{ text: batchPrompt }];

    const hasUrlsToAnalyze = imageUrls.length > 0 || videoUrls.length > 0 || documentUrls.length > 0;
    console.log(`[generate-agent-recommendation] 📊 Batch ${batchIndex + 1}: ${imageUrls.length} images, ${videoUrls.length} videos, ${documentUrls.length} docs via URL Context`);

    // Build request with URL Context Tool
    const requestBody: any = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json", // Força JSON válido
      },
    };
    
    // Add URL Context Tool if we have URLs to analyze
    if (hasUrlsToAnalyze) {
      requestBody.tools = [{ url_context: {} }];
    }

    // Chama Gemini com URL Context Tool
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-agent-recommendation] ❌ Batch ${batchIndex + 1} Gemini error:`, errorText);
      return {
        batchIndex,
        totalMedias: totalMedia,
        relevantes: 0,
        problematicas: [],
        padroesPositivos: [],
        padroesNegativos: [],
        error: `Gemini API error: ${response.status}`,
      };
    }

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log(`[generate-agent-recommendation] ✅ Batch ${batchIndex + 1} response preview:`, responseText.substring(0, 200));

    // Parse do JSON (com responseMimeType, deve vir limpo)
    try {
      // Remove possíveis marcadores de código (fallback)
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
      cleanJson = cleanJson.trim();
      
      // Tenta reparar JSON truncado
      if (!cleanJson.endsWith('}')) {
        console.warn(`[generate-agent-recommendation] ⚠️ JSON appears truncated, attempting repair`);
        // Tenta fechar arrays e objetos abertos
        const openBraces = (cleanJson.match(/{/g) || []).length;
        const closeBraces = (cleanJson.match(/}/g) || []).length;
        const openBrackets = (cleanJson.match(/\[/g) || []).length;
        const closeBrackets = (cleanJson.match(/]/g) || []).length;
        
        // Adiciona fechamentos faltantes
        cleanJson += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        cleanJson += '}'.repeat(Math.max(0, openBraces - closeBraces));
      }
      
      const parsed = JSON.parse(cleanJson);
      
      console.log(`[generate-agent-recommendation] ✅ Batch ${batchIndex + 1} parsed, cached: ${cachedResults.length}`);
      
      // Save analyzed URLs to cache (fire and forget)
      if (cacheEnabled && urlsToAnalyze.length > 0) {
        const simplifiedResult = {
          analyzed: true,
          hasProblems: (parsed.problematicas?.length || 0) > 0,
          batchIndex,
        };
        for (const urlData of urlsToAnalyze) {
          saveCacheAnalysis(supabase, urlData.url, companyId, urlData.type, simplifiedResult)
            .catch(err => console.error('[Cache] Save error:', err));
        }
        console.log(`[generate-agent-recommendation] 💾 Caching ${urlsToAnalyze.length} new media URLs`);
      }
      
      return {
        batchIndex,
        totalMedias: parsed.totalMedias || totalMedia,
        relevantes: parsed.relevantes || 0,
        problematicas: (parsed.problematicas || []).map((p: any) => ({
          ...p,
          conversationId: conversations[0]?.conversationId || 'unknown',
        })),
        padroesPositivos: parsed.padroesPositivos || [],
        padroesNegativos: parsed.padroesNegativos || [],
      };
    } catch (parseError) {
      console.error(`[generate-agent-recommendation] ⚠️ Failed to parse batch ${batchIndex + 1} response:`, parseError);
      console.error(`[generate-agent-recommendation] Raw response:`, responseText.substring(0, 500));
      return {
        batchIndex,
        totalMedias: totalMedia,
        relevantes: totalMedia, // Assume todas são relevantes se não conseguir parsear
        problematicas: [],
        padroesPositivos: [],
        padroesNegativos: [],
        error: 'Failed to parse response',
      };
    }
  } catch (error) {
    console.error(`[generate-agent-recommendation] ❌ Batch ${batchIndex + 1} error:`, error);
    return {
      batchIndex,
      totalMedias: 0,
      relevantes: 0,
      problematicas: [],
      padroesPositivos: [],
      padroesNegativos: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== ETAPA 2: CONSOLIDAÇÃO FINAL ====================

async function consolidateAndGenerateRecommendation(
  batchResults: BatchAnalysisResult[],
  agentData: AgentRecommendationRequest,
  geminiApiKey: string
): Promise<string> {
  console.log('[generate-agent-recommendation] 🔄 Consolidating', batchResults.length, 'batch results');

  // Consolida estatísticas de todos os batches
  const totalMedias = batchResults.reduce((sum, b) => sum + b.totalMedias, 0);
  const totalRelevantes = batchResults.reduce((sum, b) => sum + b.relevantes, 0);
  const allProblematicas = batchResults.flatMap(b => b.problematicas);
  const allPadroesPositivos = [...new Set(batchResults.flatMap(b => b.padroesPositivos))];
  const allPadroesNegativos = [...new Set(batchResults.flatMap(b => b.padroesNegativos))];

  // Categoriza problemas por gravidade
  const problemasAlta = allProblematicas.filter(p => p.gravidade === 'alta');
  const problemasMedia = allProblematicas.filter(p => p.gravidade === 'media');
  const problemasBaixa = allProblematicas.filter(p => p.gravidade === 'baixa');

  console.log('[generate-agent-recommendation] 📊 Consolidated stats:', {
    totalMedias,
    totalRelevantes,
    problemas: allProblematicas.length,
    padroesPositivos: allPadroesPositivos.length,
    padroesNegativos: allPadroesNegativos.length,
  });

  // Monta o prompt final
  const criteriaLabels: Record<string, string> = {
    communication: 'Comunicação',
    objectivity: 'Objetividade',
    humanization: 'Humanização',
    objection_handling: 'Tratamento de Objeções',
    closing: 'Fechamento',
    response_time: 'Tempo de Resposta',
  };

  const criteriaDetails = Object.entries(agentData.criteriaScores)
    .map(([key, value]) => `- ${criteriaLabels[key]}: ${value.toFixed(1)}/10`)
    .join('\n');

  const levelLabel = agentData.level === 'junior' ? 'Junior' : agentData.level === 'pleno' ? 'Pleno' : 'Senior';
  const performanceLabel = agentData.recentPerformance === 'improving' 
    ? 'melhorando' 
    : agentData.recentPerformance === 'declining' 
      ? 'declinando' 
      : 'estável';

  const mediaAnalysisSection = totalMedias > 0 ? `
## ANÁLISE COMPLETA DE MÍDIAS (${totalMedias} arquivos analisados)

### Estatísticas
- Total de mídias analisadas: ${totalMedias}
- Mídias relevantes: ${totalRelevantes} (${totalMedias > 0 ? ((totalRelevantes / totalMedias) * 100).toFixed(0) : 0}%)
- Problemas detectados: ${allProblematicas.length}

### Problemas por Gravidade
- Alta: ${problemasAlta.length} ${problemasAlta.length > 0 ? `(${problemasAlta.map(p => p.problema).slice(0, 3).join('; ')})` : ''}
- Média: ${problemasMedia.length} ${problemasMedia.length > 0 ? `(${problemasMedia.map(p => p.problema).slice(0, 3).join('; ')})` : ''}
- Baixa: ${problemasBaixa.length}

### Padrões Positivos Identificados
${allPadroesPositivos.length > 0 ? allPadroesPositivos.map(p => `- ${p}`).join('\n') : '- Nenhum padrão positivo destacado'}

### Padrões Negativos Identificados
${allPadroesNegativos.length > 0 ? allPadroesNegativos.map(p => `- ${p}`).join('\n') : '- Nenhum padrão negativo identificado'}
` : '';

  const prompt = `Você é um consultor especialista em gestão de equipes de vendas. Gere uma recomendação ESPECÍFICA e ACIONÁVEL baseada em TODOS os dados abaixo.

## DADOS DO ATENDENTE

**Nome:** ${agentData.agentName}
**Nível:** ${levelLabel}
**Score Geral:** ${agentData.overallScore.toFixed(1)}/10
**Performance Recente:** ${performanceLabel}

### Métricas de Conversão
- Total de Conversas: ${agentData.totalConversations}
- Negócios Fechados: ${agentData.closedDeals}
- Negócios Perdidos: ${agentData.lostDeals}
- Taxa de Conversão: ${agentData.conversionRate.toFixed(1)}%
- Tempo Médio de Resposta: ${agentData.avgResponseTime.toFixed(0)} minutos

### Scores por Critério
${criteriaDetails}

### Pontos Fortes
${agentData.strengths.length > 0 ? agentData.strengths.map(s => `- ${s}`).join('\n') : '- Nenhum ponto forte destacado'}

### Pontos de Melhoria
${agentData.weaknesses.length > 0 ? agentData.weaknesses.map(w => `- ${w}`).join('\n') : '- Nenhuma melhoria identificada'}

### Alertas Comportamentais
- Total de Alertas: ${agentData.alertsCount}
- Alertas Críticos/Altos: ${agentData.criticalAlertsCount}
${agentData.alertTypes.length > 0 ? `- Tipos: ${agentData.alertTypes.join(', ')}` : ''}
${mediaAnalysisSection}

## INSTRUÇÕES

Gere uma recomendação que:
1. **Cite dados específicos** das métricas e análise de mídia
2. **Identifique 2-3 ações concretas** com prazos
3. **Priorize problemas críticos** (alertas e mídias problemáticas)
4. **Use tom construtivo** mas seja direto sobre problemas
5. **Considere o nível do atendente**
${totalMedias > 0 ? '6. **Inclua observações sobre as mídias** - padrões positivos/negativos encontrados' : ''}

**Formato:** 3-4 parágrafos, 200-400 palavras, português brasileiro, texto corrido.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generate-agent-recommendation] ❌ Consolidation error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const recommendation = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

  console.log('[generate-agent-recommendation] ✅ Final recommendation generated, length:', recommendation.length);

  return recommendation;
}

// ==================== HANDLER PRINCIPAL ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client for cache
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const data: AgentRecommendationRequest & { companyId?: string } = await req.json();
    
    console.log('[generate-agent-recommendation] 🚀 Starting for:', data.agentName);
    console.log('[generate-agent-recommendation] Conversations with media:', data.conversationsWithMedia?.length || 0);
    console.log('[generate-agent-recommendation] Legacy media samples:', data.mediaSamples?.length || 0);
    console.log('[generate-agent-recommendation] Company ID for cache:', data.companyId || 'not provided');

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    const companyId = data.companyId;

    let batchResults: BatchAnalysisResult[] = [];
    
    // Verifica se está usando a nova estrutura (conversas com mídias)
    if (data.conversationsWithMedia && data.conversationsWithMedia.length > 0) {
      // Nova arquitetura: processa por batches de conversas
      const BATCH_SIZE = 10;
      const conversationBatches = chunkArray(data.conversationsWithMedia, BATCH_SIZE);
      
      console.log('[generate-agent-recommendation] 📦 Processing', conversationBatches.length, 'batches, cache enabled:', !!companyId);

      // Processa batches em paralelo (máx 3 simultâneos para não sobrecarregar)
      const MAX_PARALLEL = 3;
      for (let i = 0; i < conversationBatches.length; i += MAX_PARALLEL) {
        const batchPromises = conversationBatches
          .slice(i, i + MAX_PARALLEL)
          .map((batch, idx) => analyzeConversationBatch(batch, i + idx, geminiApiKey, supabase, companyId));
        
        const results = await Promise.all(batchPromises);
        batchResults.push(...results);
        
        console.log(`[generate-agent-recommendation] ✅ Completed batches ${i + 1} to ${Math.min(i + MAX_PARALLEL, conversationBatches.length)}`);
      }
    } else if (data.mediaSamples && data.mediaSamples.length > 0) {
      // Compatibilidade: converte formato antigo para novo
      console.log('[generate-agent-recommendation] 🔄 Using legacy media format, converting...');
      
      const singleConversation: ConversationWithMedia = {
        conversationId: 'legacy',
        medias: data.mediaSamples,
      };
      
      const result = await analyzeConversationBatch([singleConversation], 0, geminiApiKey, supabase, companyId);
      batchResults.push(result);
    }

    // Etapa 2: Consolidação e geração da recomendação final
    const recommendation = await consolidateAndGenerateRecommendation(batchResults, data, geminiApiKey);

    // Prepara estatísticas para retorno
    const mediaAnalyzed = {
      images: batchResults.reduce((sum, b) => sum + (b.totalMedias || 0), 0),
      problematicas: batchResults.reduce((sum, b) => sum + (b.problematicas?.length || 0), 0),
      batchesProcessed: batchResults.length,
    };

    console.log('[generate-agent-recommendation] 🎉 Complete!', mediaAnalyzed);

    return new Response(JSON.stringify({ 
      recommendation,
      mediaAnalyzed,
      batchResults: batchResults.map(b => ({
        batchIndex: b.batchIndex,
        totalMedias: b.totalMedias,
        relevantes: b.relevantes,
        problemasCount: b.problematicas.length,
        error: b.error,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-agent-recommendation] ❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: null 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
