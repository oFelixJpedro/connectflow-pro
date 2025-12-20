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

interface ReportContent {
  executive_summary: string;
  period_overview: string;
  criteria_analysis: Record<string, {
    score: number;
    analysis: string;
    impact: string;
    recommendation: string;
  }>;
  agents_detailed: Array<{
    agent_id: string;
    agent_name: string;
    score: number;
    analysis: string;
    strengths: string[];
    development_areas: string[];
    action_plan: string;
  }>;
  strengths_detailed: Array<{
    title: string;
    description: string;
    evidence: string;
  }>;
  weaknesses_detailed: Array<{
    title: string;
    description: string;
    impact: string;
    recommendation: string;
  }>;
  insights_detailed: Array<{
    insight: string;
    context: string;
    action_suggested: string;
  }>;
  conclusion: string;
  next_steps: string[];
  final_message: string;
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

const CRITERIA_LABELS: Record<string, string> = {
  comunicacao: 'Comunicação',
  objetividade: 'Objetividade',
  humanizacao: 'Humanização',
  objecoes: 'Tratamento de Objeções',
  fechamento: 'Fechamento',
  tempoResposta: 'Tempo de Resposta',
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

function formatDateRange(weekStart: Date, weekEnd: Date): string {
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };
  const start = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  const end = weekEnd.toLocaleDateString('pt-BR', options);
  return `${start} a ${end}`;
}

// ============================================================
// AI CONTENT GENERATION FUNCTIONS
// ============================================================

async function callGemini(geminiApiKey: string, prompt: string, maxTokens = 2048): Promise<string> {
  try {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return '';
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Error calling Gemini:', error);
    return '';
  }
}

async function generateExecutiveSummary(
  geminiApiKey: string,
  data: {
    weekStart: string;
    weekEnd: string;
    totalConversations: number;
    avgScore: number;
    classification: string;
    qualifiedLeads: number;
    closedDeals: number;
    conversionRate: number;
    criteria: CriteriaScores;
    isAnticipated: boolean;
  }
): Promise<{ executive_summary: string; period_overview: string }> {
  const prompt = `Você é um consultor sênior de vendas escrevendo um relatório executivo profissional para uma equipe comercial.

DADOS DO PERÍODO:
- Período: ${data.weekStart} a ${data.weekEnd}
- Total de conversas/atendimentos: ${data.totalConversations}
- Nota média geral: ${data.avgScore.toFixed(1)}/10
- Classificação: ${data.classification}
- Leads qualificados: ${data.qualifiedLeads}
- Vendas/contratos fechados: ${data.closedDeals}
- Taxa de conversão: ${data.conversionRate.toFixed(1)}%
${data.isAnticipated ? '\n⚠️ ATENÇÃO: Este é um relatório ANTECIPADO com dados PARCIAIS da semana (até o momento atual).' : ''}

SCORES POR CRITÉRIO:
- Comunicação: ${data.criteria.comunicacao.toFixed(1)}/10
- Objetividade: ${data.criteria.objetividade.toFixed(1)}/10
- Humanização: ${data.criteria.humanizacao.toFixed(1)}/10
- Tratamento de Objeções: ${data.criteria.objecoes.toFixed(1)}/10
- Fechamento: ${data.criteria.fechamento.toFixed(1)}/10
- Tempo de Resposta: ${data.criteria.tempoResposta.toFixed(1)}/10

TAREFA:
Escreva um SUMÁRIO EXECUTIVO profissional com 2 seções:

1. **executive_summary** (3-4 parágrafos, 200-300 palavras):
   - Visão geral do período analisado
   - Destaque os principais números e o que significam para o negócio
   - Contextualize o desempenho (comparando com benchmarks de mercado)
   - Tendências observadas e implicações

2. **period_overview** (2 parágrafos, 100-150 palavras):
   - Análise do contexto do período
   - Fatores que podem ter influenciado os resultados
   ${data.isAnticipated ? '- Ressalte que os dados são parciais e as conclusões podem mudar até o fim da semana' : ''}

INSTRUÇÕES:
- Tom: Profissional, objetivo, mas acessível
- Use dados para embasar cada afirmação
- Evite jargões técnicos excessivos
- Seja direto e acionável

Responda APENAS em JSON válido:
{
  "executive_summary": "texto do sumário executivo...",
  "period_overview": "texto da visão geral do período..."
}`;

  const result = await callGemini(geminiApiKey, prompt, 2048);
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing executive summary:', e);
  }
  
