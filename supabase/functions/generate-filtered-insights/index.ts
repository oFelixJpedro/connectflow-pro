import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logAIUsage, extractGeminiUsage } from '../_shared/usage-tracker.ts';

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

// ============= Interfaces =============

interface CriteriaScores {
  communication: number;
  objectivity: number;
  humanization: number;
  objection_handling: number;
  closing: number;
  response_time: number;
}

interface EvaluationData {
  conversation_id: string;
  overall_score: number | null;
  communication_score: number | null;
  objectivity_score: number | null;
  humanization_score: number | null;
  objection_handling_score: number | null;
  closing_score: number | null;
  response_time_score: number | null;
  strengths: string[] | null;
  improvements: string[] | null;
  ai_summary: string | null;
  lead_qualification: string | null;
}

interface MediaSample {
  url: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface ConversationWithMedia {
  conversationId: string;
  contactName?: string;
  evaluation: EvaluationData;
  medias: MediaSample[];
}

interface ProblematicMedia {
  url: string;
  issue: string;
  severity: 'baixa' | 'media' | 'alta';
  type: string;
  conversationId: string;
}

interface BatchAnalysisResult {
  batchIndex: number;
  conversationsAnalyzed: number;
  averageScore: number;
  strengths: string[];
  weaknesses: string[];
  positivePatterns: string[];
  negativePatterns: string[];
  problematicMedias: ProblematicMedia[];
  criticalIssues: string[];
  batchSummary: string;
  mediaStats: {
    total: number;
    images: number;
    videos: number;
    audios: number;
    documents: number;
  };
}

interface FilteredInsightsResult {
  strengths: string[];
  weaknesses: string[];
  positivePatterns: string[];
  negativePatterns: string[];
  insights: string[];
  criticalIssues: string[];
  finalRecommendation: string;
  mediaStats?: {
    total: number;
    problematic: number;
    byType: Record<string, number>;
  };
}

// ============= Helper Functions =============

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Transcribe audio using Gemini (base64)
async function transcribeAudio(audioUrl: string, geminiApiKey: string): Promise<string | null> {
  try {
    console.log(`[transcribeAudio] Transcribing audio: ${audioUrl.substring(0, 50)}...`);
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`[transcribeAudio] Failed to fetch audio: ${audioResponse.status}`);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const mimeType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: "Transcreva este áudio em português. Retorne apenas a transcrição, sem comentários." }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });
    
    if (!response.ok) {
      console.error(`[transcribeAudio] Gemini error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (transcription) {
      console.log(`[transcribeAudio] Success: ${transcription.substring(0, 50)}...`);
      return transcription;
    }
    
    return null;
  } catch (error) {
    console.error('[transcribeAudio] Error:', error);
    return null;
  }
}

// NOTA: Vídeos agora usam URL Context Tool (sem download)

// ============= Batch Analysis Function (URL Context Tool with Cache) =============

async function analyzeConversationBatch(
  batch: ConversationWithMedia[],
  batchIndex: number,
  geminiApiKey: string,
  supabase?: any,
  companyId?: string
): Promise<BatchAnalysisResult> {
  console.log(`[Batch ${batchIndex}] Starting analysis of ${batch.length} conversations`);
  
  const defaultResult: BatchAnalysisResult = {
    batchIndex,
    conversationsAnalyzed: batch.length,
    averageScore: 0,
    strengths: [],
    weaknesses: [],
    positivePatterns: [],
    negativePatterns: [],
    problematicMedias: [],
    criticalIssues: [],
    batchSummary: 'Análise não disponível',
    mediaStats: { total: 0, images: 0, videos: 0, audios: 0, documents: 0 },
  };
  
  const cacheEnabled = !!supabase && !!companyId;
  const cachedResults: { url: string; analysis: any }[] = [];
  const urlsToAnalyze: { url: string; type: string; convId: string }[] = [];
  
  try {
    const mediaStats = { total: 0, images: 0, videos: 0, audios: 0, documents: 0 };
    
    // Collect URLs for URL Context Tool (images, documents)
    const imageUrls: { url: string; convId: string }[] = [];
    const documentUrls: { url: string; convId: string }[] = [];
    const videoUrls: { url: string; convId: string }[] = []; // URL Context Tool
    const audioTranscriptions: { conversationId: string; transcription: string }[] = [];
    
    const MAX_IMAGES = 15;
    const MAX_DOCUMENTS = 5;
    const MAX_VIDEOS = 3; // URL Context Tool
    const MAX_AUDIOS = 2; // Limite reduzido para economizar memória
    
    // Process each conversation - check cache first
    for (const conv of batch) {
      const convMedias = conv.medias.slice(0, 10); // Max 10 medias per conversation
      
      for (const media of convMedias) {
        mediaStats.total++;
        
        // Check cache if enabled
        if (cacheEnabled) {
          const cached = await getCachedAnalysis(supabase, media.url, companyId);
          if (cached) {
            cachedResults.push({ url: media.url, analysis: cached });
            if (media.type === 'image') mediaStats.images++;
            else if (media.type === 'document') mediaStats.documents++;
            else if (media.type === 'video') mediaStats.videos++;
            continue; // Skip to next media, this one is cached
          }
        }
        
        if (media.type === 'image' && imageUrls.length < MAX_IMAGES) {
          mediaStats.images++;
          imageUrls.push({ url: media.url, convId: conv.conversationId });
          urlsToAnalyze.push({ url: media.url, type: 'image', convId: conv.conversationId });
        } else if (media.type === 'document' && documentUrls.length < MAX_DOCUMENTS) {
          mediaStats.documents++;
          documentUrls.push({ url: media.url, convId: conv.conversationId });
          urlsToAnalyze.push({ url: media.url, type: 'document', convId: conv.conversationId });
        } else if (media.type === 'video' && videoUrls.length < MAX_VIDEOS) {
          // URL Context Tool para vídeos (sem download)
          mediaStats.videos++;
          videoUrls.push({ url: media.url, convId: conv.conversationId });
          urlsToAnalyze.push({ url: media.url, type: 'video', convId: conv.conversationId });
        } else if (media.type === 'audio' && audioTranscriptions.length < MAX_AUDIOS) {
          // Transcrição de áudio (ainda precisa de download)
          const transcription = await transcribeAudio(media.url, geminiApiKey);
          if (transcription) {
            mediaStats.audios++;
            audioTranscriptions.push({ conversationId: conv.conversationId, transcription });
          }
        }
      }
    }
    
    // Build conversations summary text
    let conversationsSummary = batch.map((conv, i) => {
      const e = conv.evaluation;
      let summary = `### Conversa ${i + 1} (ID: ${conv.conversationId})\n`;
      if (conv.contactName) summary += `- Contato: ${conv.contactName}\n`;
      if (e.overall_score) summary += `- Score: ${e.overall_score}/10\n`;
      if (e.lead_qualification) summary += `- Lead: ${e.lead_qualification}\n`;
      if (e.ai_summary) summary += `- Resumo: ${e.ai_summary.substring(0, 150)}\n`;
      if (e.strengths?.length) summary += `- Pontos fortes: ${e.strengths.join(', ')}\n`;
      if (e.improvements?.length) summary += `- Melhorias: ${e.improvements.join(', ')}\n`;
      summary += `- Mídias: ${conv.medias.length}\n`;
      return summary;
    }).join('\n');
    
    // Add audio transcriptions to summary
    if (audioTranscriptions.length > 0) {
      conversationsSummary += '\n\n### Transcrições de Áudios:\n';
      audioTranscriptions.forEach((t, i) => {
        conversationsSummary += `\nÁudio ${i + 1} (Conversa ${t.conversationId}):\n"${t.transcription.substring(0, 300)}..."\n`;
      });
    }
    
    // Build media URLs section for URL Context Tool (todas as mídias visuais)
    let mediaUrlsSection = '';
    if (imageUrls.length > 0) {
      mediaUrlsSection += '\n## IMAGENS PARA ANALISAR (use URL Context para acessar):\n';
      imageUrls.forEach((img, i) => {
        mediaUrlsSection += `${i + 1}. [Conversa ${img.convId}]: ${img.url}\n`;
      });
    }
    if (videoUrls.length > 0) {
      mediaUrlsSection += '\n## VÍDEOS PARA ANALISAR (use URL Context para acessar):\n';
      videoUrls.forEach((vid, i) => {
        mediaUrlsSection += `${i + 1}. [Conversa ${vid.convId}]: ${vid.url}\n`;
      });
    }
    if (documentUrls.length > 0) {
      mediaUrlsSection += '\n## DOCUMENTOS PARA ANALISAR (use URL Context para acessar):\n';
      documentUrls.forEach((doc, i) => {
        mediaUrlsSection += `${i + 1}. [Conversa ${doc.convId}]: ${doc.url}\n`;
      });
    }
    
    // Build the prompt
    const prompt = `Você é um analista comercial especializado em vendas por WhatsApp. Analise este batch de ${batch.length} conversas comerciais.

## Dados das Conversas

${conversationsSummary}

## Total de Mídias no Batch
- Imagens: ${mediaStats.images}
- Vídeos: ${mediaStats.videos}
- Áudios: ${mediaStats.audios}
- Documentos: ${mediaStats.documents}
${mediaUrlsSection}

## Sua Tarefa

Analise TODAS as mídias fornecidas (imagens, vídeos, documentos) junto com os dados textuais. Para cada mídia, identifique:
1. O que é o conteúdo (descreva brevemente)
2. Se é relevante para vendas
3. Se há algo problemático (inapropriado, pessoal, baixa qualidade, irrelevante)

Retorne um JSON com esta estrutura EXATA:

{
  "batchIndex": ${batchIndex},
  "conversationsAnalyzed": ${batch.length},
  "averageScore": <média dos scores>,
  "strengths": ["<ponto forte 1>", "<ponto forte 2>", "<ponto forte 3>"],
  "weaknesses": ["<ponto fraco 1>", "<ponto fraco 2>", "<ponto fraco 3>"],
  "positivePatterns": ["<padrão positivo 1>", "<padrão positivo 2>"],
  "negativePatterns": ["<padrão negativo 1>", "<padrão negativo 2>"],
  "problematicMedias": [
    {
      "url": "<url se identificável ou 'não identificado'>",
      "issue": "<descrição do problema>",
      "severity": "baixa|media|alta",
      "type": "image|video|audio|document",
      "conversationId": "<id da conversa>"
    }
  ],
  "criticalIssues": ["<problema crítico se houver>"],
  "batchSummary": "<resumo de 2-3 frases deste batch>"
}

IMPORTANTE: 
- Seja CONCISO em cada item (máximo 80 caracteres)
- Array vazio se não houver problemas
- Responda APENAS com JSON válido, sem markdown`;

    // Build parts array - apenas texto (URLs no prompt para URL Context Tool)
    const parts: any[] = [{ text: prompt }];
    
    const hasUrlsToAnalyze = imageUrls.length > 0 || videoUrls.length > 0 || documentUrls.length > 0;
    console.log(`[Batch ${batchIndex}] Sending to Gemini with URL Context Tool: ${imageUrls.length} images, ${videoUrls.length} videos, ${documentUrls.length} docs`);
    
    // Build request with URL Context Tool
    const requestBody: any = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };
    
    // Add URL Context Tool if we have URLs to analyze
    if (hasUrlsToAnalyze) {
      requestBody.tools = [{ url_context: {} }];
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Batch ${batchIndex}] Gemini error: ${response.status}`, errorText.substring(0, 200));
      return { ...defaultResult, mediaStats };
    }
    
    const geminiData = await response.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Log AI usage for batch analysis
    if (supabase && companyId) {
      const usage = extractGeminiUsage(geminiData);
      await logAIUsage(
        supabase,
        companyId,
        'generate-filtered-insights-batch',
        'gemini-3-flash-preview',
        usage.inputTokens,
        usage.outputTokens,
        0,
        { batchIndex, conversationCount: batch.length },
        false // Text analysis, no direct audio
      );
    }
    
    if (!textContent) {
      console.error(`[Batch ${batchIndex}] No content in response`);
      return { ...defaultResult, mediaStats };
    }
    
    // Parse JSON response (com responseMimeType, deve vir limpo)
    let result: BatchAnalysisResult;
    try {
      let cleanedText = textContent.trim();
      if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
      if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
      if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
      cleanedText = cleanedText.trim();
      
      // Tenta reparar JSON truncado
      if (!cleanedText.endsWith('}')) {
        console.warn(`[Batch ${batchIndex}] JSON appears truncated, attempting repair`);
        const openBraces = (cleanedText.match(/{/g) || []).length;
        const closeBraces = (cleanedText.match(/}/g) || []).length;
        const openBrackets = (cleanedText.match(/\[/g) || []).length;
        const closeBrackets = (cleanedText.match(/]/g) || []).length;
        
        cleanedText += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        cleanedText += '}'.repeat(Math.max(0, openBraces - closeBraces));
      }
      
      result = JSON.parse(cleanedText);
      result.mediaStats = mediaStats;
      result.batchIndex = batchIndex;
      
      console.log(`[Batch ${batchIndex}] Success: ${result.problematicMedias?.length || 0} problematic medias found, cached: ${cachedResults.length}`);
      
      // Save analyzed URLs to cache (fire and forget)
      if (cacheEnabled && urlsToAnalyze.length > 0) {
        const simplifiedResult = {
          analyzed: true,
          hasProblems: (result.problematicMedias?.length || 0) > 0,
          batchIndex,
        };
        for (const urlData of urlsToAnalyze) {
          saveCacheAnalysis(supabase, urlData.url, companyId, urlData.type, simplifiedResult)
            .catch(err => console.error('[Cache] Save error:', err));
        }
        console.log(`[Batch ${batchIndex}] Caching ${urlsToAnalyze.length} new media URLs`);
      }
      
      return result;
    } catch (parseError) {
      console.error(`[Batch ${batchIndex}] JSON parse error:`, parseError);
      console.error(`[Batch ${batchIndex}] Raw response:`, textContent.substring(0, 500));
      return { ...defaultResult, mediaStats };
    }
  } catch (error) {
    console.error(`[Batch ${batchIndex}] Error:`, error);
    return defaultResult;
  }
}

// ============= Consolidation Function =============

async function consolidateBatchResults(
  batchResults: BatchAnalysisResult[],
  overallMetrics: { criteriaScores: CriteriaScores; totalEvaluations: number; avgScore: number },
  filterDescription: string | undefined,
  geminiApiKey: string,
  supabase?: any,
  companyId?: string
): Promise<FilteredInsightsResult> {
  console.log(`[Consolidate] Consolidating ${batchResults.length} batch results`);
  
  const defaultResult: FilteredInsightsResult = {
    strengths: [],
    weaknesses: [],
    positivePatterns: [],
    negativePatterns: [],
    insights: [],
    criticalIssues: [],
    finalRecommendation: 'Análise não disponível.',
  };
  
  try {
    // Aggregate all batch results
    const allStrengths: string[] = [];
    const allWeaknesses: string[] = [];
    const allPositivePatterns: string[] = [];
    const allNegativePatterns: string[] = [];
    const allProblematicMedias: ProblematicMedia[] = [];
    const allCriticalIssues: string[] = [];
    const allSummaries: string[] = [];
    
    let totalMedias = 0;
    const mediaByType: Record<string, number> = { images: 0, videos: 0, audios: 0, documents: 0 };
    let totalScore = 0;
    let totalConvs = 0;
    
    batchResults.forEach(batch => {
      allStrengths.push(...(batch.strengths || []));
      allWeaknesses.push(...(batch.weaknesses || []));
      allPositivePatterns.push(...(batch.positivePatterns || []));
      allNegativePatterns.push(...(batch.negativePatterns || []));
      allProblematicMedias.push(...(batch.problematicMedias || []));
      allCriticalIssues.push(...(batch.criticalIssues || []));
      if (batch.batchSummary) allSummaries.push(`Batch ${batch.batchIndex}: ${batch.batchSummary}`);
      
      if (batch.mediaStats) {
        totalMedias += batch.mediaStats.total;
        mediaByType.images += batch.mediaStats.images;
        mediaByType.videos += batch.mediaStats.videos;
        mediaByType.audios += batch.mediaStats.audios;
        mediaByType.documents += batch.mediaStats.documents;
      }
      
      totalScore += (batch.averageScore || 0) * (batch.conversationsAnalyzed || 1);
      totalConvs += batch.conversationsAnalyzed || 0;
    });
    
    const consolidatedAvgScore = totalConvs > 0 ? totalScore / totalConvs : overallMetrics.avgScore;
    
    // Build consolidation prompt
    const prompt = `Você é um consultor comercial sênior. Consolide os resultados de ${batchResults.length} batches de análise.

