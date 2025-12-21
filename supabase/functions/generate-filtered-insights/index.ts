import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface FilteredInsightsResult {
  strengths: string[];
  weaknesses: string[];
  positivePatterns: string[];
  negativePatterns: string[];
  insights: string[];
  criticalIssues: string[];
  finalRecommendation: string;
}

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

    const { evaluations, criteriaScores, filterDescription } = await req.json() as {
      evaluations: EvaluationData[];
      criteriaScores: CriteriaScores;
      filterDescription?: string;
    };

    if (!evaluations || evaluations.length === 0) {
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

    // Prepare evaluations summary for AI
    const evaluationsSummary = evaluations.slice(0, 20).map((e, i) => {
      const parts = [`Conversa ${i + 1}:`];
      if (e.overall_score) parts.push(`Score: ${e.overall_score}/10`);
      if (e.lead_qualification) parts.push(`Lead: ${e.lead_qualification}`);
      if (e.ai_summary) parts.push(`Resumo: ${e.ai_summary.substring(0, 200)}`);
      if (e.strengths?.length) parts.push(`Pontos fortes: ${e.strengths.join(', ')}`);
      if (e.improvements?.length) parts.push(`Melhorias: ${e.improvements.join(', ')}`);
      return parts.join('\n');
    }).join('\n\n---\n\n');

    // Calculate aggregated stats
    const totalEvaluations = evaluations.length;
    const avgScore = evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / totalEvaluations;
    
    const leadCounts = evaluations.reduce((acc, e) => {
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

Analise profundamente estes dados e retorne um JSON com os seguintes campos:

1. **strengths** (array de 3-5 strings): Pontos fortes consolidados identificados nas conversas. Seja específico e baseado nos dados.

2. **weaknesses** (array de 3-5 strings): Pontos fracos ou áreas de melhoria consolidados. Seja específico.

3. **positivePatterns** (array de 3 strings): Padrões comportamentais positivos que você identificou analisando as conversas.

4. **negativePatterns** (array de 3 strings): Padrões comportamentais negativos ou problemáticos identificados.

5. **insights** (array de 3-5 strings): Insights acionáveis e específicos. Não seja genérico. Baseie-se nos dados apresentados.

6. **criticalIssues** (array de 0-3 strings): Problemas críticos que precisam de atenção imediata. Se não houver nenhum, retorne array vazio.

7. **finalRecommendation** (string): Uma recomendação final clara, específica e acionável de 2-4 frases baseada na análise.

Responda APENAS com o JSON válido, sem markdown ou explicações adicionais.`;

    console.log(`[generate-filtered-insights] Analyzing ${totalEvaluations} evaluations with avg score ${avgScore.toFixed(1)}`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
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

    if (!textContent) {
      throw new Error('No content in Gemini response');
    }

    // Parse the JSON response
    let insights: FilteredInsightsResult;
    try {
      // Clean up potential markdown formatting
      let cleanedText = textContent.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      }
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      insights = JSON.parse(cleanedText);
      
      // Validate and provide defaults
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
      console.error('[generate-filtered-insights] Failed to parse AI response:', textContent);
      throw new Error('Failed to parse AI insights response');
    }

    console.log('[generate-filtered-insights] Successfully generated insights:', {
      strengths: insights.strengths.length,
      weaknesses: insights.weaknesses.length,
      positivePatterns: insights.positivePatterns.length,
      insights: insights.insights.length,
    });

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-filtered-insights] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      // Return fallback insights so UI doesn't break
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
