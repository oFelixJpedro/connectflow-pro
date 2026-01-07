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
// QUEUE RETRY - Reprocess failed items from DLQ
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  console.log(`🔄 [QUEUE-RETRY] Starting retry processing...`)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const stats = {
    requeued: 0,
    permanentlyFailed: 0,
    startTime: Date.now()
  }
  
  try {
    const dlqKey = 'queue:dlq'
    
    // Get DLQ length
    const dlqLength = await redis.llen(dlqKey)
    console.log(`📥 [QUEUE-RETRY] DLQ has ${dlqLength} items`)
    
    if (dlqLength === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'DLQ is empty', stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Process up to 20 items from DLQ
    const items = await redis.lrange(dlqKey, 0, 19)
    
    for (const rawItem of items) {
      try {
        const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem
        
        // Check if item is too old (more than 1 hour)
        const failedAt = item.failedAt ? new Date(item.failedAt).getTime() : 0
        const ageMs = Date.now() - failedAt
        const maxAgeMs = 60 * 60 * 1000 // 1 hour
        
        if (ageMs > maxAgeMs) {
          // Item is too old, move to permanent fail log
          await redis.rpush('queue:permanent-fail', JSON.stringify({
            ...item,
            permanentFailedAt: new Date().toISOString(),
            reason: 'Exceeded max age (1 hour)'
          }))
          await redis.lrem(dlqKey, 1, rawItem)
          stats.permanentlyFailed++
          console.log(`💀 [QUEUE-RETRY] Item permanently failed (too old)`)
          continue
        }
        
        // Reset attempts and requeue to appropriate queue
        const targetQueue = item.type === 'ai-agent' ? 'queue:ai-agent' : 'queue:media'
        
        await redis.rpush(targetQueue, JSON.stringify({
          ...item,
          attempts: 0, // Reset attempts
          requeuedAt: new Date().toISOString(),
          requeuedFrom: 'dlq'
        }))
        
        await redis.lrem(dlqKey, 1, rawItem)
        stats.requeued++
        console.log(`♻️ [QUEUE-RETRY] Item requeued to ${targetQueue}`)
        
      } catch (err) {
        console.error(`❌ [QUEUE-RETRY] Error processing item:`, err)
      }
    }
    
    // Update stats
    await redis.hincrby('queue:stats', 'retry_requeued', stats.requeued)
    await redis.hincrby('queue:stats', 'retry_permanent_fail', stats.permanentlyFailed)
    await redis.set('queue:stats:last_retry', new Date().toISOString())
    
    const duration = Date.now() - stats.startTime
    
    console.log(`✅ [QUEUE-RETRY] Completed in ${duration}ms`)
    console.log(`   Requeued: ${stats.requeued}`)
    console.log(`   Permanently failed: ${stats.permanentlyFailed}`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        stats: {
          ...stats,
          durationMs: duration
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error(`❌ [QUEUE-RETRY] Fatal error:`, error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
