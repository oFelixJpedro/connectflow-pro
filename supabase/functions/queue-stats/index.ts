import { Redis } from "https://esm.sh/@upstash/redis@1.28.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Redis client
const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
})

// ═══════════════════════════════════════════════════════════════════
// QUEUE STATS - Get queue statistics and health
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  console.log(`📊 [QUEUE-STATS] Fetching queue statistics...`)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Get queue lengths
    const [aiQueueLength, mediaQueueLength, dlqLength, permanentFailLength] = await Promise.all([
      redis.llen('queue:ai-agent'),
      redis.llen('queue:media'),
      redis.llen('queue:dlq'),
      redis.llen('queue:permanent-fail')
    ])
    
    // Get processing stats
    const stats = await redis.hgetall('queue:stats') || {}
    
    // Get last run times
    const [lastRun, lastRetry] = await Promise.all([
      redis.get('queue:stats:last_run'),
      redis.get('queue:stats:last_retry')
    ])
    
    const response = {
      queues: {
        aiAgent: {
          pending: aiQueueLength,
          name: 'queue:ai-agent'
        },
        media: {
          pending: mediaQueueLength,
          name: 'queue:media'
        },
        dlq: {
          pending: dlqLength,
          name: 'queue:dlq'
        },
        permanentFail: {
          count: permanentFailLength,
          name: 'queue:permanent-fail'
        }
      },
      stats: {
        mediaProcessed: Number(stats.media_processed) || 0,
        mediaFailed: Number(stats.media_failed) || 0,
        aiProcessed: Number(stats.ai_processed) || 0,
        aiFailed: Number(stats.ai_failed) || 0,
        retryRequeued: Number(stats.retry_requeued) || 0,
        retryPermanentFail: Number(stats.retry_permanent_fail) || 0
      },
      timing: {
        lastRun: lastRun || null,
        lastRetry: lastRetry || null,
        currentTime: new Date().toISOString()
      },
      health: {
        status: dlqLength > 100 ? 'warning' : dlqLength > 500 ? 'critical' : 'healthy',
        totalPending: aiQueueLength + mediaQueueLength,
        dlqPending: dlqLength
      }
    }
    
    console.log(`📊 [QUEUE-STATS] Queues: AI=${aiQueueLength}, Media=${mediaQueueLength}, DLQ=${dlqLength}`)
    
    return new Response(
      JSON.stringify({ success: true, ...response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error(`❌ [QUEUE-STATS] Error:`, error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
