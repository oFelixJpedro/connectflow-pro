import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from '../_shared/usage-tracker.ts';
import { checkCredits, consumeCredits } from '../_shared/supabase-credits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt for incremental conversation evaluation
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
  "lead_status": "cold" | "warming" | "hot" | "closed_won" | "closed_lost",
  "strengths": ["lista de pontos fortes do vendedor"],
  "improvements": ["lista de melhorias necessárias"],
  "lead_pain_points": ["dores identificadas do cliente"],
  "ai_summary": "resumo de 2-3 frases da conversa"
}`;

// Prompt for daily insights generation
const INSIGHTS_PROMPT = `Com base nos dados agregados das conversas comerciais do dia, gere insights estratégicos.
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

Seja específico, acionável e baseado nos dados fornecidos. Evite generalidades.`;

// Robust JSON parsing
function parseAIResponse(responseText: string): any | null {
  if (!responseText) return null;
  
  let cleanedResponse = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  
  if (cleanedResponse.startsWith('{')) {
    try {
      return JSON.parse(cleanedResponse);
    } catch (e) {
      console.log('⚠️ [PROCESSOR] Direct parse failed, trying extraction');
    }
  }
  
  const start = cleanedResponse.indexOf('{');
  const end = cleanedResponse.lastIndexOf('}');
  
  if (start !== -1 && end > start) {
    const jsonText = cleanedResponse.slice(start, end + 1);
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      console.log('⚠️ [PROCESSOR] Extraction parse failed');
    }
  }
  
  return null;
}

// Call Gemini API
async function callGemini(prompt: string, geminiApiKey: string): Promise<{ parsed: any | null; usage: { input: number; output: number } }> {
  const defaultUsage = { input: 0, output: 0 };
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
            maxOutputTokens: 2000
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log('⚠️ [PROCESSOR] Gemini API error:', response.status, errorText.substring(0, 200));
      return { parsed: null, usage: defaultUsage };
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const usageMetadata = data.usageMetadata;
    const usage = {
      input: usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4),
      output: usageMetadata?.candidatesTokenCount || Math.ceil(responseText.length / 4)
    };
    
    return { parsed: parseAIResponse(responseText), usage };
  } catch (error) {
    console.log('⚠️ [PROCESSOR] Gemini call error:', error);
    return { parsed: null, usage: defaultUsage };
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
  
  console.log('🌅 [PROCESSOR] Starting daily commercial analysis...');
  
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Step 1: Get companies with commercial manager enabled
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, commercial_manager_enabled, ai_optimization_settings')
      .eq('commercial_manager_enabled', true)
      .eq('active', true);
    
    if (companiesError) throw companiesError;
    
    console.log(`📊 [PROCESSOR] Found ${companies?.length || 0} companies with commercial manager enabled`);
    
    const results: any[] = [];
    
    for (const company of companies || []) {
      console.log(`\n🏢 [PROCESSOR] Processing company: ${company.name} (${company.id})`);
      
      try {
        // ═══════════════════════════════════════════════════════════════════
        // 💳 VERIFICAÇÃO DE CRÉDITOS DE IA
        // ═══════════════════════════════════════════════════════════════════
        const creditCheck = await checkCredits(supabase, company.id, 'standard_text', 5000);
        if (!creditCheck.hasCredits) {
          console.log(`⚠️ [PROCESSOR] Skipping ${company.name} - insufficient credits`);
          results.push({ company_id: company.id, company_name: company.name, skipped: true, reason: 'no_credits' });
          continue;
        }
        // Step 2: Get users with commercial_analysis_enabled = true for this company
        const { data: enabledAgents, error: agentsError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('company_id', company.id)
          .eq('commercial_analysis_enabled', true);
        
        if (agentsError) {
          console.log(`⚠️ [PROCESSOR] Error fetching agents for ${company.name}:`, agentsError);
          continue;
        }
        
        if (!enabledAgents || enabledAgents.length === 0) {
          console.log(`⏭️ [PROCESSOR] No enabled agents for ${company.name}, skipping`);
          results.push({ company_id: company.id, company_name: company.name, skipped: true, reason: 'no_enabled_agents' });
          continue;
        }
        
        const enabledAgentIds = enabledAgents.map(a => a.id);
        console.log(`👥 [PROCESSOR] ${enabledAgents.length} enabled agents: ${enabledAgents.map(a => a.full_name).join(', ')}`);
        
        // Step 3: Get conversations from last 24h assigned to enabled agents
        const { data: conversations, error: convsError } = await supabase
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
          .in('assigned_user_id', enabledAgentIds)
          .gte('last_message_at', yesterday.toISOString());
        
        if (convsError) {
          console.log(`⚠️ [PROCESSOR] Error fetching conversations for ${company.name}:`, convsError);
          continue;
        }
        
        console.log(`💬 [PROCESSOR] ${conversations?.length || 0} conversations in last 24h for enabled agents`);
        
        if (!conversations || conversations.length === 0) {
          console.log(`⏭️ [PROCESSOR] No conversations to process for ${company.name}`);
          results.push({ company_id: company.id, company_name: company.name, skipped: true, reason: 'no_conversations' });
          continue;
        }
        
        // Step 4: Get already processed conversations
        const conversationIds = conversations.map(c => c.id);
        const { data: processedConvs } = await supabase
          .from('commercial_processed_conversations')
          .select('*')
          .in('conversation_id', conversationIds);
        
        const processedMap = new Map((processedConvs || []).map(p => [p.conversation_id, p]));
        
        // Step 5: Process each conversation incrementally
        let evaluatedCount = 0;
        let skippedCount = 0;
        const agentStats: Record<string, { conversations: number; closed: number; totalScore: number; evalCount: number }> = {};
        const allStrengths: string[] = [];
        const allWeaknesses: string[] = [];
        const allObjections: string[] = [];
        const allPainPoints: string[] = [];
        let totalScore = 0;
        let scoreCount = 0;
        
        // Initialize agent stats
        enabledAgents.forEach(a => {
          agentStats[a.id] = { conversations: 0, closed: 0, totalScore: 0, evalCount: 0 };
        });
        
        for (const conv of conversations) {
          const processed = processedMap.get(conv.id);
          
          // Get current message count
          const { count: messageCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);
          
          const currentMsgCount = messageCount || 0;
          const lastMsgCount = processed?.last_message_count || 0;
          
          // Track agent stats
          if (conv.assigned_user_id && agentStats[conv.assigned_user_id]) {
            agentStats[conv.assigned_user_id].conversations++;
          }
          
          // Skip if no new messages since last processing
          if (processed && currentMsgCount <= lastMsgCount) {
            skippedCount++;
            
            // Still use existing evaluation data for aggregation
            const existingEval = processed.evaluation_data as any;
            if (existingEval?.overall_score) {
              totalScore += existingEval.overall_score;
              scoreCount++;
              
              if (conv.assigned_user_id && agentStats[conv.assigned_user_id]) {
                agentStats[conv.assigned_user_id].totalScore += existingEval.overall_score;
                agentStats[conv.assigned_user_id].evalCount++;
              }
              
              if (existingEval.strengths) allStrengths.push(...existingEval.strengths);
              if (existingEval.improvements) allWeaknesses.push(...existingEval.improvements);
              if (existingEval.lead_pain_points) allPainPoints.push(...existingEval.lead_pain_points);
              
              if (existingEval.lead_status === 'closed_won' && conv.assigned_user_id) {
                agentStats[conv.assigned_user_id].closed++;
              }
            }
            continue;
          }
          
          // Step 6: Get only NEW messages (after last processing)
          let messagesQuery = supabase
            .from('messages')
            .select('content, direction, sender_type, created_at, message_type')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
          
          if (processed && lastMsgCount > 0) {
            messagesQuery = messagesQuery.range(lastMsgCount, currentMsgCount);
          }
          
          const { data: messages } = await messagesQuery.limit(50);
          
          if (!messages || messages.length < 3) {
            skippedCount++;
            continue;
          }
          
          // Build conversation text for evaluation
          const conversationText = messages
            .filter(m => m.content)
            .map(m => {
              const sender = m.direction === 'inbound' ? 'Cliente' : 'Vendedor';
              const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return `[${time}] ${sender}: ${m.content}`;
            })
            .join('\n');
          
          // Build incremental prompt with previous context
          let contextInfo = '';
          if (processed?.evaluation_data) {
            const prevEval = processed.evaluation_data as any;
            contextInfo = `
