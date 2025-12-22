import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationData {
  id: string;
  contact_id: string;
  assigned_user_id: string | null;
  status: string;
  created_at: string;
  messages: Array<{
    content: string;
    direction: string;
    created_at: string;
    sender_type: string;
  }>;
  contact: {
    phone_number: string;
    name: string | null;
  };
  assignedUser: {
    full_name: string;
  } | null;
}

interface CriteriaScores {
  comunicacao: number;
  objetividade: number;
  humanizacao: number;
  objecoes: number;
  fechamento: number;
  tempoResposta: number;
}

interface EvaluationResult {
  overall_score: number;
  criteria_scores: CriteriaScores;
  strengths: string[];
  improvements: string[];
  lead_qualification: string;
  lead_interest_level: number;
  ai_summary: string;
}

interface MediaStatistics {
  total_analyzed: number;
  by_type: {
    image: number;
    video: number;
    document: number;
    audio: number;
  };
  cache_hits: number;
  cache_efficiency_percent: number;
  top_media_types: string[];
}

const DDD_TO_STATE: Record<string, string> = {
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  '61': 'DF',
  '62': 'GO', '64': 'GO',
  '63': 'TO',
  '65': 'MT', '66': 'MT',
  '67': 'MS',
  '68': 'AC',
  '69': 'RO',
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  '98': 'MA', '99': 'MA',
};

function getStateFromPhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');
  const withoutCountry = cleaned.startsWith('55') ? cleaned.slice(2) : cleaned;
  const ddd = withoutCountry.slice(0, 2);
  return DDD_TO_STATE[ddd] || null;
}

function getClassification(score: number): string {
  if (score >= 9) return 'EXCEPCIONAL';
  if (score >= 7.5) return 'BOM';
  if (score >= 5) return 'REGULAR';
  if (score >= 3) return 'RUIM';
  return 'CRÍTICO';
}

