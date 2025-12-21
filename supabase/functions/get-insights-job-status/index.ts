import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { jobId } = body

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Redis
    const redis = new Redis({
      url: Deno.env.get('UPSTASH_REDIS_URL')!,
      token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
    })

    // First try Redis (faster for in-progress status)
    const redisStatus = await redis.get(`job:status:${jobId}`)
    
    if (redisStatus) {
      const status = typeof redisStatus === 'string' ? JSON.parse(redisStatus) : redisStatus
      
      // If completed or failed, also get result from database
      if (status.status === 'completed' || status.status === 'failed') {
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
        const { data: job } = await serviceClient
          .from('insights_jobs')
          .select('result, error_message')
          .eq('id', jobId)
          .single()

        return new Response(
          JSON.stringify({
            status: status.status,
            progress: status.progress || 100,
            currentStep: status.currentStep || (status.status === 'completed' ? 'Concluído' : 'Erro'),
            result: job?.result || null,
            error: job?.error_message || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({
          status: status.status,
          progress: status.progress || 0,
          currentStep: status.currentStep || 'Processando...',
          result: null,
          error: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback to database
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: job, error: jobError } = await serviceClient
      .from('insights_jobs')
      .select('status, progress, current_step, result, error_message')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ 
          error: 'Job not found',
          status: 'not_found',
          progress: 0,
          currentStep: null,
          result: null,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        status: job.status,
        progress: job.progress || 0,
        currentStep: job.current_step || 'Processando...',
        result: job.result || null,
        error: job.error_message || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`❌ [GET-INSIGHTS-JOB-STATUS] Error:`, error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
