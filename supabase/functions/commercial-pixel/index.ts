import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt for AI analysis
const ANALYSIS_PROMPT = `Analise esta mensagem de uma conversa comercial de vendas. 
Responda APENAS em JSON válido, sem markdown:
{
  "sentiment": "positive" | "negative" | "neutral",
  "interest_level": 1-5,
  "deal_signals": ["lista de sinais de compra detectados"],
  "objections": ["objeções mencionadas pelo cliente"],
  "pain_points": ["dores/problemas mencionados"],
  "is_closing_signal": true/false,
  "is_disqualification_signal": true/false,
  "lead_status": "cold" | "warming" | "hot" | "closed_won" | "closed_lost",
  "close_probability": 0-100,
  "predicted_outcome": "likely_close" | "likely_lost" | "needs_followup" | "unknown"
}

Sinais de fechamento incluem: pedido de preço, contrato, forma de pagamento, prazo de entrega, "vamos fechar", "pode enviar".
Sinais de desqualificação: "não tenho interesse", "não é para mim", errou o número, spam.
`;

// Prompt for conversation evaluation
const EVALUATION_PROMPT = `Avalie esta conversa comercial de vendas. Analise a qualidade do atendimento do vendedor.
Responda APENAS em JSON válido, sem markdown:
{
  "communication_score": 0-10,
  "objectivity_score": 0-10,
  "humanization_score": 0-10,
  "objection_handling_score": 0-10,
  "closing_score": 0-10,
  "response_time_score": 0-10,
  "overall_score": 0-10,
  "lead_qualification": "cold" | "warm" | "hot",
  "lead_interest_level": 1-5,
  "strengths": ["lista de pontos fortes do vendedor"],
  "improvements": ["lista de melhorias necessárias"],
  "lead_pain_points": ["dores identificadas do cliente"],
  "ai_summary": "resumo de 2-3 frases da conversa"
}

Critérios:
- communication_score: Clareza, gramática, tom profissional
- objectivity_score: Foco no objetivo, sem enrolação
- humanization_score: Empatia, personalização, conexão
- objection_handling_score: Tratamento de objeções e dúvidas
- closing_score: Técnicas de fechamento, call to action
- response_time_score: Agilidade nas respostas (avalie pelo fluxo)
`;

// Prompt for behavior analysis
const BEHAVIOR_PROMPT = `Analise esta mensagem do VENDEDOR em uma conversa comercial e detecte comportamentos problemáticos.
Contexto das últimas mensagens está incluído para você avaliar se a resposta é justificada.

Responda APENAS em JSON válido, sem markdown:
{
  "has_issue": true/false,
  "alert_type": "aggressive" | "negligent" | "lazy" | "slow_response" | "sabotage" | "quality_issue" | "unprofessional" | null,
  "severity": "low" | "medium" | "high" | "critical",
  "title": "título curto do problema",
  "description": "descrição do comportamento problemático",
  "lead_was_rude": true/false,
  "confidence": 0.0-1.0
}

Tipos de alerta:
- aggressive: xingamentos, palavrões, ameaças, grosseria sem motivo
- negligent: ignorar perguntas importantes, desqualificar lead sem razão
- lazy: respostas secas/curtas demais, falta de proatividade, má vontade evidente
- slow_response: (não detectável aqui, será calculado separadamente)
- sabotage: prejudicar propositalmente a venda, desincentivar compra
- quality_issue: respostas confusas, erros graves, informações incorretas
- unprofessional: comportamento inadequado, linguagem imprópria

IMPORTANTE: 
- Se o lead foi grosseiro/rude primeiro, NÃO é alerta (lead_was_rude=true, has_issue=false)
- Respostas diretas e objetivas NÃO são lazy
- Analise o CONTEXTO antes de julgar
`;

// Prompt for aggregated insights
const INSIGHTS_PROMPT = `Com base nos dados agregados das conversas comerciais, gere insights estratégicos.
Responda APENAS em JSON válido, sem markdown:
{
  "strengths": ["3-5 pontos fortes identificados na equipe"],
  "weaknesses": ["3-5 pontos fracos que precisam atenção"],
  "positive_patterns": ["2-3 padrões positivos observados"],
  "negative_patterns": ["2-3 padrões negativos a corrigir"],
  "critical_issues": ["problemas críticos que precisam ação imediata, pode ser vazio"],
  "insights": ["5 insights acionáveis e específicos para melhoria"],
  "final_recommendation": "Uma recomendação estratégica clara e acionável com base em todos os dados"
}

Seja específico, acionável e baseado nos dados fornecidos. Evite generalidades.
`;