${filterDescription ? `**Contexto do Filtro:** ${filterDescription}\n` : ''}

## Métricas Gerais
- Total de Conversas: ${overallMetrics.totalEvaluations}
- Score Médio: ${consolidatedAvgScore.toFixed(1)}/10
- Scores por Critério:
  - Comunicação: ${overallMetrics.criteriaScores.communication.toFixed(1)}
  - Objetividade: ${overallMetrics.criteriaScores.objectivity.toFixed(1)}
  - Humanização: ${overallMetrics.criteriaScores.humanization.toFixed(1)}
  - Objeções: ${overallMetrics.criteriaScores.objection_handling.toFixed(1)}
  - Fechamento: ${overallMetrics.criteriaScores.closing.toFixed(1)}
  - Tempo Resposta: ${overallMetrics.criteriaScores.response_time.toFixed(1)}

## Mídias Analisadas
- Total: ${totalMedias} mídias
- Imagens: ${mediaByType.images}
- Vídeos: ${mediaByType.videos}
- Áudios: ${mediaByType.audios}
- Documentos: ${mediaByType.documents}
- Problemáticas: ${allProblematicMedias.length}

## Problemas em Mídias Detectados
${allProblematicMedias.length > 0 
  ? allProblematicMedias.slice(0, 10).map(m => `- [${m.severity.toUpperCase()}] ${m.type}: ${m.issue}`).join('\n')
  : '- Nenhum problema significativo detectado'}