AVALIAÇÃO ANTERIOR (contexto para incrementar):
- Score geral anterior: ${prevEval.overall_score || 'N/A'}
- Status do lead: ${prevEval.lead_status || 'N/A'}
- Qualificação: ${prevEval.lead_qualification || 'N/A'}
- Resumo anterior: ${prevEval.ai_summary || 'N/A'}

Atualize a avaliação considerando as NOVAS mensagens abaixo:
`;
          }
          
          const evalPrompt = `${EVALUATION_PROMPT}
${contextInfo}
--- CONVERSA ---
${conversationText}
--- FIM DA CONVERSA ---`;

          // Call Gemini for evaluation (only if we have API key)
          if (geminiApiKey) {
            console.log(`🤖 [PROCESSOR] Evaluating conversation ${conv.id} (${currentMsgCount} msgs)...`);
            
            const startTime = Date.now();
            const evalResult = await callGemini(evalPrompt, geminiApiKey);
            
            await logAIUsage(
              supabase, company.id, 'commercial-daily-processor-eval',
              'gemini-2.0-flash',
              evalResult.usage.input, evalResult.usage.output,
              Date.now() - startTime,
              { conversation_id: conv.id, message_count: currentMsgCount },
              false
            );
            
            if (evalResult.parsed) {
              evaluatedCount++;
              const evalData = evalResult.parsed;
              
              // Aggregate data
              if (evalData.overall_score) {
                totalScore += evalData.overall_score;
                scoreCount++;
                
                if (conv.assigned_user_id && agentStats[conv.assigned_user_id]) {
                  agentStats[conv.assigned_user_id].totalScore += evalData.overall_score;
                  agentStats[conv.assigned_user_id].evalCount++;
                }
              }
              
              if (evalData.strengths) allStrengths.push(...evalData.strengths);
              if (evalData.improvements) allWeaknesses.push(...evalData.improvements);
              if (evalData.lead_pain_points) allPainPoints.push(...evalData.lead_pain_points);
              
              if (evalData.lead_status === 'closed_won' && conv.assigned_user_id) {
                agentStats[conv.assigned_user_id].closed++;
              }
              
              // Save to conversation_evaluations
              await supabase
                .from('conversation_evaluations')
                .upsert({
                  conversation_id: conv.id,
                  company_id: company.id,
                  agent_id: conv.assigned_user_id,
                  communication_score: evalData.communication_score || 0,
                  objectivity_score: evalData.objectivity_score || 0,
                  humanization_score: evalData.humanization_score || 0,
                  objection_handling_score: evalData.objection_handling_score || 0,
                  closing_score: evalData.closing_score || 0,
                  response_time_score: evalData.response_time_score || 0,
                  overall_score: evalData.overall_score || 0,
                  lead_qualification: evalData.lead_qualification || 'cold',
                  lead_interest_level: evalData.lead_interest_level || 3,
                  strengths: evalData.strengths || [],
                  improvements: evalData.improvements || [],
                  lead_pain_points: evalData.lead_pain_points || [],
                  ai_summary: evalData.ai_summary || '',
                  evaluated_at: new Date().toISOString()
                }, { onConflict: 'conversation_id' });
              
              // Update processed conversations tracking
              await supabase
                .from('commercial_processed_conversations')
                .upsert({
                  company_id: company.id,
                  conversation_id: conv.id,
                  last_message_count: currentMsgCount,
                  last_processed_at: new Date().toISOString(),
                  evaluation_data: evalData,
                  metrics_data: {
                    lead_status: evalData.lead_status,
                    interest_level: evalData.lead_interest_level
                  }
                }, { onConflict: 'conversation_id' });
              
              console.log(`✅ [PROCESSOR] Evaluated ${conv.id}: score=${evalData.overall_score}, status=${evalData.lead_status}`);
            }
          }
        }
        
        console.log(`📊 [PROCESSOR] ${company.name}: ${evaluatedCount} evaluated, ${skippedCount} skipped (no new messages)`);
        
        // Step 7: Get previous snapshot for incremental calculation
        const { data: previousSnapshot } = await supabase
          .from('commercial_daily_snapshots')
          .select('*')
          .eq('company_id', company.id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Step 8: Calculate agent rankings
        const agentRankings = enabledAgents.map(agent => {
          const stats = agentStats[agent.id];
          let score = 0;
          
          if (stats.evalCount > 0) {
            score = Math.round((stats.totalScore / stats.evalCount) * 10) / 10;
          } else if (stats.conversations > 0) {
            score = Math.round((stats.closed / stats.conversations) * 10 * 10) / 10;
          }
          
          const level = score >= 8.5 ? 'senior' : score >= 7.0 ? 'pleno' : 'junior';
          const recommendation = score >= 8.5 ? 'promover' :
            score >= 7.0 ? 'manter' :
            score >= 6.0 ? 'treinar' :
            score >= 5.0 ? 'monitorar' : 'ação corretiva';
          
          return {
            id: agent.id,
            name: agent.full_name,
            avatar_url: agent.avatar_url,
            level,
            score,
            conversations: stats.conversations,
            recommendation
          };
        }).filter(a => a.conversations > 0).sort((a, b) => b.score - a.score);
        
        // Step 9: Generate daily insights (one Gemini call per company)
        let aggregatedInsights: any = previousSnapshot?.aggregated_insights || {};
        
        if (geminiApiKey && scoreCount > 0) {
          const avgScore = Math.round((totalScore / scoreCount) * 10) / 10;
          
          // Get top items by frequency
          const getTop = (arr: string[], count: number) => {
            const counts: Record<string, number> = {};
            arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
            return Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, count)
              .map(([item]) => item);
          };
          
          const topStrengths = getTop(allStrengths, 5);
          const topWeaknesses = getTop(allWeaknesses, 5);
          const topPainPoints = getTop(allPainPoints, 5);
          
          const insightsPrompt = `${INSIGHTS_PROMPT}