  return {
    executive_summary: `Durante o período de ${data.weekStart} a ${data.weekEnd}, a equipe comercial realizou ${data.totalConversations} atendimentos, obtendo uma nota média de ${data.avgScore.toFixed(1)}/10, classificada como ${data.classification}. Dos leads atendidos, ${data.qualifiedLeads} foram qualificados como potenciais clientes, resultando em ${data.closedDeals} vendas concluídas.`,
    period_overview: `O período analisado apresentou ${data.totalConversations > 0 ? 'atividade comercial registrada' : 'baixa atividade'} com taxa de conversão de ${data.conversionRate.toFixed(1)}%.`
  };
}

async function generateCriteriaAnalysis(
  geminiApiKey: string,
  criteria: CriteriaScores,
  avgScore: number
): Promise<Record<string, { score: number; analysis: string; impact: string; recommendation: string }>> {
  const criteriaEntries = Object.entries(criteria).map(([key, value]) => 
    `- ${CRITERIA_LABELS[key] || key}: ${value.toFixed(1)}/10`
  ).join('\n');

  const prompt = `Você é um especialista em vendas e atendimento ao cliente analisando métricas de uma equipe comercial.

SCORES POR CRITÉRIO:
${criteriaEntries}

Nota Média Geral: ${avgScore.toFixed(1)}/10

TAREFA:
Para CADA critério, forneça uma análise detalhada com:
1. **analysis**: Explicação do que o score significa na prática (2-3 frases)
2. **impact**: Qual o impacto desse resultado no processo comercial e nos resultados (1-2 frases)
3. **recommendation**: Ação específica e prática para melhorar ou manter o desempenho (1-2 frases)

INSTRUÇÕES:
- Seja específico e acionável
- Use linguagem profissional mas acessível
- Considere scores >= 8 como excelentes, 6-8 como bons, 4-6 como regulares, < 4 como críticos

Responda APENAS em JSON válido:
{
  "comunicacao": {
    "score": ${criteria.comunicacao.toFixed(1)},
    "analysis": "texto...",
    "impact": "texto...",
    "recommendation": "texto..."
  },
  "objetividade": { ... },
  "humanizacao": { ... },
  "objecoes": { ... },
  "fechamento": { ... },
  "tempoResposta": { ... }
}`;

  const result = await callGemini(geminiApiKey, prompt, 3000);
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure all criteria have scores
      Object.keys(criteria).forEach(key => {
        if (parsed[key]) {
          parsed[key].score = criteria[key as keyof CriteriaScores];
        }
      });
      return parsed;
    }
  } catch (e) {
    console.error('Error parsing criteria analysis:', e);
  }
  
  // Fallback
  const fallback: Record<string, { score: number; analysis: string; impact: string; recommendation: string }> = {};
  Object.entries(criteria).forEach(([key, value]) => {
    const label = CRITERIA_LABELS[key] || key;
    fallback[key] = {
      score: value,
      analysis: value >= 7 
        ? `O critério ${label} apresentou bom desempenho com nota ${value.toFixed(1)}.`
        : `O critério ${label} obteve nota ${value.toFixed(1)}, indicando oportunidade de melhoria.`,
      impact: value >= 7
        ? 'Contribui positivamente para a experiência do cliente e resultados comerciais.'
        : 'Pode estar afetando negativamente a conversão e satisfação do cliente.',
      recommendation: value >= 7
        ? 'Manter o padrão atual e compartilhar boas práticas com a equipe.'
        : 'Implementar treinamento focado e acompanhamento regular nesta competência.'
    };
  });
  return fallback;
}