// Robust JSON parsing
function parseAIResponse(responseText: string): any | null {
  if (!responseText) return null;
  
  // Clean markdown formatting
  let cleanedResponse = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  
  // Try direct parse first (if response starts with {)
  if (cleanedResponse.startsWith('{')) {
    try {
      return JSON.parse(cleanedResponse);
    } catch (e) {
      console.log('⚠️ [PIXEL] Direct parse failed, trying extraction');
    }
  }
  
  // Extract from first { to last }
  const start = cleanedResponse.indexOf('{');
  const end = cleanedResponse.lastIndexOf('}');
  
  if (start !== -1 && end > start) {
    const jsonText = cleanedResponse.slice(start, end + 1);
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      console.log('⚠️ [PIXEL] Extraction parse failed:', e);
      console.log('⚠️ [PIXEL] Attempted to parse:', jsonText.substring(0, 300));
    }
  }
  
  // Try regex as last resort
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log('⚠️ [PIXEL] Regex parse failed');
    }
  }
  
  return null;
}

// Call Gemini API
async function callGemini(prompt: string, geminiApiKey: string): Promise<any | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1500
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log('⚠️ [PIXEL] Gemini API error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('📄 [PIXEL] Gemini response (first 300 chars):', responseText.substring(0, 300));
    
    return parseAIResponse(responseText);
  } catch (error) {
    console.log('⚠️ [PIXEL] Gemini call error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { 
      conversation_id, 
      company_id, 
      message_content, 
      message_type, 
      direction,
      contact_name 
    } = body;

    if (!conversation_id || !company_id) {
      console.log('❌ [PIXEL] Missing conversation_id or company_id');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 [PIXEL] Analyzing message for conversation ${conversation_id}`);
    console.log(`   - Direction: ${direction}, Type: ${message_type}`);
    console.log(`   - Content preview: ${(message_content || '').substring(0, 50)}...`);

    // Ensure company_live_dashboard exists
    await supabase
      .from('company_live_dashboard')
      .upsert({
        company_id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id' });

    // Get or create live metrics for this conversation
    const { data: existingMetrics } = await supabase
      .from('conversation_live_metrics')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    const isInbound = direction === 'inbound';
    const currentTotalMessages = (existingMetrics?.total_messages || 0) + 1;
    const currentAgentMessages = existingMetrics?.agent_messages || 0;
    const currentClientMessages = existingMetrics?.client_messages || 0;

    // Basic metrics update (always happens)
    const metricsUpdate: any = {
      conversation_id,
      company_id,
      total_messages: currentTotalMessages,
      agent_messages: isInbound ? currentAgentMessages : currentAgentMessages + 1,
      client_messages: isInbound ? currentClientMessages + 1 : currentClientMessages,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Get current dashboard and increment today_messages
    const { data: dashboard } = await supabase
      .from('company_live_dashboard')
      .select('today_messages, last_reset_date, insights_message_count')
      .eq('company_id', company_id)
      .maybeSingle();
    
    const today = new Date().toISOString().split('T')[0];
    const needsReset = dashboard?.last_reset_date !== today;
    const currentInsightsCount = dashboard?.insights_message_count || 0;
    
    await supabase
      .from('company_live_dashboard')
      .upsert({
        company_id,
        today_messages: needsReset ? 1 : (dashboard?.today_messages || 0) + 1,
        insights_message_count: needsReset ? 1 : currentInsightsCount + 1,
        last_reset_date: today,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id' });

    // Analyze ALL text messages (inbound AND outbound) to track conversation flow
    let aiAnalysis: any = null;
    
    if (geminiApiKey && message_content && message_type === 'text') {
      // Get last 5 messages for context
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('content, direction, sender_type, message_type')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(5);

      const contextMessages = (recentMessages || [])
        .reverse()
        .filter((m: any) => m.content)
        .map((m: any) => `${m.direction === 'inbound' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
        .join('\n');

      const fullPrompt = `${ANALYSIS_PROMPT}

Contexto da conversa (últimas mensagens):
${contextMessages}

Mensagem atual do ${isInbound ? 'cliente' : 'vendedor'}:
${message_content}`;

      console.log('🤖 [PIXEL] Calling Gemini for message analysis...');
      aiAnalysis = await callGemini(fullPrompt, geminiApiKey);
      
      if (aiAnalysis) {
        console.log('✅ [PIXEL] AI Analysis parsed successfully:', JSON.stringify(aiAnalysis));
      }
    }

    // FALLBACK: If AI analysis failed but we have message content, use rule-based analysis
    if (!aiAnalysis && message_content && message_type === 'text') {
      console.log('🔄 [PIXEL] Using fallback rule-based analysis');
      
      const contentLower = message_content.toLowerCase();
      const existingStatus = existingMetrics?.lead_status || 'unknown';
      
      // Simple rule-based classification
      let fallbackStatus = existingStatus;
      let fallbackInterest = 3;
      let fallbackSentiment = 'neutral';
      let fallbackProbability = existingMetrics?.close_probability || 10;
      
      // Positive signals (warming/hot indicators)
      const positiveSignals = ['interesse', 'gostei', 'quero', 'preço', 'valor', 'como funciona', 
        'pode me explicar', 'gostaria', 'queria', 'vamos', 'fechar', 'contrato', 'pagamento'];
      const negativeSignals = ['não tenho interesse', 'não quero', 'não preciso', 'obrigado mas não',
        'não é para mim', 'desculpa', 'errou'];
      const hotSignals = ['fechar', 'contrato', 'pagar', 'comprar', 'assinar', 'enviar proposta',
        'quanto fica', 'forma de pagamento', 'prazo'];
      
      const hasPositive = positiveSignals.some(s => contentLower.includes(s));
      const hasNegative = negativeSignals.some(s => contentLower.includes(s));
      const hasHot = hotSignals.some(s => contentLower.includes(s));
      
      if (hasNegative) {
        fallbackStatus = 'cold';
        fallbackSentiment = 'negative';
        fallbackInterest = 1;
        fallbackProbability = 5;
      } else if (hasHot && isInbound) {
        fallbackStatus = 'hot';
        fallbackSentiment = 'positive';
        fallbackInterest = 5;
        fallbackProbability = 70;
      } else if (hasPositive && isInbound) {
        fallbackStatus = existingStatus === 'unknown' ? 'warming' : existingStatus;
        fallbackSentiment = 'positive';
        fallbackInterest = 4;
        fallbackProbability = Math.max(fallbackProbability, 30);
      } else if (isInbound && existingStatus === 'unknown') {
        // New conversation from client
        fallbackStatus = 'warming';
        fallbackProbability = 20;
      }
      
      aiAnalysis = {
        sentiment: fallbackSentiment,
        interest_level: fallbackInterest,
        lead_status: fallbackStatus,
        close_probability: fallbackProbability,
        deal_signals: hasHot ? ['interesse em fechamento'] : [],
        objections: hasNegative ? ['demonstrou desinteresse'] : [],
        pain_points: [],
        is_closing_signal: hasHot,
        is_disqualification_signal: hasNegative,
        predicted_outcome: hasHot ? 'likely_close' : hasNegative ? 'likely_lost' : 'needs_followup',
        _fallback: true
      };
      
      console.log('🔄 [PIXEL] Fallback analysis result:', JSON.stringify(aiAnalysis));
    }

    // Apply AI analysis to metrics if available
    if (aiAnalysis) {
      metricsUpdate.current_sentiment = aiAnalysis.sentiment || 'neutral';
      metricsUpdate.interest_level = aiAnalysis.interest_level || 3;
      metricsUpdate.close_probability = aiAnalysis.close_probability || 0;
      metricsUpdate.predicted_outcome = aiAnalysis.predicted_outcome || null;
      
      // Update lead status (only escalate, don't downgrade without reason)
      const statusPriority: Record<string, number> = {
        'unknown': 0,
        'cold': 1,
        'warming': 2,
        'hot': 3,
        'closed_won': 4,
        'closed_lost': 4
      };
      
      const currentStatus = existingMetrics?.lead_status || 'unknown';
      const newStatus = aiAnalysis.lead_status || 'unknown';
      
      if (statusPriority[newStatus] >= statusPriority[currentStatus] || 
          newStatus === 'closed_lost' || 
          aiAnalysis.is_disqualification_signal) {
        metricsUpdate.lead_status = newStatus;
        metricsUpdate.lead_status_confidence = Math.min(
          (existingMetrics?.lead_status_confidence || 0.5) + 0.1, 
          1.0
        );
      }

      // Merge deal signals, objections, pain points
      const existingDealSignals = existingMetrics?.deal_signals || [];
      const existingObjections = existingMetrics?.objections_detected || [];
      const existingPainPoints = existingMetrics?.pain_points || [];

      if (aiAnalysis.deal_signals?.length > 0) {
        metricsUpdate.deal_signals = [...new Set([...existingDealSignals, ...aiAnalysis.deal_signals])].slice(-10);
      }
      if (aiAnalysis.objections?.length > 0) {
        metricsUpdate.objections_detected = [...new Set([...existingObjections, ...aiAnalysis.objections])].slice(-10);
      }
      if (aiAnalysis.pain_points?.length > 0) {
        metricsUpdate.pain_points = [...new Set([...existingPainPoints, ...aiAnalysis.pain_points])].slice(-10);
      }

      // Calculate engagement score based on multiple factors
      const engagementFactors = [
        aiAnalysis.interest_level / 5, // 0-1
        (aiAnalysis.close_probability || 0) / 100, // 0-1
        aiAnalysis.sentiment === 'positive' ? 0.2 : aiAnalysis.sentiment === 'negative' ? -0.2 : 0
      ];
      const rawEngagement = engagementFactors.reduce((a, b) => a + b, 0) / engagementFactors.length * 10;
      metricsUpdate.engagement_score = Math.max(0, Math.min(10, rawEngagement));

      // Log special events
      if (aiAnalysis.is_closing_signal) {
        await supabase.from('conversation_events').insert({
          conversation_id,
          company_id,
          event_type: 'closing_signal',
          event_data: { message_content, deal_signals: aiAnalysis.deal_signals },
          ai_insights: aiAnalysis
        });
      }

      if (aiAnalysis.is_disqualification_signal) {
        await supabase.from('conversation_events').insert({
          conversation_id,
          company_id,
          event_type: 'disqualification',
          event_data: { message_content, reason: aiAnalysis.objections },
          ai_insights: aiAnalysis
        });
      }
    }

    // =====================================================
    // AGENT BEHAVIOR DETECTION (for outbound messages only)
    // =====================================================
    if (!isInbound && geminiApiKey && message_content && message_type === 'text') {
      // Get conversation details to find the agent
      const { data: convDetails } = await supabase
        .from('conversations')
        .select('assigned_user_id, contact_id')
        .eq('id', conversation_id)
        .maybeSingle();

      if (convDetails?.assigned_user_id) {
        // Get last 5 messages for context
        const { data: contextMessages } = await supabase
          .from('messages')
          .select('content, direction, sender_type')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: false })
          .limit(5);

        const contextText = (contextMessages || [])
          .reverse()
          .filter((m: any) => m.content)
          .map((m: any) => `${m.direction === 'inbound' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
          .join('\n');

        const behaviorPrompt = `${BEHAVIOR_PROMPT}

Contexto da conversa:
${contextText}

Mensagem do vendedor a analisar:
${message_content}`;

        console.log('🔍 [PIXEL] Analyzing agent behavior...');
        const behaviorResult = await callGemini(behaviorPrompt, geminiApiKey);

        if (behaviorResult && behaviorResult.has_issue && behaviorResult.alert_type && behaviorResult.confidence >= 0.7) {
          console.log('⚠️ [PIXEL] Behavior issue detected:', behaviorResult);

          // Insert behavior alert
          await supabase.from('agent_behavior_alerts').insert({
            company_id,
            agent_id: convDetails.assigned_user_id,
            conversation_id,
            contact_id: convDetails.contact_id,
            alert_type: behaviorResult.alert_type,
            severity: behaviorResult.severity || 'medium',
            title: behaviorResult.title || 'Comportamento detectado',
            description: behaviorResult.description || '',
            message_excerpt: message_content.substring(0, 200),
            ai_confidence: behaviorResult.confidence,
            lead_was_rude: behaviorResult.lead_was_rude || false,
            detected_at: new Date().toISOString()
          });

          console.log('✅ [PIXEL] Behavior alert saved');
        }
      }
    }

    // Upsert metrics
    const { error: metricsError } = await supabase
      .from('conversation_live_metrics')
      .upsert(metricsUpdate, { onConflict: 'conversation_id' });

    if (metricsError) {
      console.log('⚠️ [PIXEL] Error updating metrics:', metricsError);
    }

    // Log message event
    await supabase.from('conversation_events').insert({
      conversation_id,
      company_id,
      event_type: 'message',
      event_data: {
        direction,
        message_type,
        content_preview: (message_content || '').substring(0, 100),
        contact_name
      },
      ai_insights: aiAnalysis || {}
    });

    // ALWAYS update aggregated dashboard data
    const { data: allMetrics } = await supabase
      .from('conversation_live_metrics')
      .select('lead_status, last_activity_at')
      .eq('company_id', company_id);

    if (allMetrics) {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const statusCounts = {
        hot: 0,
        warm: 0,
        cold: 0,
        active: 0
      };

      allMetrics.forEach((m: any) => {
        if (m.lead_status === 'hot') statusCounts.hot++;
        else if (m.lead_status === 'warming') statusCounts.warm++;
        else if (m.lead_status === 'cold') statusCounts.cold++;
        
        const lastActivity = m.last_activity_at ? new Date(m.last_activity_at) : null;
        const isActive = lastActivity && lastActivity > twentyFourHoursAgo;
        const isNotClosed = !['closed_won', 'closed_lost'].includes(m.lead_status);
        
        if (isActive && isNotClosed) {
          statusCounts.active++;
        }
      });

      console.log(`📊 [PIXEL] Dashboard update - Hot: ${statusCounts.hot}, Warm: ${statusCounts.warm}, Cold: ${statusCounts.cold}, Active: ${statusCounts.active}`);

      await supabase
        .from('company_live_dashboard')
        .update({
          hot_leads: statusCounts.hot,
          warm_leads: statusCounts.warm,
          cold_leads: statusCounts.cold,
          active_conversations: statusCounts.active,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', company_id);
    }

    // =====================================================
    // AUTOMATIC CONVERSATION EVALUATION (every 10 messages)
    // =====================================================
    const EVALUATION_INTERVAL = 10;
    const shouldEvaluate = currentTotalMessages > 0 && currentTotalMessages % EVALUATION_INTERVAL === 0;
    
    if (shouldEvaluate && geminiApiKey) {
      console.log(`📊 [PIXEL] Triggering automatic evaluation at ${currentTotalMessages} messages`);
      
      // Get full conversation for evaluation
      const { data: allMessages } = await supabase
        .from('messages')
        .select('content, direction, sender_type, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (allMessages && allMessages.length >= 5) {
        const conversationText = allMessages
          .filter((m: any) => m.content)
          .map((m: any) => `${m.direction === 'inbound' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
          .join('\n');

        const evalPrompt = `${EVALUATION_PROMPT}

Conversa completa:
${conversationText}`;

        console.log('🤖 [PIXEL] Calling Gemini for conversation evaluation...');
        const evalResult = await callGemini(evalPrompt, geminiApiKey);
        
        if (evalResult) {
          console.log('✅ [PIXEL] Evaluation result:', JSON.stringify(evalResult));
          
          // Upsert evaluation
          const { error: evalError } = await supabase
            .from('conversation_evaluations')
            .upsert({
              conversation_id,
              company_id,
              communication_score: evalResult.communication_score || 0,
              objectivity_score: evalResult.objectivity_score || 0,
              humanization_score: evalResult.humanization_score || 0,
              objection_handling_score: evalResult.objection_handling_score || 0,
              closing_score: evalResult.closing_score || 0,
              response_time_score: evalResult.response_time_score || 0,
              overall_score: evalResult.overall_score || 0,
              lead_qualification: evalResult.lead_qualification || 'cold',
              lead_interest_level: evalResult.lead_interest_level || 3,
              strengths: evalResult.strengths || [],
              improvements: evalResult.improvements || [],
              lead_pain_points: evalResult.lead_pain_points || [],
              ai_summary: evalResult.ai_summary || '',
              evaluated_at: new Date().toISOString()
            }, { onConflict: 'conversation_id' });

          if (evalError) {
            console.log('⚠️ [PIXEL] Error saving evaluation:', evalError);
          } else {
            console.log('✅ [PIXEL] Evaluation saved successfully');
          }
        }
      }
    }

    // =====================================================
    // AUTOMATIC INSIGHTS AGGREGATION (every 10 messages OR when empty)
    // =====================================================
    const INSIGHTS_INTERVAL = 10; // Reduced for faster feedback
    const newInsightsCount = needsReset ? 1 : currentInsightsCount + 1;
    
    // Fetch current dashboard to check if insights exist
    const { data: existingDashboard } = await supabase
      .from('company_live_dashboard')
      .select('aggregated_insights')
      .eq('company_id', company_id)
      .maybeSingle();
    
    const currentInsights = existingDashboard?.aggregated_insights as any;
    const hasNoInsights = !currentInsights || 
      !currentInsights.strengths || 
      currentInsights.strengths.length === 0 ||
      !currentInsights.final_recommendation ||
      currentInsights.final_recommendation === '';
    
    const shouldGenerateInsights = geminiApiKey && (
      hasNoInsights || // Always generate if no insights exist
      (newInsightsCount > 0 && newInsightsCount % INSIGHTS_INTERVAL === 0) // Or on interval
    );

    console.log(`🔍 [PIXEL] Insights check: count=${newInsightsCount}, interval=${INSIGHTS_INTERVAL}, hasNoInsights=${hasNoInsights}, shouldGenerate=${shouldGenerateInsights}`);
    
    if (shouldGenerateInsights) {
      console.log(`🧠 [PIXEL] Triggering insights aggregation (count=${newInsightsCount}, noInsights=${hasNoInsights})`);
      
      // Fetch all data for insights
      const { data: allLiveMetrics } = await supabase
        .from('conversation_live_metrics')
        .select('*')
        .eq('company_id', company_id);

      const { data: allEvaluations } = await supabase
        .from('conversation_evaluations')
        .select('*')
        .eq('company_id', company_id);

      // Aggregate data
      const aggregatedData = {
        total_conversations: allLiveMetrics?.length || 0,
        hot_leads: allLiveMetrics?.filter(m => m.lead_status === 'hot').length || 0,
        warm_leads: allLiveMetrics?.filter(m => m.lead_status === 'warming').length || 0,
        cold_leads: allLiveMetrics?.filter(m => m.lead_status === 'cold').length || 0,
        closed_won: allLiveMetrics?.filter(m => m.lead_status === 'closed_won').length || 0,
        closed_lost: allLiveMetrics?.filter(m => m.lead_status === 'closed_lost').length || 0,
        avg_close_probability: allLiveMetrics?.length 
          ? (allLiveMetrics.reduce((sum, m) => sum + (m.close_probability || 0), 0) / allLiveMetrics.length).toFixed(1)
          : 0,
        avg_interest_level: allLiveMetrics?.length
          ? (allLiveMetrics.reduce((sum, m) => sum + (m.interest_level || 0), 0) / allLiveMetrics.length).toFixed(1)
          : 0,
        total_objections: [...new Set(allLiveMetrics?.flatMap(m => m.objections_detected || []))],
        total_pain_points: [...new Set(allLiveMetrics?.flatMap(m => m.pain_points || []))],
        total_deal_signals: [...new Set(allLiveMetrics?.flatMap(m => m.deal_signals || []))],
      };

      const evalAggregated = {
        total_evaluations: allEvaluations?.length || 0,
        avg_overall_score: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        avg_communication: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.communication_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        avg_objectivity: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.objectivity_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        avg_humanization: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.humanization_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        avg_objection_handling: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.objection_handling_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        avg_closing: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.closing_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        avg_response_time: allEvaluations?.length
          ? (allEvaluations.reduce((sum, e) => sum + (e.response_time_score || 0), 0) / allEvaluations.length).toFixed(1)
          : 0,
        all_strengths: [...new Set(allEvaluations?.flatMap(e => e.strengths || []))],
        all_weaknesses: [...new Set(allEvaluations?.flatMap(e => e.improvements || []))],
        qualified_leads_percent: allEvaluations?.length
          ? ((allEvaluations.filter(e => e.lead_qualification === 'hot' || e.lead_qualification === 'warm').length / allEvaluations.length) * 100).toFixed(0)
          : 0,
      };

      const insightsPrompt = `${INSIGHTS_PROMPT}

Dados das conversas em tempo real:
- Total de conversas: ${aggregatedData.total_conversations}
- Leads quentes: ${aggregatedData.hot_leads}
- Leads mornos: ${aggregatedData.warm_leads}
- Leads frios: ${aggregatedData.cold_leads}
- Fechamentos ganhos: ${aggregatedData.closed_won}
- Fechamentos perdidos: ${aggregatedData.closed_lost}
- Probabilidade média de fechamento: ${aggregatedData.avg_close_probability}%
- Nível médio de interesse: ${aggregatedData.avg_interest_level}/5
- Objeções detectadas: ${aggregatedData.total_objections.join(', ') || 'Nenhuma'}
- Dores dos clientes: ${aggregatedData.total_pain_points.join(', ') || 'Nenhuma identificada'}
- Sinais de compra: ${aggregatedData.total_deal_signals.join(', ') || 'Nenhum'}

Dados das avaliações de qualidade:
- Total de avaliações: ${evalAggregated.total_evaluations}
- Score médio geral: ${evalAggregated.avg_overall_score}/10
- Comunicação média: ${evalAggregated.avg_communication}/10
- Objetividade média: ${evalAggregated.avg_objectivity}/10
- Humanização média: ${evalAggregated.avg_humanization}/10
- Tratamento de objeções: ${evalAggregated.avg_objection_handling}/10
- Fechamento: ${evalAggregated.avg_closing}/10
- Tempo de resposta: ${evalAggregated.avg_response_time}/10
- Leads qualificados: ${evalAggregated.qualified_leads_percent}%
- Pontos fortes identificados: ${evalAggregated.all_strengths.slice(0, 10).join(', ') || 'Nenhum ainda'}
- Pontos de melhoria: ${evalAggregated.all_weaknesses.slice(0, 10).join(', ') || 'Nenhum ainda'}`;

      console.log('🤖 [PIXEL] Calling Gemini for insights aggregation...');
      const insightsResult = await callGemini(insightsPrompt, geminiApiKey);
      
      if (insightsResult) {
        console.log('✅ [PIXEL] Insights generated:', JSON.stringify(insightsResult));
        
        // Save aggregated insights to dashboard
        const aggregatedInsights = {
          strengths: insightsResult.strengths || [],
          weaknesses: insightsResult.weaknesses || [],
          positive_patterns: insightsResult.positive_patterns || [],
          negative_patterns: insightsResult.negative_patterns || [],
          critical_issues: insightsResult.critical_issues || [],
          insights: insightsResult.insights || [],
          final_recommendation: insightsResult.final_recommendation || '',
          criteria_scores: {
            communication: parseFloat(evalAggregated.avg_communication as string) || 0,
            objectivity: parseFloat(evalAggregated.avg_objectivity as string) || 0,
            humanization: parseFloat(evalAggregated.avg_humanization as string) || 0,
            objection_handling: parseFloat(evalAggregated.avg_objection_handling as string) || 0,
            closing: parseFloat(evalAggregated.avg_closing as string) || 0,
            response_time: parseFloat(evalAggregated.avg_response_time as string) || 0,
          },
          average_score: parseFloat(evalAggregated.avg_overall_score as string) || 0,
          qualified_leads_percent: parseFloat(evalAggregated.qualified_leads_percent as string) || 0,
        };

        const { error: insightsError } = await supabase
          .from('company_live_dashboard')
          .update({
            aggregated_insights: aggregatedInsights,
            last_insights_update: new Date().toISOString(),
          })
          .eq('company_id', company_id);

        if (insightsError) {
          console.log('⚠️ [PIXEL] Error saving insights:', insightsError);
        } else {
          console.log('✅ [PIXEL] Insights saved to dashboard');
        }
      }
    }

    console.log(`✅ [PIXEL] Analysis complete for ${conversation_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      analysis: aiAnalysis,
      metrics_updated: true,
      evaluation_triggered: shouldEvaluate,
      insights_triggered: shouldGenerateInsights
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [PIXEL] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});