## Resumos dos Batches
${allSummaries.join('\n')}

## Pontos Fortes Identificados
${[...new Set(allStrengths)].slice(0, 10).join(', ') || 'Nenhum'}

## Pontos Fracos Identificados
${[...new Set(allWeaknesses)].slice(0, 10).join(', ') || 'Nenhum'}

## Problemas Críticos
${[...new Set(allCriticalIssues)].slice(0, 5).join(', ') || 'Nenhum'}

---

Gere um JSON consolidado com:

{
  "strengths": ["<3 principais pontos fortes>"],
  "weaknesses": ["<3 principais pontos fracos>"],
  "positivePatterns": ["<2-3 padrões positivos>"],
  "negativePatterns": ["<2-3 padrões negativos>"],
  "insights": ["<3 insights acionáveis incluindo análise de mídias>"],
  "criticalIssues": ["<problemas críticos se houver>"],
  "finalRecommendation": "<recomendação final de 2-3 frases, incluindo feedback sobre uso de mídias>"
}

IMPORTANTE:
- Seja CONCISO (máximo 100 caracteres por item)
- Inclua observações sobre as mídias analisadas nos insights
- Se houver mídias problemáticas, mencione na recomendação
- Responda APENAS com JSON válido`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });
    
    if (!response.ok) {
      console.error(`[Consolidate] Gemini error: ${response.status}`);
      return defaultResult;
    }
    
    const geminiData = await response.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Log AI usage for consolidation
    if (supabase && companyId) {
      const usage = extractGeminiUsage(geminiData);
      await logAIUsage(
        supabase,
        companyId,
        'generate-filtered-insights-consolidate',
        'gemini-3-flash-preview',
        usage.inputTokens,
        usage.outputTokens,
        0,
        { batchCount: batchResults.length, totalEvaluations: overallMetrics.totalEvaluations },
        false // Text consolidation, no audio
      );
    }
    
    if (!textContent) {
      console.error('[Consolidate] No content in response');
      return defaultResult;
    }
    
    let result: FilteredInsightsResult;
    try {
      let cleanedText = textContent.trim();
      if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
      if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
      if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
      cleanedText = cleanedText.trim();
      
      // Tenta reparar JSON truncado
      if (!cleanedText.endsWith('}')) {
        console.warn('[Consolidate] JSON appears truncated, attempting repair');
        const openBraces = (cleanedText.match(/{/g) || []).length;
        const closeBraces = (cleanedText.match(/}/g) || []).length;
        const openBrackets = (cleanedText.match(/\[/g) || []).length;
        const closeBrackets = (cleanedText.match(/]/g) || []).length;
        
        cleanedText += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        cleanedText += '}'.repeat(Math.max(0, openBraces - closeBraces));
      }
      
      result = JSON.parse(cleanedText);
      
      // Add media stats
      result.mediaStats = {
        total: totalMedias,
        problematic: allProblematicMedias.length,
        byType: mediaByType,
      };
      
      // Validate arrays
      result.strengths = Array.isArray(result.strengths) ? result.strengths : [];
      result.weaknesses = Array.isArray(result.weaknesses) ? result.weaknesses : [];
      result.positivePatterns = Array.isArray(result.positivePatterns) ? result.positivePatterns : [];
      result.negativePatterns = Array.isArray(result.negativePatterns) ? result.negativePatterns : [];
      result.insights = Array.isArray(result.insights) ? result.insights : [];
      result.criticalIssues = Array.isArray(result.criticalIssues) ? result.criticalIssues : [];
      result.finalRecommendation = result.finalRecommendation || 'Análise concluída.';
      
      console.log(`[Consolidate] Success: ${result.insights.length} insights generated`);
      
      return result;
    } catch (parseError) {
      console.error('[Consolidate] JSON parse error:', parseError);
      return defaultResult;
    }
  } catch (error) {
    console.error('[Consolidate] Error:', error);
    return defaultResult;
  }
}

// ============= Main Handler =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's company_id for cache
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
    
    const companyId = profile?.company_id;
    console.log(`[generate-filtered-insights] User company_id: ${companyId}`);

    const { conversationsWithMedia, evaluations, criteriaScores, filterDescription } = await req.json() as {
      conversationsWithMedia?: ConversationWithMedia[];
      evaluations?: EvaluationData[]; // Legacy support
      criteriaScores: CriteriaScores;
      filterDescription?: string;
    };

    // Handle both new format (conversationsWithMedia) and legacy format (evaluations only)
    const hasMediaData = conversationsWithMedia && conversationsWithMedia.length > 0;
    const legacyEvaluations = evaluations || [];
    
    const totalEvaluations = hasMediaData 
      ? conversationsWithMedia.length 
      : legacyEvaluations.length;

    if (totalEvaluations === 0) {
      return new Response(JSON.stringify({
        strengths: ['Nenhuma avaliação encontrada para análise'],
        weaknesses: [],
        positivePatterns: [],
        negativePatterns: [],
        insights: ['Selecione outro filtro ou aguarde novas conversas avaliadas'],
        criticalIssues: [],
        finalRecommendation: 'Sem dados suficientes para análise personalizada.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Calculate average score
    const avgScore = hasMediaData
      ? conversationsWithMedia.reduce((sum, c) => sum + (c.evaluation.overall_score || 0), 0) / conversationsWithMedia.length
      : legacyEvaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / legacyEvaluations.length;

    console.log(`[generate-filtered-insights] Processing ${totalEvaluations} conversations, hasMedia: ${hasMediaData}, cacheEnabled: ${!!companyId}`);

    // If we have media data, use modular batch processing with cache
    if (hasMediaData) {
      // Divide into batches of 10 conversations
      const batches = chunkArray(conversationsWithMedia, 10);
      console.log(`[generate-filtered-insights] Created ${batches.length} batches, cache enabled: ${!!companyId}`);
      
      const batchResults: BatchAnalysisResult[] = [];
      
      // Process batches in waves of 3 (to avoid rate limits)
      for (let waveStart = 0; waveStart < batches.length; waveStart += 3) {
        const wave = batches.slice(waveStart, waveStart + 3);
        console.log(`[generate-filtered-insights] Processing wave ${Math.floor(waveStart / 3) + 1} with ${wave.length} batches`);
        
        const wavePromises = wave.map((batch, i) => 
          analyzeConversationBatch(batch, waveStart + i, geminiApiKey, supabase, companyId)
        );
        
        const waveResults = await Promise.all(wavePromises);
        batchResults.push(...waveResults);
      }
      
      // Consolidate all results
      const insights = await consolidateBatchResults(
        batchResults,
        { criteriaScores, totalEvaluations, avgScore },
        filterDescription,
        geminiApiKey,
        supabase,
        companyId
      );
      
      console.log(`[generate-filtered-insights] Completed with ${insights.mediaStats?.total || 0} medias analyzed`);
      
      return new Response(JSON.stringify(insights), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============= Legacy path: text-only analysis =============
    
    const evaluationsSummary = legacyEvaluations.slice(0, 20).map((e, i) => {
      const parts = [`Conversa ${i + 1}:`];
      if (e.overall_score) parts.push(`Score: ${e.overall_score}/10`);
      if (e.lead_qualification) parts.push(`Lead: ${e.lead_qualification}`);
      if (e.ai_summary) parts.push(`Resumo: ${e.ai_summary.substring(0, 200)}`);
      if (e.strengths?.length) parts.push(`Pontos fortes: ${e.strengths.join(', ')}`);
      if (e.improvements?.length) parts.push(`Melhorias: ${e.improvements.join(', ')}`);
      return parts.join('\n');
    }).join('\n\n---\n\n');

    const leadCounts = legacyEvaluations.reduce((acc, e) => {
      if (e.lead_qualification) {
        acc[e.lead_qualification] = (acc[e.lead_qualification] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const prompt = `Você é um analista comercial especializado em vendas por WhatsApp. Analise os dados de ${totalEvaluations} conversas comerciais e gere insights acionáveis.