async function generateAgentsAnalysis(
  geminiApiKey: string,
  agents: Array<{ agent_id: string; agent_name: string; total_conversations: number; average_score: number }>,
  avgTeamScore: number
): Promise<Array<{
  agent_id: string;
  agent_name: string;
  score: number;
  analysis: string;
  strengths: string[];
  development_areas: string[];
  action_plan: string;
}>> {
  if (agents.length === 0) return [];

  const agentsInfo = agents.map(a => 
    `- ${a.agent_name}: ${a.average_score.toFixed(1)}/10 (${a.total_conversations} conversas)`
  ).join('\n');

  const prompt = `Você é um gestor comercial analisando a performance individual da sua equipe de vendas.

MÉDIA DA EQUIPE: ${avgTeamScore.toFixed(1)}/10

PERFORMANCE INDIVIDUAL:
${agentsInfo}

TAREFA:
Para cada agente, forneça:
1. **analysis**: Análise geral do desempenho em 2-3 frases
2. **strengths**: Lista de 2-3 pontos fortes observados
3. **development_areas**: Lista de 1-2 áreas para desenvolvimento
4. **action_plan**: Plano de ação específico em 1-2 frases

INSTRUÇÕES:
- Compare cada agente com a média da equipe
- Seja construtivo mesmo em feedbacks negativos
- Sugira ações práticas e específicas

Responda APENAS em JSON válido (array):
[
  {
    "agent_id": "id_do_agente",
    "agent_name": "Nome do Agente",
    "score": 7.5,
    "analysis": "texto...",
    "strengths": ["ponto 1", "ponto 2"],
    "development_areas": ["área 1"],
    "action_plan": "texto..."
  }
]`;

  const result = await callGemini(geminiApiKey, prompt, 3000);
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Merge with original agent data
      return agents.map(agent => {
        const aiData = parsed.find((p: any) => 
          p.agent_name === agent.agent_name || p.agent_id === agent.agent_id
        );
        return {
          agent_id: agent.agent_id,
          agent_name: agent.agent_name,
          score: agent.average_score,
          analysis: aiData?.analysis || `${agent.agent_name} realizou ${agent.total_conversations} atendimentos com média de ${agent.average_score.toFixed(1)}.`,
          strengths: aiData?.strengths || ['Engajamento com leads'],
          development_areas: aiData?.development_areas || ['Melhoria contínua'],
          action_plan: aiData?.action_plan || 'Acompanhamento regular com feedback construtivo.'
        };
      });
    }
  } catch (e) {
    console.error('Error parsing agents analysis:', e);
  }
  
  // Fallback
  return agents.map(agent => ({
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    score: agent.average_score,
    analysis: `${agent.agent_name} realizou ${agent.total_conversations} atendimentos com média de ${agent.average_score.toFixed(1)}/10.`,
    strengths: agent.average_score >= avgTeamScore ? ['Desempenho acima da média da equipe'] : ['Comprometimento com atendimentos'],
    development_areas: agent.average_score < avgTeamScore ? ['Alinhar desempenho com média da equipe'] : ['Manter evolução contínua'],
    action_plan: agent.average_score >= 7 
      ? 'Manter o bom trabalho e compartilhar boas práticas.'
      : 'Agendar sessão de coaching individual para alinhamento.'
  }));
}

