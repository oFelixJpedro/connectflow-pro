import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CriteriaScores {
  comunicacao: number;
  objetividade: number;
  humanizacao: number;
  objecoes: number;
  fechamento: number;
  tempoResposta: number;
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

function getCurrentWeekMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function safeAvg(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || !['owner', 'admin'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Only owners and admins can generate anticipated reports' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyId = profile.company_id;
    const now = new Date();
    const weekStart = getCurrentWeekMonday();
    const weekEnd = now;

    console.log(`Generating anticipated report for company ${companyId}`);
    console.log(`Period: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Check if an anticipated report already exists for this week
    const { data: existingReport } = await supabase
      .from('commercial_reports')
      .select('id, is_anticipated')
      .eq('company_id', companyId)
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .eq('is_anticipated', true)
      .maybeSingle();

    if (existingReport) {
      return new Response(JSON.stringify({ 
        error: 'Você já gerou um relatório antecipado esta semana',
        already_generated: true 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch conversations for the current week
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
      .eq('company_id', companyId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    if (convError) {
      throw new Error(`Failed to fetch conversations: ${convError.message}`);
    }

    console.log(`Found ${conversations?.length || 0} conversations`);

    if (!conversations || conversations.length === 0) {
      const { error: insertError } = await supabase.from('commercial_reports').insert({
        company_id: companyId,
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
        is_anticipated: true,
        anticipated_at: now.toISOString(),
        anticipated_by: user.id,
      });

      if (insertError) {
        throw new Error(`Failed to create report: ${insertError.message}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Relatório antecipado gerado (sem dados)',
        total_conversations: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conversationIds = conversations.map(c => c.id);

    // ========================================
    // FETCH EXISTING EVALUATIONS FROM DATABASE
    // ========================================
    const { data: existingEvaluations, error: evalError } = await supabase
      .from('conversation_evaluations')
      .select('*')
      .in('conversation_id', conversationIds);

    if (evalError) {
      console.error('Error fetching existing evaluations:', evalError);
    }

    console.log(`Found ${existingEvaluations?.length || 0} existing evaluations for ${conversationIds.length} conversations`);

    // Create a map of conversation_id -> evaluation for quick lookup
    const evaluationMap = new Map<string, any>();
    if (existingEvaluations) {
      for (const eval_ of existingEvaluations) {
        evaluationMap.set(eval_.conversation_id, eval_);
      }
    }

    // Calculate metrics from existing evaluations
    const evaluationsWithScores = existingEvaluations?.filter(e => e.overall_score != null) || [];
    
    const avgScore = safeAvg(evaluationsWithScores.map(e => e.overall_score));
    
    const avgCriteria: CriteriaScores = {
      comunicacao: safeAvg(evaluationsWithScores.map(e => e.communication_score)),
      objetividade: safeAvg(evaluationsWithScores.map(e => e.objectivity_score)),
      humanizacao: safeAvg(evaluationsWithScores.map(e => e.humanization_score)),
      objecoes: safeAvg(evaluationsWithScores.map(e => e.objection_handling_score)),
      fechamento: safeAvg(evaluationsWithScores.map(e => e.closing_score)),
      tempoResposta: safeAvg(evaluationsWithScores.map(e => e.response_time_score)),
    };

    // Count qualified leads from existing evaluations
    const hotLeads = evaluationsWithScores.filter(e => e.lead_qualification === 'hot').length;
    const warmLeads = evaluationsWithScores.filter(e => e.lead_qualification === 'warm').length;
    const closedDeals = conversations.filter(c => c.status === 'closed').length;

    console.log(`Metrics calculated from existing evaluations:`);
    console.log(`- Average score: ${avgScore.toFixed(2)}`);
    console.log(`- Hot leads: ${hotLeads}, Warm leads: ${warmLeads}`);
    console.log(`- Closed deals: ${closedDeals}`);

    // Get agent names for agent analysis
    const assignedUserIds = [...new Set(conversations.filter(c => c.assigned_user_id).map(c => c.assigned_user_id!))];
    
    const { data: agentProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', assignedUserIds);

    const agentNameMap = new Map<string, string>();
    if (agentProfiles) {
      for (const profile of agentProfiles) {
        agentNameMap.set(profile.id, profile.full_name || 'Agente');
      }
    }

    // Calculate geographic distribution
    const contactsByState: Record<string, number> = {};
    const dealsByState: Record<string, number> = {};

    for (const conv of conversations) {
      const contact = conv.contact as any;
      const state = getStateFromPhone(contact?.phone_number || '');
      if (state) {
        contactsByState[state] = (contactsByState[state] || 0) + 1;
        if (conv.status === 'closed') {
          dealsByState[state] = (dealsByState[state] || 0) + 1;
        }
      }
    }

    // Agent performance analysis using existing evaluations
    const agentStats: Record<string, { total: number; scores: number[]; name: string }> = {};
    
    for (const conv of conversations) {
      if (conv.assigned_user_id) {
        if (!agentStats[conv.assigned_user_id]) {
          agentStats[conv.assigned_user_id] = {
            total: 0,
            scores: [],
            name: agentNameMap.get(conv.assigned_user_id) || 'Agente',
          };
        }
        agentStats[conv.assigned_user_id].total++;
        
        // Get score from existing evaluation
        const evaluation = evaluationMap.get(conv.id);
        if (evaluation?.overall_score != null) {
          agentStats[conv.assigned_user_id].scores.push(evaluation.overall_score);
        }
      }
    }

    const agentsAnalysis = Object.entries(agentStats).map(([id, stats]) => ({
      agent_id: id,
      agent_name: stats.name,
      total_conversations: stats.total,
      average_score: safeAvg(stats.scores),
    }));

    // Generate insights using Gemini (only if we have data)
    let reportInsights = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      positive_patterns: [] as string[],
      negative_patterns: [] as string[],
      critical_issues: [] as string[],
      insights: [] as string[],
      final_recommendation: '',
    };

    if (avgScore > 0) {
      const insightsPrompt = `Baseado nas seguintes métricas de atendimento comercial, gere insights e recomendações:

Score médio: ${avgScore.toFixed(1)}/10
Classificação: ${getClassification(avgScore)}
Total de conversas: ${conversations.length}
Conversas avaliadas: ${evaluationsWithScores.length}
Leads qualificados (hot/warm): ${hotLeads + warmLeads}
Negócios fechados: ${closedDeals}
Taxa de conversão: ${conversations.length > 0 ? ((closedDeals / conversations.length) * 100).toFixed(1) : 0}%

Scores por critério:
- Comunicação: ${avgCriteria.comunicacao.toFixed(1)}
- Objetividade: ${avgCriteria.objetividade.toFixed(1)}
- Humanização: ${avgCriteria.humanizacao.toFixed(1)}
- Objeções: ${avgCriteria.objecoes.toFixed(1)}
- Fechamento: ${avgCriteria.fechamento.toFixed(1)}
- Tempo de Resposta: ${avgCriteria.tempoResposta.toFixed(1)}

IMPORTANTE: Este é um relatório ANTECIPADO com dados PARCIAIS da semana (até o momento atual).

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

      try {
        const insightsResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
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
    } else {
      // No evaluations yet - provide default message
      reportInsights.insights = ['Ainda não há avaliações suficientes para gerar insights detalhados.'];
      reportInsights.final_recommendation = 'Continue usando o sistema para acumular dados de avaliação.';
    }

    // Create the anticipated commercial report
    const { error: insertError } = await supabase.from('commercial_reports').insert({
      company_id: companyId,
      report_date: now.toISOString().split('T')[0],
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      average_score: avgScore,
      classification: getClassification(avgScore),
      criteria_scores: avgCriteria,
      total_conversations: conversations.length,
      total_leads: conversations.length,
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
      is_anticipated: true,
      anticipated_at: now.toISOString(),
      anticipated_by: user.id,
    });

    if (insertError) {
      throw new Error(`Failed to create report: ${insertError.message}`);
    }

    console.log(`Anticipated report created successfully for company ${companyId}`);
    console.log(`Final metrics: avgScore=${avgScore.toFixed(2)}, qualified=${hotLeads + warmLeads}, closed=${closedDeals}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Relatório antecipado gerado com sucesso!',
      total_conversations: conversations.length,
      evaluated_conversations: evaluationsWithScores.length,
      average_score: avgScore.toFixed(1),
      classification: getClassification(avgScore),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating anticipated report:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