DADOS DO DIA (${todayStr}):
- Conversas processadas: ${conversations.length}
- Avaliações novas: ${evaluatedCount}
- Score médio: ${avgScore}/10
- Agentes ativos: ${agentRankings.length}

Top Pontos Fortes: ${topStrengths.join(', ') || 'Nenhum identificado'}
Top Pontos de Melhoria: ${topWeaknesses.join(', ') || 'Nenhum identificado'}
Dores dos Clientes: ${topPainPoints.join(', ') || 'Nenhuma identificada'}

Performance dos Agentes:
${agentRankings.map(a => `- ${a.name}: ${a.score}/10, ${a.conversations} conversas, nível ${a.level}`).join('\n')}`;

          console.log('🧠 [PROCESSOR] Generating daily insights...');
          const insightsStartTime = Date.now();
          const insightsResult = await callGemini(insightsPrompt, geminiApiKey);
          
          await logAIUsage(
            supabase, company.id, 'commercial-daily-processor-insights',
            'gemini-2.0-flash',
            insightsResult.usage.input, insightsResult.usage.output,
            Date.now() - insightsStartTime,
            { conversations_count: conversations.length, evaluations_count: evaluatedCount },
            false
          );
          
          if (insightsResult.parsed) {
            aggregatedInsights = {
              ...insightsResult.parsed,
              average_score: avgScore,
              agent_rankings: agentRankings,
              criteria_scores: previousSnapshot?.aggregated_insights?.criteria_scores || {}
            };
            console.log('✅ [PROCESSOR] Daily insights generated');
          }
        }
        
        // Step 10: Count lead statuses from conversation_live_metrics
        const { data: liveMetrics } = await supabase
          .from('conversation_live_metrics')
          .select('lead_status')
          .in('conversation_id', conversationIds);
        
        const leadCounts = {
          hot: liveMetrics?.filter(m => m.lead_status === 'hot').length || 0,
          warm: liveMetrics?.filter(m => m.lead_status === 'warming').length || 0,
          cold: liveMetrics?.filter(m => m.lead_status === 'cold').length || 0,
          closed_won: liveMetrics?.filter(m => m.lead_status === 'closed_won').length || 0,
          closed_lost: liveMetrics?.filter(m => m.lead_status === 'closed_lost').length || 0
        };
        
        // Step 11: Save daily snapshot (incremental)
        const avgOverallScore = scoreCount > 0 ? totalScore / scoreCount : (previousSnapshot?.avg_overall_score || 0);
        
        const { error: snapshotError } = await supabase
          .from('commercial_daily_snapshots')
          .upsert({
            company_id: company.id,
            snapshot_date: todayStr,
            total_conversations: (previousSnapshot?.total_conversations || 0) + conversations.length,
            total_messages: (previousSnapshot?.total_messages || 0) + evaluatedCount,
            hot_leads: leadCounts.hot,
            warm_leads: leadCounts.warm,
            cold_leads: leadCounts.cold,
            closed_won: (previousSnapshot?.closed_won || 0) + leadCounts.closed_won,
            closed_lost: (previousSnapshot?.closed_lost || 0) + leadCounts.closed_lost,
            avg_overall_score: avgOverallScore,
            evaluated_conversations: (previousSnapshot?.evaluated_conversations || 0) + evaluatedCount,
            aggregated_insights: aggregatedInsights,
            agents_data: agentRankings,
            top_objections: getTop(allObjections, 10),
            top_pain_points: getTop(allPainPoints, 10),
            conversations_processed_count: conversations.length,
            processing_completed_at: new Date().toISOString()
          }, { onConflict: 'company_id,snapshot_date' });
        
        if (snapshotError) {
          console.log(`⚠️ [PROCESSOR] Error saving snapshot for ${company.name}:`, snapshotError);
        } else {
          console.log(`✅ [PROCESSOR] Snapshot saved for ${company.name}`);
        }
        
        // Step 12: Update company_live_dashboard with latest data
        await supabase
          .from('company_live_dashboard')
          .upsert({
            company_id: company.id,
            hot_leads: leadCounts.hot,
            warm_leads: leadCounts.warm,
            cold_leads: leadCounts.cold,
            aggregated_insights: aggregatedInsights,
            last_insights_update: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'company_id' });
        
        results.push({
          company_id: company.id,
          company_name: company.name,
          success: true,
          enabled_agents: enabledAgents.length,
          conversations_processed: conversations.length,
          evaluated: evaluatedCount,
          skipped: skippedCount
        });
        
        // Helper function for getting top items
        function getTop(arr: string[], count: number): string[] {
          const counts: Record<string, number> = {};
          arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
          return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([item]) => item);
        }
        
      } catch (companyError) {
        console.error(`❌ [PROCESSOR] Error processing ${company.name}:`, companyError);
        results.push({
          company_id: company.id,
          company_name: company.name,
          success: false,
          error: companyError instanceof Error ? companyError.message : 'Unknown error'
        });
      }
    }
    
    console.log('\n✅ [PROCESSOR] Daily processing complete!');
    console.log('📊 [PROCESSOR] Results:', JSON.stringify(results, null, 2));
    
    return new Response(JSON.stringify({
      success: true,
      processed_at: new Date().toISOString(),
      companies_processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ [PROCESSOR] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
