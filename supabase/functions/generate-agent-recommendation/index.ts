import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MediaSample {
  url: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
  direction: 'inbound' | 'outbound';
  messageContent?: string;
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
  mediaSamples?: MediaSample[];
}

// ==================== FUNÇÕES AUXILIARES PARA MÍDIA ====================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log('[generate-agent-recommendation] 🖼️ Fetching image:', imageUrl.substring(0, 50));
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('[generate-agent-recommendation] ❌ Failed to fetch image:', response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    
    return { data: base64, mimeType };
  } catch (error) {
    console.error('[generate-agent-recommendation] ❌ Error fetching image:', error);
    return null;
  }
}

async function fetchVideoAsBase64(videoUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log('[generate-agent-recommendation] 🎬 Fetching video:', videoUrl.substring(0, 50));
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error('[generate-agent-recommendation] ❌ Failed to fetch video:', response.status);
      return null;
    }
    
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Limite de 20MB para vídeos
    if (size > 20 * 1024 * 1024) {
      console.log('[generate-agent-recommendation] ⚠️ Video too large, skipping:', size);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const mimeType = response.headers.get('content-type') || 'video/mp4';
    
    return { data: base64, mimeType };
  } catch (error) {
    console.error('[generate-agent-recommendation] ❌ Error fetching video:', error);
    return null;
  }
}

const SUPPORTED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
  'text/html',
];

async function fetchDocumentAsBase64(docUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    console.log('[generate-agent-recommendation] 📄 Fetching document:', docUrl.substring(0, 50));
    
    const response = await fetch(docUrl);
    if (!response.ok) {
      console.error('[generate-agent-recommendation] ❌ Failed to fetch document:', response.status);
      return null;
    }
    
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Limite de 20MB para documentos
    if (size > 20 * 1024 * 1024) {
      console.log('[generate-agent-recommendation] ⚠️ Document too large, skipping:', size);
      return null;
    }
    
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Verificar se o MIME type é suportado
    const isSupported = SUPPORTED_DOCUMENT_MIMES.some(m => mimeType.includes(m.split('/')[1]));
    if (!isSupported) {
      console.log('[generate-agent-recommendation] ⚠️ Unsupported document type:', mimeType);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    
    return { data: base64, mimeType };
  } catch (error) {
    console.error('[generate-agent-recommendation] ❌ Error fetching document:', error);
    return null;
  }
}

