import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`📥 [QUEUE-INSIGHTS-JOB] Request received`)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User has no company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { 
      filters, 
      conversationIds, 
      agentIds,
      evaluations,
      criteriaScores,
      filterDescription 
    } = body

    console.log(`📋 [QUEUE-INSIGHTS-JOB] Creating job for company ${profile.company_id}`)
    console.log(`   - Conversations: ${conversationIds?.length || 0}`)
    console.log(`   - Agents: ${agentIds?.length || 0}`)

    // Create job in database using service role client for insert
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: job, error: jobError } = await serviceClient
      .from('insights_jobs')
      .insert({
        company_id: profile.company_id,
        requested_by: user.id,
        job_type: 'filtered_insights',
        filters: {
          ...filters,
          conversationIds,
          agentIds,
          evaluations,
          criteriaScores,
          filterDescription,
        },
        status: 'pending',
        progress: 0,
        current_step: 'Aguardando processamento...',
      })
      .select('id')
      .single()

    if (jobError) {
      console.error(`❌ [QUEUE-INSIGHTS-JOB] Error creating job:`, jobError)
      return new Response(
        JSON.stringify({ error: 'Failed to create job', details: jobError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ [QUEUE-INSIGHTS-JOB] Job created: ${job.id}`)

    // Initialize Redis
    const redis = new Redis({
      url: Deno.env.get('UPSTASH_REDIS_URL')!,
      token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
    })

    // Enqueue job in Redis
    const queueItem = {
      jobId: job.id,
      companyId: profile.company_id,
      userId: user.id,
      filters: {
        ...filters,
        conversationIds,
        agentIds,
        evaluations,
        criteriaScores,
        filterDescription,
      },
      createdAt: new Date().toISOString(),
    }

    await redis.rpush('queue:insights', JSON.stringify(queueItem))
    
    // Also set initial status in Redis for fast polling
    await redis.set(`job:status:${job.id}`, JSON.stringify({
      status: 'pending',
      progress: 0,
      currentStep: 'Aguardando processamento...',
    }), { ex: 86400 }) // 24h TTL

    console.log(`📤 [QUEUE-INSIGHTS-JOB] Job enqueued: ${job.id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: job.id,
        status: 'pending',
        message: 'Job criado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`❌ [QUEUE-INSIGHTS-JOB] Error:`, error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
