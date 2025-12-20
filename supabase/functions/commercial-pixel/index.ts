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
      .select('today_messages, last_reset_date')
      .eq('company_id', company_id)
      .maybeSingle();
    
    const today = new Date().toISOString().split('T')[0];
    const needsReset = dashboard?.last_reset_date !== today;
    
    await supabase
      .from('company_live_dashboard')
      .upsert({
        company_id,
        today_messages: needsReset ? 1 : (dashboard?.today_messages || 0) + 1,
        last_reset_date: today,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id' });

    // Analyze ALL text messages (inbound AND outbound) to track conversation flow
    let aiAnalysis: any = null;
    
    if (geminiApiKey && message_content && message_type === 'text') {
      try {
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

        console.log('🤖 [PIXEL] Calling Gemini for analysis...');
        
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 500
              }
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Debug: Log raw response
          console.log('📄 [PIXEL] Gemini raw response (first 500 chars):', responseText.substring(0, 500));
          
          // Clean markdown formatting before extracting JSON
          let cleanedResponse = responseText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();
          
          // Extract JSON from response
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              aiAnalysis = JSON.parse(jsonMatch[0]);
              console.log('✅ [PIXEL] AI Analysis parsed successfully:', JSON.stringify(aiAnalysis));
            } catch (parseError) {
              console.log('⚠️ [PIXEL] Failed to parse AI response as JSON:', parseError);
              console.log('⚠️ [PIXEL] Attempted to parse:', jsonMatch[0].substring(0, 200));
            }
          } else {
            console.log('⚠️ [PIXEL] No JSON found in cleaned response');
            console.log('⚠️ [PIXEL] Cleaned response:', cleanedResponse.substring(0, 300));
          }
        } else {
          const errorText = await geminiResponse.text();
          console.log('⚠️ [PIXEL] Gemini API error:', geminiResponse.status, errorText.substring(0, 200));
        }
      } catch (aiError) {
        console.log('⚠️ [PIXEL] AI analysis error:', aiError);
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

    // ALWAYS update aggregated dashboard data (not just when AI analysis happens)
    // This ensures real-time counts for leads and active conversations
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
        // Count leads by status
        if (m.lead_status === 'hot') statusCounts.hot++;
        else if (m.lead_status === 'warming') statusCounts.warm++;
        else if (m.lead_status === 'cold') statusCounts.cold++;
        
        // Count active conversations (activity in last 24h AND not closed)
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

    console.log(`✅ [PIXEL] Analysis complete for ${conversation_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      analysis: aiAnalysis,
      metrics_updated: true
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
