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

    // Get authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the user from the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile and verify they're admin/owner
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
    const weekEnd = now; // Current moment (partial week)

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

    // Fetch conversations for the current week with messages
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
      // Create empty anticipated report
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
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', conv.assigned_user_id)
          .single();
        assignedUser = userProfile;
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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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

          // Save individual evaluation
          await supabase.from('conversation_evaluations').insert({
            conversation_id: conv.id,
            company_id: companyId,
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

    // Calculate geographic distribution
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

    // Agent performance analysis
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

    // Generate insights using Gemini
    const insightsPrompt = `Baseado nas seguintes métricas de atendimento comercial, gere insights e recomendações:

Score médio: ${avgScore.toFixed(1)}/10
Classificação: ${getClassification(avgScore)}
Total de conversas: ${conversations.length}
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Relatório antecipado gerado com sucesso!',
      total_conversations: conversations.length,
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
