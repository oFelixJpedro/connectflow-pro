import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * COMMERCIAL-PIXEL (v2 - Cost Optimized)
 * 
 * This function now ONLY tracks basic message counters.
 * All AI analysis has been moved to the daily batch processor (commercial-daily-processor)
 * which runs once per day at 5 AM to minimize Gemini API costs.
 * 
 * What this function does:
 * - Updates message counts in conversation_live_metrics
 * - Updates today_messages in company_live_dashboard
 * - Tracks active conversations count
 * 
 * What this function NO LONGER does:
 * - AI sentiment analysis
 * - AI behavior detection
 * - AI conversation evaluation
 * - AI insights generation
 * 
 * All AI analysis is now done incrementally by commercial-daily-processor.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
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

    // Check if commercial manager is enabled for this company
    const { data: companyData } = await supabase
      .from('companies')
      .select('commercial_manager_enabled')
      .eq('id', company_id)
      .maybeSingle();
    
    // Skip if commercial manager is not enabled
    if (companyData?.commercial_manager_enabled === false) {
      console.log(`⏭️ [PIXEL] Skipping - commercial_manager not enabled`);
      return new Response(JSON.stringify({ skipped: true, reason: 'commercial_manager_not_enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 [PIXEL] Tracking message for conversation ${conversation_id}`);
    console.log(`   - Direction: ${direction}, Type: ${message_type}`);

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

    // Basic metrics update (NO AI - just counting)
    const metricsUpdate: any = {
      conversation_id,
      company_id,
      total_messages: currentTotalMessages,
      agent_messages: isInbound ? currentAgentMessages : currentAgentMessages + 1,
      client_messages: isInbound ? currentClientMessages + 1 : currentClientMessages,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Upsert metrics
    const { error: metricsError } = await supabase
      .from('conversation_live_metrics')
      .upsert(metricsUpdate, { onConflict: 'conversation_id' });

    if (metricsError) {
      console.log('⚠️ [PIXEL] Error updating metrics:', metricsError);
    }

    // Update company dashboard counters
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

    // Update active conversations count (conversations with messages in last 24h)
    const { data: allMetrics } = await supabase
      .from('conversation_live_metrics')
      .select('lead_status, last_activity_at')
      .eq('company_id', company_id);

    if (allMetrics) {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      let activeCount = 0;
      allMetrics.forEach((m: any) => {
        const lastActivity = m.last_activity_at ? new Date(m.last_activity_at) : null;
        const isActive = lastActivity && lastActivity > twentyFourHoursAgo;
        const isNotClosed = !['closed_won', 'closed_lost'].includes(m.lead_status);
        
        if (isActive && isNotClosed) {
          activeCount++;
        }
      });

      await supabase
        .from('company_live_dashboard')
        .update({
          active_conversations: activeCount,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', company_id);
    }

    console.log(`✅ [PIXEL] Message tracked (no AI analysis - handled by daily processor)`);

    return new Response(JSON.stringify({ 
      success: true, 
      metrics_updated: true,
      ai_analysis: false, // No AI analysis in this version
      note: 'AI analysis moved to commercial-daily-processor for cost optimization'
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
