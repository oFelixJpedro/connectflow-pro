import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  analyzeMedia,
  transcribeAudioWithFileAPI,
  analyzeImageWithFileAPI,
  analyzeVideoWithFileAPI,
  analyzeDocumentWithFileAPI
} from '../_shared/gemini-file-api.ts';
import { getCachedAnalysis, saveCacheAnalysis } from '../_shared/media-cache.ts';
import { logAIUsage } from '../_shared/usage-tracker.ts';
import { checkCredits, consumeCredits } from '../_shared/supabase-credits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  conversationsWithMedia?: ConversationWithMedia[];
  mediaSamples?: MediaSample[];
}

// ==================== FUNÇÕES AUXILIARES ====================

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ==================== ETAPA 1: ANÁLISE POR BATCH (Gemini File API com Cache) ====================

async function analyzeConversationBatch(
  conversations: ConversationWithMedia[],
  batchIndex: number,
  geminiApiKey: string,
  supabase?: any,
  companyId?: string
): Promise<BatchAnalysisResult> {
  const startTime = Date.now();
  try {
    console.log(`[generate-agent-recommendation] 📦 Analyzing batch ${batchIndex + 1} with ${conversations.length} conversations`);
    
    const cacheEnabled = !!supabase && !!companyId;
    const mediaDescriptions: string[] = [];
    
    let mediaCount = { images: 0, videos: 0, documents: 0, audios: 0 };
    
    const MAX_IMAGES = 15;
    const MAX_DOCUMENTS = 5;
    const MAX_VIDEOS_PER_BATCH = 3;
    const MAX_AUDIOS_PER_BATCH = 2;

    // Processa todas as mídias das conversas do batch usando Gemini File API
    for (const conv of conversations) {
      for (const media of conv.medias) {
        try {
          const convId = conv.conversationId.substring(0, 8);
          
          if (media.type === 'image' && mediaCount.images < MAX_IMAGES) {
            const analysis = await analyzeImageWithFileAPI(
              media.url, geminiApiKey, supabase, companyId || ''
            );
            if (analysis) {
              mediaDescriptions.push(`📸 [Conv ${convId}] IMAGEM: ${analysis}`);
              mediaCount.images++;
            }
          } else if (media.type === 'document' && mediaCount.documents < MAX_DOCUMENTS) {
            const analysis = await analyzeDocumentWithFileAPI(
              media.url, geminiApiKey, supabase, companyId || ''
            );
            if (analysis) {
              mediaDescriptions.push(`📄 [Conv ${convId}] DOCUMENTO: ${analysis}`);
              mediaCount.documents++;
            }
          } else if (media.type === 'video' && mediaCount.videos < MAX_VIDEOS_PER_BATCH) {
            const analysis = await analyzeVideoWithFileAPI(
              media.url, geminiApiKey, supabase, companyId || ''
            );
            if (analysis) {
              mediaDescriptions.push(`🎬 [Conv ${convId}] VÍDEO: ${analysis}`);
              mediaCount.videos++;
            }
          } else if (media.type === 'audio' && mediaCount.audios < MAX_AUDIOS_PER_BATCH) {
            const transcription = await transcribeAudioWithFileAPI(
              media.url, geminiApiKey, supabase, companyId || ''
            );
            if (transcription) {
              mediaDescriptions.push(`🎙️ [Conv ${convId}] ÁUDIO: ${transcription}`);
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

    // Prompt para análise do batch
    const batchPrompt = `Você é um analista de qualidade de atendimento comercial.

Analise as mídias enviadas pelo vendedor nestas ${conversations.length} conversas de vendas.

## MÍDIAS ANALISADAS (${totalMedia} arquivos)

${mediaDescriptions.join('\n\n')}

## INSTRUÇÕES

Para CADA mídia descrita acima, analise:
1. É relevante para um contexto de vendas? (catálogo, proposta, produto, etc.)
2. Há algo problemático? (pessoal, inapropriado, irrelevante, baixa qualidade)

## RESPOSTA

Retorne APENAS um JSON válido (sem markdown, sem \`\`\`) no formato:
{
  "totalMedias": ${totalMedia},
  "relevantes": <número de mídias relevantes para vendas>,
  "problematicas": [
    {
      "url": "<identificador da mídia>",
      "problema": "<descrição do problema>",
      "gravidade": "baixa|media|alta",
      "tipo": "image|video|audio|document"
    }
  ],
  "padroesPositivos": ["<padrão positivo identificado>"],
  "padroesNegativos": ["<padrão negativo identificado>"]
}

Se não houver problemas, retorne array vazio em "problematicas".`;

    // Build request
    const requestBody: any = {
      contents: [{ role: 'user', parts: [{ text: batchPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    // Chama Gemini
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
    
    // Extract usage metadata for tracking
    const usageMetadata = result.usageMetadata;
    const usage = {
      input: usageMetadata?.promptTokenCount || Math.ceil(batchPrompt.length / 4),
      output: usageMetadata?.candidatesTokenCount || Math.ceil(responseText.length / 4)
    };
    
    // Log AI usage
    if (supabase && companyId) {
      await logAIUsage(
        supabase, companyId, 'generate-agent-recommendation-batch',
        'gemini-3-flash-preview',
        usage.input, usage.output,
        Date.now() - startTime,
        { batch_index: batchIndex, conversations_count: conversations.length, total_media: totalMedia },
        false // Media descriptions are text, audio is transcribed separately
      );
    }
    
    console.log(`[generate-agent-recommendation] ✅ Batch ${batchIndex + 1} response preview:`, responseText.substring(0, 200));

    // Parse do JSON
    try {
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
      cleanJson = cleanJson.trim();
      
      // Tenta reparar JSON truncado
      if (!cleanJson.endsWith('}')) {
        console.warn(`[generate-agent-recommendation] ⚠️ JSON appears truncated, attempting repair`);
        const openBraces = (cleanJson.match(/{/g) || []).length;
        const closeBraces = (cleanJson.match(/}/g) || []).length;
        const openBrackets = (cleanJson.match(/\[/g) || []).length;
        const closeBrackets = (cleanJson.match(/]/g) || []).length;
        
        cleanJson += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        cleanJson += '}'.repeat(Math.max(0, openBraces - closeBraces));
      }
      
      const parsed = JSON.parse(cleanJson);
      
      console.log(`[generate-agent-recommendation] ✅ Batch ${batchIndex + 1} parsed successfully`);
      
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
        relevantes: totalMedia,
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
  geminiApiKey: string,
  supabase?: any,
  companyId?: string
): Promise<string> {
  const startTime = Date.now();
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

  // Extract usage metadata for tracking
  const usageMetadata = result.usageMetadata;
  const usage = {
    input: usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4),
    output: usageMetadata?.candidatesTokenCount || Math.ceil(recommendation.length / 4)
  };
  
  // Log AI usage for consolidation
  if (supabase && companyId) {
    await logAIUsage(
      supabase, companyId, 'generate-agent-recommendation-consolidate',
      'gemini-3-flash-preview',
      usage.input, usage.output,
      Date.now() - startTime,
      { agent_name: agentData.agentName, total_batches: batchResults.length, total_medias: totalMedias },
      false // Text consolidation
    );
  }

  console.log('[generate-agent-recommendation] ✅ Final recommendation generated, length:', recommendation.length);

  return recommendation;
}

// ==================== HANDLER PRINCIPAL ====================

Deno.serve(async (req: Request) => {
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

    // ═══════════════════════════════════════════════════════════════════
    // 💳 VERIFICAÇÃO DE CRÉDITOS DE IA
    // ═══════════════════════════════════════════════════════════════════
    if (companyId) {
      const creditCheck = await checkCredits(supabase, companyId, 'standard_text', 5000);
      if (!creditCheck.hasCredits) {
        return new Response(JSON.stringify({ 
          error: creditCheck.errorMessage,
          code: 'INSUFFICIENT_CREDITS',
          creditType: 'standard_text',
          currentBalance: creditCheck.currentBalance,
          recommendation: null
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

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
    const recommendation = await consolidateAndGenerateRecommendation(batchResults, data, geminiApiKey, supabase, companyId);

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