async function generateStrengthsWeaknesses(
  geminiApiKey: string,
  data: {
    avgScore: number;
    criteria: CriteriaScores;
    qualifiedLeads: number;
    closedDeals: number;
    totalConversations: number;
  }
): Promise<{
  strengths_detailed: Array<{ title: string; description: string; evidence: string }>;
  weaknesses_detailed: Array<{ title: string; description: string; impact: string; recommendation: string }>;
}> {
  const prompt = `Você é um consultor de vendas analisando os resultados de uma equipe comercial.

MÉTRICAS:
- Nota média: ${data.avgScore.toFixed(1)}/10
- Total de conversas: ${data.totalConversations}
- Leads qualificados: ${data.qualifiedLeads}
- Vendas fechadas: ${data.closedDeals}
- Comunicação: ${data.criteria.comunicacao.toFixed(1)}/10
- Objetividade: ${data.criteria.objetividade.toFixed(1)}/10
- Humanização: ${data.criteria.humanizacao.toFixed(1)}/10
- Tratamento de Objeções: ${data.criteria.objecoes.toFixed(1)}/10
- Fechamento: ${data.criteria.fechamento.toFixed(1)}/10
- Tempo de Resposta: ${data.criteria.tempoResposta.toFixed(1)}/10

TAREFA:
Identifique 3-4 pontos fortes e 2-3 pontos fracos baseados nos dados.

Para cada PONTO FORTE:
- **title**: Título curto (3-5 palavras)
- **description**: Descrição expandida (2-3 frases)
- **evidence**: Evidência dos dados que suporta esta conclusão (1 frase)

Para cada PONTO FRACO:
- **title**: Título curto (3-5 palavras)
- **description**: Descrição do problema (2 frases)
- **impact**: Impacto no negócio (1 frase)
- **recommendation**: Ação corretiva específica (1-2 frases)

Responda APENAS em JSON válido:
{
  "strengths_detailed": [
    { "title": "...", "description": "...", "evidence": "..." }
  ],
  "weaknesses_detailed": [
    { "title": "...", "description": "...", "impact": "...", "recommendation": "..." }
  ]
}`;

  const result = await callGemini(geminiApiKey, prompt, 2500);
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing strengths/weaknesses:', e);
  }
  
  // Fallback based on criteria scores
  const sortedCriteria = Object.entries(data.criteria).sort((a, b) => b[1] - a[1]);
  const strengths = sortedCriteria.slice(0, 2).filter(([, v]) => v >= 5);
  const weaknesses = sortedCriteria.slice(-2).filter(([, v]) => v < 7);

  return {
    strengths_detailed: strengths.length > 0 ? strengths.map(([key, value]) => ({
      title: `Bom desempenho em ${CRITERIA_LABELS[key]}`,
      description: `A equipe demonstrou competência sólida em ${CRITERIA_LABELS[key]}, alcançando nota ${value.toFixed(1)}/10.`,
      evidence: `Score acima da média em avaliações do período.`
    })) : [{
      title: 'Equipe em desenvolvimento',
      description: 'A equipe está construindo suas competências comerciais.',
      evidence: 'Dados disponíveis para análise e melhoria contínua.'
    }],
    weaknesses_detailed: weaknesses.length > 0 ? weaknesses.map(([key, value]) => ({
      title: `Desenvolver ${CRITERIA_LABELS[key]}`,
      description: `O critério ${CRITERIA_LABELS[key]} apresentou nota ${value.toFixed(1)}/10, indicando necessidade de atenção.`,
      impact: 'Pode estar limitando a conversão e satisfação dos leads.',
      recommendation: `Implementar treinamento específico em ${CRITERIA_LABELS[key]}.`
    })) : [{
      title: 'Melhoria contínua necessária',
      description: 'Há oportunidades de aprimoramento em diversos aspectos.',
      impact: 'Maximizar resultados requer desenvolvimento constante.',
      recommendation: 'Estabelecer metas progressivas de melhoria.'
    }]
  };
}

