import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: AgentRecommendationRequest = await req.json();
    
    console.log('[generate-agent-recommendation] Generating for:', data.agentName);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
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

## INSTRUÇÕES

Gere uma recomendação personalizada que:
1. **Cite dados específicos** (ex: "sua taxa de conversão de X% está Y% abaixo/acima da média esperada")
2. **Identifique 2-3 ações concretas** com prazos realistas (ex: "nas próximas 2 semanas, foque em...")
3. **Sugira métricas de acompanhamento** específicas
4. **Use tom construtivo e motivador**, mas seja direto sobre problemas críticos
5. **Considere o nível do atendente** (junior precisa mais orientação, senior mais autonomia)

Se houver alertas críticos, comece abordando-os. Se a performance estiver declinando, seja mais direto sobre a urgência.

**Formato:** 3-4 parágrafos, máximo 250 palavras, em português brasileiro.
**IMPORTANTE:** Não use bullet points, escreva em texto corrido e fluido.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um consultor de gestão de vendas experiente. Suas recomendações são sempre específicas, acionáveis e baseadas em dados. Você nunca dá conselhos genéricos.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-agent-recommendation] OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const recommendation = result.choices[0]?.message?.content?.trim() || '';

    console.log('[generate-agent-recommendation] Generated recommendation length:', recommendation.length);

    return new Response(JSON.stringify({ recommendation }), {
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