// ==================== FIM FUNÇÕES DE MÍDIA ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: AgentRecommendationRequest = await req.json();
    
    console.log('[generate-agent-recommendation] Generating for:', data.agentName);
    console.log('[generate-agent-recommendation] Media samples received:', data.mediaSamples?.length || 0);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Build a detailed prompt with all agent data
    const criteriaLabels: Record<string, string> = {
      communication: 'Comunicação',
      objectivity: 'Objetividade',
      humanization: 'Humanização',
      objection_handling: 'Tratamento de Objeções',
      closing: 'Fechamento',
      response_time: 'Tempo de Resposta',
    };

    const criteriaDetails = Object.entries(data.criteriaScores)
      .map(([key, value]) => `- ${criteriaLabels[key]}: ${value.toFixed(1)}/10`)
      .join('\n');

    const levelLabel = data.level === 'junior' ? 'Junior' : data.level === 'pleno' ? 'Pleno' : 'Senior';
    
    const performanceLabel = data.recentPerformance === 'improving' 
      ? 'melhorando' 
      : data.recentPerformance === 'declining' 
        ? 'declinando' 
        : 'estável';

    // Process media samples (max 5 for performance)
    const mediaSamples = (data.mediaSamples || []).slice(0, 5);
    const parts: any[] = [];
    const audioTranscriptions: string[] = [];
    let mediaAnalysisCount = { images: 0, videos: 0, documents: 0, audios: 0 };

    for (const media of mediaSamples) {
      try {
        if (media.type === 'image') {
          const imageData = await fetchImageAsBase64(media.url);
          if (imageData) {
            parts.push({
              inline_data: {
                mime_type: imageData.mimeType,
                data: imageData.data
              }
            });
            mediaAnalysisCount.images++;
          }
        } else if (media.type === 'video') {
          const videoData = await fetchVideoAsBase64(media.url);
          if (videoData) {
            parts.push({
              inline_data: {
                mime_type: videoData.mimeType,
                data: videoData.data
              }
            });
            mediaAnalysisCount.videos++;
          }
        } else if (media.type === 'document') {
          const docData = await fetchDocumentAsBase64(media.url);
          if (docData) {
            parts.push({
              inline_data: {
                mime_type: docData.mimeType,
                data: docData.data
              }
            });
            mediaAnalysisCount.documents++;
          }
        } else if (media.type === 'audio') {
          const transcription = await transcribeAudio(media.url, geminiApiKey);
          if (transcription) {
            audioTranscriptions.push(`[Áudio enviado pelo vendedor]: ${transcription}`);
            mediaAnalysisCount.audios++;
          }
        }
      } catch (error) {
        console.error('[generate-agent-recommendation] Error processing media:', error);
      }
    }

    console.log('[generate-agent-recommendation] Media processed:', mediaAnalysisCount);

    // Build media analysis section for prompt
    let mediaAnalysisPrompt = '';
    const totalMedia = mediaAnalysisCount.images + mediaAnalysisCount.videos + mediaAnalysisCount.documents + mediaAnalysisCount.audios;
    
    if (totalMedia > 0) {
      mediaAnalysisPrompt = `

## ANÁLISE DE MÍDIAS ENVIADAS PELO VENDEDOR

Você está recebendo ${totalMedia} arquivo(s) de mídia que o vendedor enviou aos clientes:
- ${mediaAnalysisCount.images} imagem(ns)
- ${mediaAnalysisCount.videos} vídeo(s)
- ${mediaAnalysisCount.documents} documento(s)
- ${mediaAnalysisCount.audios} áudio(s) transcritos

${audioTranscriptions.length > 0 ? `### Transcrições de Áudios:\n${audioTranscriptions.join('\n\n')}` : ''}

**INSTRUÇÕES CRÍTICAS PARA ANÁLISE DE MÍDIA:**

1. **DESCREVA** cada imagem/vídeo/documento que você vê. O que exatamente está sendo mostrado?

2. **AVALIE** se o conteúdo faz sentido em um contexto comercial de vendas:
   - O material é profissional e relevante para a venda?
   - Está alinhado com o que se espera de um vendedor?
   - A qualidade visual/documental é adequada?

3. **IDENTIFIQUE PROBLEMAS** como:
   - Conteúdo completamente irrelevante (fotos pessoais, memes, imagens aleatórias)
   - Material inapropriado, ofensivo ou inadequado
   - Documentos com erros graves ou informações incorretas
   - Imagens de baixa qualidade que prejudicam a apresentação
   - Qualquer sinal de sabotagem ou má-fé (enviar propositalmente coisas sem sentido)
   - Conteúdo agressivo, grosseiro ou que possa afastar o cliente

4. **CITE ESPECIFICAMENTE** na sua recomendação:
   - Se encontrar problemas: "Nas mídias analisadas, foi identificado [descreva o problema específico]..."
   - Se estiver tudo ok: "O material visual/documental enviado está adequado e profissional..."
`;
    }

    const prompt = `Você é um consultor especialista em gestão de equipes de vendas e atendimento ao cliente. Analise os dados deste atendente e gere uma recomendação ESPECÍFICA, ACIONÁVEL e DETALHADA.

## DADOS DO ATENDENTE

**Nome:** ${data.agentName}
**Nível:** ${levelLabel}
**Score Geral:** ${data.overallScore.toFixed(1)}/10
**Performance Recente:** ${performanceLabel}

### Métricas de Conversão
- Total de Conversas: ${data.totalConversations}
- Negócios Fechados: ${data.closedDeals}
- Negócios Perdidos: ${data.lostDeals}
- Taxa de Conversão: ${data.conversionRate.toFixed(1)}%
- Tempo Médio de Resposta: ${data.avgResponseTime.toFixed(0)} minutos

### Scores por Critério (escala 0-10)
${criteriaDetails}

### Pontos Fortes Identificados
${data.strengths.length > 0 ? data.strengths.map(s => `- ${s}`).join('\n') : '- Nenhum ponto forte destacado ainda'}

### Pontos de Melhoria
${data.weaknesses.length > 0 ? data.weaknesses.map(w => `- ${w}`).join('\n') : '- Nenhuma melhoria específica identificada'}

### Alertas Comportamentais
- Total de Alertas: ${data.alertsCount}
- Alertas Críticos/Altos: ${data.criticalAlertsCount}
${data.alertTypes.length > 0 ? `- Tipos: ${data.alertTypes.join(', ')}` : ''}
${mediaAnalysisPrompt}

## INSTRUÇÕES

Gere uma recomendação personalizada que:
1. **Cite dados específicos** (ex: "sua taxa de conversão de X% está Y% abaixo/acima da média esperada")
2. **Identifique 2-3 ações concretas** com prazos realistas (ex: "nas próximas 2 semanas, foque em...")
3. **Sugira métricas de acompanhamento** específicas
4. **Use tom construtivo e motivador**, mas seja direto sobre problemas críticos
5. **Considere o nível do atendente** (junior precisa mais orientação, senior mais autonomia)
${totalMedia > 0 ? '6. **INCLUA análise das mídias** - comente especificamente o que viu nas imagens/vídeos/documentos' : ''}

Se houver alertas críticos, comece abordando-os. Se a performance estiver declinando, seja mais direto sobre a urgência.
${totalMedia > 0 ? 'Se encontrar conteúdo problemático nas mídias, isso deve ser tratado como prioridade na recomendação.' : ''}

**Formato:** 3-4 parágrafos, MÍNIMO 200 palavras e MÁXIMO 400 palavras, em português brasileiro.
**IMPORTANTE:** Não use bullet points, escreva em texto corrido e fluido. Complete todos os parágrafos integralmente.`;

    const systemPrompt = 'Você é um consultor de gestão de vendas experiente. Suas recomendações são sempre específicas, acionáveis e baseadas em dados. Você nunca dá conselhos genéricos. Sempre complete sua resposta integralmente. Se receber imagens, vídeos ou documentos, analise-os detalhadamente e inclua suas observações na recomendação.';

    // Add the prompt text to parts
    parts.push({ text: `${systemPrompt}\n\n${prompt}` });

    console.log('[generate-agent-recommendation] Calling Gemini API with', parts.length, 'parts (multimodal:', totalMedia > 0, ')');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-agent-recommendation] Gemini error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Detailed logging for debugging
    const candidate = result.candidates?.[0];
    const finishReason = candidate?.finishReason;
    console.log('[generate-agent-recommendation] Finish reason:', finishReason);
    console.log('[generate-agent-recommendation] Full response preview:', JSON.stringify(result).substring(0, 500));
    
    // Warn if response didn't finish normally
    if (finishReason && finishReason !== 'STOP') {
      console.warn('[generate-agent-recommendation] Unexpected finish reason:', finishReason);
    }
    
    const recommendation = candidate?.content?.parts?.[0]?.text?.trim() || '';

    console.log('[generate-agent-recommendation] Generated recommendation length:', recommendation.length);
    console.log('[generate-agent-recommendation] Recommendation preview:', recommendation.substring(0, 200));

    return new Response(JSON.stringify({ 
      recommendation,
      mediaAnalyzed: mediaAnalysisCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-agent-recommendation] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: null 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