async function generateInsightsAndConclusion(
  geminiApiKey: string,
  data: {
    avgScore: number;
    classification: string;
    totalConversations: number;
    qualifiedLeads: number;
    closedDeals: number;
    conversionRate: number;
    criteria: CriteriaScores;
    isAnticipated: boolean;
  }
): Promise<{
  insights_detailed: Array<{ insight: string; context: string; action_suggested: string }>;
  conclusion: string;
  next_steps: string[];
  final_message: string;
}> {
  const prompt = `Você é um consultor estratégico de vendas gerando insights e recomendações finais.

DADOS DO PERÍODO:
- Nota média: ${data.avgScore.toFixed(1)}/10
- Classificação: ${data.classification}
- Total de conversas: ${data.totalConversations}
- Leads qualificados: ${data.qualifiedLeads}
- Vendas fechadas: ${data.closedDeals}
- Taxa de conversão: ${data.conversionRate.toFixed(1)}%
${data.isAnticipated ? '- ⚠️ Relatório ANTECIPADO (dados parciais da semana)' : ''}

SCORES POR CRITÉRIO:
- Comunicação: ${data.criteria.comunicacao.toFixed(1)}
- Objetividade: ${data.criteria.objetividade.toFixed(1)}
- Humanização: ${data.criteria.humanizacao.toFixed(1)}
- Objeções: ${data.criteria.objecoes.toFixed(1)}
- Fechamento: ${data.criteria.fechamento.toFixed(1)}
- Tempo de Resposta: ${data.criteria.tempoResposta.toFixed(1)}

TAREFA:
Gere:

1. **insights_detailed** (3-4 insights estratégicos):
   - insight: A descoberta/observação
   - context: O contexto que explica esse insight
   - action_suggested: Ação prática sugerida

2. **conclusion** (1-2 parágrafos, 100-150 palavras):
   Conclusão geral do relatório sintetizando os principais pontos

3. **next_steps** (4-5 itens):
   Lista de próximos passos prioritários para a semana seguinte

4. **final_message** (2-3 frases):
   Mensagem motivacional/de fechamento para a equipe

Responda APENAS em JSON válido:
{
  "insights_detailed": [
    { "insight": "...", "context": "...", "action_suggested": "..." }
  ],
  "conclusion": "...",
  "next_steps": ["passo 1", "passo 2", ...],
  "final_message": "..."
}`;

  const result = await callGemini(geminiApiKey, prompt, 2500);
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing insights:', e);
  }
  
  // Fallback
  return {
    insights_detailed: [
      {
        insight: data.avgScore >= 7 ? 'Equipe demonstra competência comercial sólida' : 'Há oportunidades significativas de melhoria',
        context: `A nota média de ${data.avgScore.toFixed(1)}/10 indica ${data.avgScore >= 7 ? 'bom' : 'regular'} desempenho geral.`,
        action_suggested: data.avgScore >= 7 ? 'Manter práticas atuais e documentar casos de sucesso.' : 'Implementar programa de desenvolvimento focado.'
      },
      {
        insight: `Taxa de qualificação de ${data.totalConversations > 0 ? ((data.qualifiedLeads / data.totalConversations) * 100).toFixed(0) : 0}%`,
        context: `De ${data.totalConversations} conversas, ${data.qualifiedLeads} foram qualificadas como leads potenciais.`,
        action_suggested: 'Revisar critérios de qualificação e otimizar scripts de prospecção.'
      }
    ],
    conclusion: `O período analisado resultou em ${data.totalConversations} atendimentos com nota média de ${data.avgScore.toFixed(1)}/10, classificada como ${data.classification}. ${data.closedDeals > 0 ? `Foram concluídas ${data.closedDeals} vendas, ` : ''}demonstrando ${data.avgScore >= 7 ? 'efetividade nas abordagens comerciais' : 'espaço para otimização dos processos de venda'}.`,
    next_steps: [
      'Revisar os atendimentos de maior e menor nota para identificar padrões',
      'Realizar sessão de alinhamento com a equipe sobre os resultados',
      data.avgScore < 7 ? 'Agendar treinamentos específicos para áreas de menor pontuação' : 'Compartilhar melhores práticas identificadas',
      'Definir metas incrementais para o próximo período'
    ],
    final_message: data.avgScore >= 7 
      ? 'Excelente trabalho, equipe! Continuem com o mesmo empenho e busquem sempre a excelência em cada atendimento.'
      : 'Cada atendimento é uma oportunidade de aprendizado e melhoria. Vamos juntos evoluir nossos resultados!'
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

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

    // Initialize default report content
    let reportContent: ReportContent = {
      executive_summary: '',
      period_overview: '',
      criteria_analysis: {},
      agents_detailed: [],
      strengths_detailed: [],
      weaknesses_detailed: [],
      insights_detailed: [],
      conclusion: '',
      next_steps: [],
      final_message: ''
    };

    if (!conversations || conversations.length === 0) {
      // Generate minimal report for no data
      reportContent.executive_summary = 'Durante o período analisado, não foram registradas conversas no sistema. Este relatório será atualizado conforme novos atendimentos forem realizados.';
      reportContent.period_overview = 'Não há dados suficientes para análise detalhada do período.';
      reportContent.conclusion = 'Aguardando mais atendimentos para gerar análises completas.';
      reportContent.next_steps = ['Verificar se há conversas em andamento', 'Conferir integração com canais de atendimento'];
      reportContent.final_message = 'Mantenha o sistema ativo para capturar novos atendimentos.';

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
        report_content: reportContent,
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

    // Fetch existing evaluations
    const { data: existingEvaluations, error: evalError } = await supabase
      .from('conversation_evaluations')
      .select('*')
      .in('conversation_id', conversationIds);

    if (evalError) {
      console.error('Error fetching existing evaluations:', evalError);
    }

    console.log(`Found ${existingEvaluations?.length || 0} existing evaluations`);

    const evaluationMap = new Map<string, any>();
    if (existingEvaluations) {
      for (const eval_ of existingEvaluations) {
        evaluationMap.set(eval_.conversation_id, eval_);
      }
    }

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

    const hotLeads = evaluationsWithScores.filter(e => e.lead_qualification === 'hot').length;
    const warmLeads = evaluationsWithScores.filter(e => e.lead_qualification === 'warm').length;
    const closedDeals = conversations.filter(c => c.status === 'closed').length;
    const conversionRate = conversations.length > 0 ? (closedDeals / conversations.length) * 100 : 0;
    const classification = getClassification(avgScore);

    console.log(`Metrics: avgScore=${avgScore.toFixed(2)}, qualified=${hotLeads + warmLeads}, closed=${closedDeals}`);

    // Get agent profiles
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

    // Agent stats
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
        
        const evaluation = evaluationMap.get(conv.id);
        if (evaluation?.overall_score != null) {
          agentStats[conv.assigned_user_id].scores.push(evaluation.overall_score);
        }
      }
    }

    const agentsBasicAnalysis = Object.entries(agentStats).map(([id, stats]) => ({
      agent_id: id,
      agent_name: stats.name,
      total_conversations: stats.total,
      average_score: safeAvg(stats.scores),
    }));

    // ============================================================
    // GENERATE AI CONTENT FOR EACH SECTION
    // ============================================================
    
    const periodFormatted = formatDateRange(weekStart, weekEnd);

    console.log('Generating AI content for report sections...');

    // 1. Executive Summary
    console.log('Generating executive summary...');
    const executiveSummaryData = await generateExecutiveSummary(geminiApiKey, {
      weekStart: periodFormatted.split(' a ')[0],
      weekEnd: periodFormatted.split(' a ')[1] || periodFormatted,
      totalConversations: conversations.length,
      avgScore,
      classification,
      qualifiedLeads: hotLeads + warmLeads,
      closedDeals,
      conversionRate,
      criteria: avgCriteria,
      isAnticipated: true,
    });
    reportContent.executive_summary = executiveSummaryData.executive_summary;
    reportContent.period_overview = executiveSummaryData.period_overview;

    // 2. Criteria Analysis
    console.log('Generating criteria analysis...');
    reportContent.criteria_analysis = await generateCriteriaAnalysis(geminiApiKey, avgCriteria, avgScore);

    // 3. Agents Analysis
    console.log('Generating agents analysis...');
    reportContent.agents_detailed = await generateAgentsAnalysis(geminiApiKey, agentsBasicAnalysis, avgScore);

    // 4. Strengths & Weaknesses
    console.log('Generating strengths and weaknesses...');
    const strengthsWeaknesses = await generateStrengthsWeaknesses(geminiApiKey, {
      avgScore,
      criteria: avgCriteria,
      qualifiedLeads: hotLeads + warmLeads,
      closedDeals,
      totalConversations: conversations.length,
    });
    reportContent.strengths_detailed = strengthsWeaknesses.strengths_detailed;
    reportContent.weaknesses_detailed = strengthsWeaknesses.weaknesses_detailed;

    // 5. Insights & Conclusion
    console.log('Generating insights and conclusion...');
    const insightsConclusion = await generateInsightsAndConclusion(geminiApiKey, {
      avgScore,
      classification,
      totalConversations: conversations.length,
      qualifiedLeads: hotLeads + warmLeads,
      closedDeals,
      conversionRate,
      criteria: avgCriteria,
      isAnticipated: true,
    });
    reportContent.insights_detailed = insightsConclusion.insights_detailed;
    reportContent.conclusion = insightsConclusion.conclusion;
    reportContent.next_steps = insightsConclusion.next_steps;
    reportContent.final_message = insightsConclusion.final_message;

    console.log('AI content generation complete');

    // Extract simple arrays for backward compatibility
    const simpleStrengths = reportContent.strengths_detailed.map(s => s.title);
    const simpleWeaknesses = reportContent.weaknesses_detailed.map(w => w.title);
    const simpleInsights = reportContent.insights_detailed.map(i => i.insight);

    // Create the anticipated commercial report
    const { error: insertError } = await supabase.from('commercial_reports').insert({
      company_id: companyId,
      report_date: now.toISOString().split('T')[0],
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      average_score: avgScore,
      classification,
      criteria_scores: avgCriteria,
      total_conversations: conversations.length,
      total_leads: conversations.length,
      qualified_leads: hotLeads + warmLeads,
      closed_deals: closedDeals,
      conversion_rate: conversionRate,
      contacts_by_state: contactsByState,
      deals_by_state: dealsByState,
      agents_analysis: agentsBasicAnalysis,
      strengths: simpleStrengths,
      weaknesses: simpleWeaknesses,
      insights: simpleInsights,
      final_recommendation: reportContent.conclusion,
      is_anticipated: true,
      anticipated_at: now.toISOString(),
      anticipated_by: user.id,
      report_content: reportContent,
    });

    if (insertError) {
      throw new Error(`Failed to create report: ${insertError.message}`);
    }

    console.log(`Anticipated report created successfully for company ${companyId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Relatório antecipado gerado com sucesso!',
      total_conversations: conversations.length,
      evaluated_conversations: evaluationsWithScores.length,
      average_score: avgScore.toFixed(1),
      classification,
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