${filterDescription ? `**Contexto do Filtro:** ${filterDescription}\n` : ''}

## Métricas Agregadas

- **Score Médio Geral:** ${avgScore.toFixed(1)}/10
- **Total de Conversas Avaliadas:** ${totalEvaluations}
- **Distribuição de Leads:** ${Object.entries(leadCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}

## Scores por Critério (média)

- Comunicação: ${criteriaScores.communication.toFixed(1)}/10
- Objetividade: ${criteriaScores.objectivity.toFixed(1)}/10
- Humanização: ${criteriaScores.humanization.toFixed(1)}/10
- Tratamento de Objeções: ${criteriaScores.objection_handling.toFixed(1)}/10
- Fechamento: ${criteriaScores.closing.toFixed(1)}/10
- Tempo de Resposta: ${criteriaScores.response_time.toFixed(1)}/10

## Avaliações Individuais (amostra de até 20)

${evaluationsSummary}

---

## Sua Tarefa

Retorne um JSON COMPACTO com estes campos (seja BREVE, máximo 1 frase por item):

1. **strengths** (array de 3 strings curtas): Pontos fortes principais.
2. **weaknesses** (array de 3 strings curtas): Pontos fracos principais.
3. **positivePatterns** (array de 2-3 strings curtas): Padrões positivos.
4. **negativePatterns** (array de 2-3 strings curtas): Padrões negativos.
5. **insights** (array de 3 strings curtas): Insights acionáveis.
6. **criticalIssues** (array de 0-2 strings): Problemas críticos. Array vazio se não houver.
7. **finalRecommendation** (string de 1-2 frases): Recomendação final.

IMPORTANTE: Seja conciso. Cada item deve ter no máximo 100 caracteres. Responda APENAS com JSON válido, sem markdown.`;

    console.log(`[generate-filtered-insights] Legacy path: analyzing ${totalEvaluations} evaluations`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-filtered-insights] Gemini error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const geminiData = await response.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    // Log AI usage for legacy path
    if (companyId) {
      const usage = extractGeminiUsage(geminiData);
      await logAIUsage(
        supabase,
        companyId,
        'generate-filtered-insights-legacy',
        'gemini-3-flash-preview',
        usage.inputTokens,
        usage.outputTokens,
        0,
        { evaluationCount: totalEvaluations },
        false // Legacy path, text only
      );
    }

    if (!textContent) {
      throw new Error('No content in Gemini response');
    }

    let insights: FilteredInsightsResult;
    try {
      let cleanedText = textContent.trim();
      if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
      if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
      if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
      cleanedText = cleanedText.trim();

      if (!cleanedText.endsWith('}')) {
        console.log('[generate-filtered-insights] Attempting to repair truncated JSON');
        const lastCompleteQuote = cleanedText.lastIndexOf('",');
        const lastCompleteBracket = cleanedText.lastIndexOf('],');
        const lastComplete = Math.max(lastCompleteQuote, lastCompleteBracket);
        
        if (lastComplete > 0) {
          cleanedText = cleanedText.substring(0, lastComplete + 1);
          const openBrackets = (cleanedText.match(/\[/g) || []).length;
          const closeBrackets = (cleanedText.match(/\]/g) || []).length;
          const openBraces = (cleanedText.match(/\{/g) || []).length;
          const closeBraces = (cleanedText.match(/\}/g) || []).length;
          
          cleanedText += ']'.repeat(openBrackets - closeBrackets);
          cleanedText += '}'.repeat(openBraces - closeBraces);
        }
      }

      insights = JSON.parse(cleanedText);
      
      insights = {
        strengths: Array.isArray(insights.strengths) ? insights.strengths : [],
        weaknesses: Array.isArray(insights.weaknesses) ? insights.weaknesses : [],
        positivePatterns: Array.isArray(insights.positivePatterns) ? insights.positivePatterns : [],
        negativePatterns: Array.isArray(insights.negativePatterns) ? insights.negativePatterns : [],
        insights: Array.isArray(insights.insights) ? insights.insights : [],
        criticalIssues: Array.isArray(insights.criticalIssues) ? insights.criticalIssues : [],
        finalRecommendation: typeof insights.finalRecommendation === 'string' ? insights.finalRecommendation : 'Análise concluída.',
      };
    } catch (parseError) {
      console.error('[generate-filtered-insights] Failed to parse AI response:', textContent.substring(0, 500));
      throw new Error('Failed to parse AI insights response');
    }

    console.log('[generate-filtered-insights] Successfully generated insights');

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-filtered-insights] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      strengths: [],
      weaknesses: [],
      positivePatterns: [],
      negativePatterns: [],
      insights: ['Erro ao gerar análise de IA. Tente novamente.'],
      criticalIssues: [],
      finalRecommendation: 'Não foi possível gerar a análise no momento.',
    }), {
      status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