async function getMediaStatistics(
  supabase: any,
  companyId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<MediaStatistics> {
  try {
    const { data: mediaCache, error } = await supabase
      .from('media_analysis_cache')
      .select('media_type, hit_count, created_at')
      .eq('company_id', companyId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    if (error || !mediaCache || mediaCache.length === 0) {
      console.log('No media cache data found for period');
      return {
        total_analyzed: 0,
        by_type: { image: 0, video: 0, document: 0, audio: 0 },
        cache_hits: 0,
        cache_efficiency_percent: 0,
        top_media_types: []
      };
    }

    const byType: Record<string, number> = { image: 0, video: 0, document: 0, audio: 0 };
    let totalHits = 0;

    for (const item of mediaCache) {
      const mediaType = item.media_type?.toLowerCase() || 'unknown';
      if (mediaType in byType) {
        byType[mediaType]++;
      }
      totalHits += item.hit_count || 0;
    }

    const total = mediaCache.length;
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, v]) => v > 0)
      .slice(0, 3)
      .map(([k]) => k);

    const efficiency = total > 0 ? Math.round((totalHits / (total + totalHits)) * 100) : 0;

    console.log(`Media stats: ${total} items, ${totalHits} cache hits, ${efficiency}% efficiency`);

    return {
      total_analyzed: total,
      by_type: byType as { image: number; video: number; document: number; audio: number },
      cache_hits: totalHits,
      cache_efficiency_percent: efficiency,
      top_media_types: topTypes
    };
  } catch (error) {
    console.error('Error fetching media statistics:', error);
    return {
      total_analyzed: 0,
      by_type: { image: 0, video: 0, document: 0, audio: 0 },
      cache_hits: 0,
      cache_efficiency_percent: 0,
      top_media_types: []
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate week range (last Monday to last Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - (dayOfWeek === 0 ? 0 : dayOfWeek));
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    console.log(`Generating reports for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Get all active companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('active', true);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    console.log(`Found ${companies?.length || 0} active companies`);

    const results: Array<{ companyId: string; success: boolean; error?: string }> = [];

    for (const company of companies || []) {
      try {
        console.log(`Processing company: ${company.name} (${company.id})`);

        // Check if report already exists for this week
        const { data: existingReport } = await supabase
          .from('commercial_reports')
          .select('id, is_anticipated')
          .eq('company_id', company.id)
          .eq('week_start', weekStart.toISOString().split('T')[0])
          .maybeSingle();

        if (existingReport) {
          console.log(`Report already exists for company ${company.id}`);
          results.push({ companyId: company.id, success: true });
          continue;
        }

        // Fetch conversations for the week
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select(`
            id,
            contact_id,
            assigned_user_id,
            status,
            created_at,
            contact:contacts(phone_number, name)
          `)
          .eq('company_id', company.id)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        if (convError) {
          throw new Error(`Failed to fetch conversations: ${convError.message}`);
        }

        console.log(`Found ${conversations?.length || 0} conversations`);

        // Fetch media statistics for the week
        console.log('Fetching media statistics...');
        const mediaStats = await getMediaStatistics(supabase, company.id, weekStart, weekEnd);
        console.log('Media stats:', JSON.stringify(mediaStats));

        if (!conversations || conversations.length === 0) {
          // Create empty report with media stats
          await supabase.from('commercial_reports').insert({
            company_id: company.id,
            report_date: now.toISOString().split('T')[0],
            week_start: weekStart.toISOString().split('T')[0],
            week_end: weekEnd.toISOString().split('T')[0],
            average_score: 0,
            classification: 'SEM_DADOS',
            total_conversations: 0,
            total_leads: 0,
            qualified_leads: 0,
            closed_deals: 0,
            conversion_rate: 0,
            media_statistics: mediaStats,
          });

          results.push({ companyId: company.id, success: true });
          continue;
        }

        // Fetch messages for each conversation
        const conversationsWithMessages: ConversationData[] = [];
        for (const conv of conversations) {
          const { data: messages } = await supabase
            .from('messages')
            .select('content, direction, created_at, sender_type')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })
            .limit(50);

          let assignedUser = null;
          if (conv.assigned_user_id) {
            const { data: user } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', conv.assigned_user_id)
              .single();
            assignedUser = user;
          }

          conversationsWithMessages.push({
            ...conv,
            messages: messages || [],
            contact: conv.contact as any,
            assignedUser,
          });
        }

        // Evaluate conversations using Gemini
        const evaluations: EvaluationResult[] = [];
        
        for (const conv of conversationsWithMessages) {
          if (conv.messages.length < 3) continue;

          const conversationText = conv.messages
            .map(m => `[${m.direction === 'inbound' ? 'Cliente' : 'Atendente'}]: ${m.content || '[mídia]'}`)
            .join('\n');

          const evaluationPrompt = `Você é um especialista em análise de qualidade de atendimento comercial.

Analise esta conversa de WhatsApp e avalie a qualidade do atendimento comercial.

CONVERSA:
${conversationText}

Responda APENAS em JSON válido com esta estrutura exata:
{
  "overall_score": 7.5,
  "criteria_scores": {
    "comunicacao": 8,
    "objetividade": 7,
    "humanizacao": 8,
    "objecoes": 6,
    "fechamento": 7,
    "tempoResposta": 8
  },
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvements": ["melhoria 1", "melhoria 2"],
  "lead_qualification": "hot",
  "lead_interest_level": 4,
  "ai_summary": "Resumo breve da conversa e qualidade do atendimento"
}

Critérios de pontuação (0-10):
- comunicacao: Clareza e qualidade da comunicação
- objetividade: Foco nos objetivos comerciais
- humanizacao: Tratamento personalizado e empático
- objecoes: Capacidade de lidar com objeções
- fechamento: Técnicas de fechamento de venda
- tempoResposta: Agilidade nas respostas

lead_qualification: "hot" (muito interessado), "warm" (interessado), "cold" (pouco interesse), "disqualified" (desqualificado)
lead_interest_level: 1-5 (1 = nenhum interesse, 5 = muito interessado)`;

          try {
            const geminiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: evaluationPrompt }] }],
                  generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                  },
                }),
              }
            );

            if (!geminiResponse.ok) {
              console.error(`Gemini API error for conversation ${conv.id}`);
              continue;
            }

            const geminiData = await geminiResponse.json();
            const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const evaluation = JSON.parse(jsonMatch[0]) as EvaluationResult;
              evaluations.push(evaluation);

              await supabase.from('conversation_evaluations').insert({
                conversation_id: conv.id,
                company_id: company.id,
                overall_score: evaluation.overall_score,
                communication_score: evaluation.criteria_scores.comunicacao,
                objectivity_score: evaluation.criteria_scores.objetividade,
                humanization_score: evaluation.criteria_scores.humanizacao,
                objection_handling_score: evaluation.criteria_scores.objecoes,
                closing_score: evaluation.criteria_scores.fechamento,
                response_time_score: evaluation.criteria_scores.tempoResposta,
                lead_qualification: evaluation.lead_qualification,
                lead_interest_level: evaluation.lead_interest_level,
                strengths: evaluation.strengths,
                improvements: evaluation.improvements,
                ai_summary: evaluation.ai_summary,
              });
            }
          } catch (evalError) {
            console.error(`Error evaluating conversation ${conv.id}:`, evalError);
          }
        }

        // Calculate aggregate metrics
        const avgScore = evaluations.length > 0
          ? evaluations.reduce((sum, e) => sum + e.overall_score, 0) / evaluations.length
          : 0;

        const avgCriteria: CriteriaScores = {
          comunicacao: 0,
          objetividade: 0,
          humanizacao: 0,
          objecoes: 0,
          fechamento: 0,
          tempoResposta: 0,
        };

        if (evaluations.length > 0) {
          for (const e of evaluations) {
            avgCriteria.comunicacao += e.criteria_scores.comunicacao;
            avgCriteria.objetividade += e.criteria_scores.objetividade;
            avgCriteria.humanizacao += e.criteria_scores.humanizacao;
            avgCriteria.objecoes += e.criteria_scores.objecoes;
            avgCriteria.fechamento += e.criteria_scores.fechamento;
            avgCriteria.tempoResposta += e.criteria_scores.tempoResposta;
          }
          const count = evaluations.length;
          avgCriteria.comunicacao /= count;
          avgCriteria.objetividade /= count;
          avgCriteria.humanizacao /= count;
          avgCriteria.objecoes /= count;
          avgCriteria.fechamento /= count;
          avgCriteria.tempoResposta /= count;
        }

        const hotLeads = evaluations.filter(e => e.lead_qualification === 'hot').length;
        const warmLeads = evaluations.filter(e => e.lead_qualification === 'warm').length;
        const closedDeals = conversationsWithMessages.filter(c => c.status === 'closed').length;

        // Geographic distribution
        const contactsByState: Record<string, number> = {};
        const dealsByState: Record<string, number> = {};

        for (const conv of conversationsWithMessages) {
          const state = getStateFromPhone(conv.contact?.phone_number || '');
          if (state) {
            contactsByState[state] = (contactsByState[state] || 0) + 1;
            if (conv.status === 'closed') {
              dealsByState[state] = (dealsByState[state] || 0) + 1;
            }
          }
        }

        // Agent performance
        const agentStats: Record<string, { total: number; score: number; name: string }> = {};
        for (const conv of conversationsWithMessages) {
          if (conv.assigned_user_id && conv.assignedUser) {
            if (!agentStats[conv.assigned_user_id]) {
              agentStats[conv.assigned_user_id] = {
                total: 0,
                score: 0,
                name: conv.assignedUser.full_name,
              };
            }
            agentStats[conv.assigned_user_id].total++;
          }
        }

        for (let i = 0; i < conversationsWithMessages.length; i++) {
          const conv = conversationsWithMessages[i];
          const evaluation = evaluations[i];
          if (conv.assigned_user_id && evaluation) {
            agentStats[conv.assigned_user_id].score += evaluation.overall_score;
          }
        }

        const agentsAnalysis = Object.entries(agentStats).map(([id, stats]) => ({
          agent_id: id,
          agent_name: stats.name,
          total_conversations: stats.total,
          average_score: stats.total > 0 ? stats.score / stats.total : 0,
        }));

        // Generate insights
        const insightsPrompt = `Baseado nas seguintes métricas de atendimento comercial, gere insights e recomendações:

Score médio: ${avgScore.toFixed(1)}/10
Classificação: ${getClassification(avgScore)}
Total de conversas: ${conversations.length}
Leads qualificados (hot/warm): ${hotLeads + warmLeads}
Negócios fechados: ${closedDeals}
Taxa de conversão: ${conversations.length > 0 ? ((closedDeals / conversations.length) * 100).toFixed(1) : 0}%

Mídias analisadas: ${mediaStats.total_analyzed}
Cache hits: ${mediaStats.cache_hits} (${mediaStats.cache_efficiency_percent}% eficiência)

Scores por critério:
- Comunicação: ${avgCriteria.comunicacao.toFixed(1)}
- Objetividade: ${avgCriteria.objetividade.toFixed(1)}
- Humanização: ${avgCriteria.humanizacao.toFixed(1)}
- Objeções: ${avgCriteria.objecoes.toFixed(1)}
- Fechamento: ${avgCriteria.fechamento.toFixed(1)}
- Tempo de Resposta: ${avgCriteria.tempoResposta.toFixed(1)}

Responda APENAS em JSON válido:
{
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "weaknesses": ["fraqueza 1", "fraqueza 2"],
  "positive_patterns": ["padrão positivo 1"],
  "negative_patterns": ["padrão negativo 1"],
  "critical_issues": ["problema crítico 1"] ou [],
  "insights": ["insight 1", "insight 2", "insight 3"],
  "final_recommendation": "Recomendação principal para melhoria"
}`;

        let reportInsights = {
          strengths: [] as string[],
          weaknesses: [] as string[],
          positive_patterns: [] as string[],
          negative_patterns: [] as string[],
          critical_issues: [] as string[],
          insights: [] as string[],
          final_recommendation: '',
        };

        try {
          const insightsResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: insightsPrompt }] }],
                generationConfig: {
                  temperature: 0.4,
                  maxOutputTokens: 1024,
                },
              }),
            }
          );

          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json();
            const insightsText = insightsData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = insightsText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              reportInsights = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (insightsError) {
          console.error('Error generating insights:', insightsError);
        }

        // Create the commercial report with media statistics
        const { error: insertError } = await supabase.from('commercial_reports').insert({
          company_id: company.id,
          report_date: now.toISOString().split('T')[0],
          week_start: weekStart.toISOString().split('T')[0],
          week_end: weekEnd.toISOString().split('T')[0],
          average_score: avgScore,
          classification: getClassification(avgScore),
          criteria_scores: avgCriteria,
          total_conversations: conversations.length,
          total_leads: conversationsWithMessages.length,
          qualified_leads: hotLeads + warmLeads,
          closed_deals: closedDeals,
          conversion_rate: conversations.length > 0 ? (closedDeals / conversations.length) * 100 : 0,
          contacts_by_state: contactsByState,
          deals_by_state: dealsByState,
          agents_analysis: agentsAnalysis,
          strengths: reportInsights.strengths,
          weaknesses: reportInsights.weaknesses,
          positive_patterns: reportInsights.positive_patterns,
          negative_patterns: reportInsights.negative_patterns,
          critical_issues: reportInsights.critical_issues,
          insights: reportInsights.insights,
          final_recommendation: reportInsights.final_recommendation,
          media_statistics: mediaStats,
        });

        if (insertError) {
          throw new Error(`Failed to insert report: ${insertError.message}`);
        }

        console.log(`Report created successfully for company ${company.id}`);
        results.push({ companyId: company.id, success: true });

      } catch (companyError) {
        console.error(`Error processing company ${company.id}:`, companyError);
        results.push({
          companyId: company.id,
          success: false,
          error: companyError instanceof Error ? companyError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating weekly reports:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
