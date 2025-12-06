import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const timestamp = new Date().toISOString()
  
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║              📨 WEBHOOK RECEIVED - WHATSAPP-WEBHOOK              ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log(`⏰ Timestamp: ${timestamp}`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('ℹ️ CORS preflight request - returning 200')
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    console.log(`❌ Method not allowed: ${req.method}`)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Method not allowed',
        message: `Expected POST, received ${req.method}`
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
  
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1️⃣ REQUEST INFO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 1️⃣  REQUEST INFO                                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    console.log(`📍 URL: ${req.url}`)
    console.log(`📝 Method: ${req.method}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ HEADERS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 2️⃣  HEADERS                                                     │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
      console.log(`   ${key}: ${value}`)
    })
    
    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ RAW BODY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3️⃣  RAW BODY                                                    │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const rawBody = await req.text()
    console.log(`📦 Body length: ${rawBody.length} characters`)
    console.log('📄 Raw body:')
    console.log(rawBody)
    
    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ PARSED JSON
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 4️⃣  PARSED JSON                                                 │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    let payload: any = null
    let parseError: string | null = null
    
    try {
      payload = JSON.parse(rawBody)
      console.log('✅ JSON parsed successfully!')
      console.log('📋 Formatted JSON:')
      console.log(JSON.stringify(payload, null, 2))
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e)
      console.log(`⚠️ Failed to parse JSON: ${parseError}`)
      console.log('📄 Treating as plain text')
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ EVENT TYPE DETECTION
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 5️⃣  EVENT TYPE DETECTION                                        │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    let eventType = 'unknown'
    let instanceName = 'unknown'
    
    if (payload) {
      // Try to find event type
      eventType = payload.event || payload.type || payload.eventType || payload.action || 'unknown'
      console.log(`🏷️ Event type field: ${eventType}`)
      
      // Try to find instance name
      instanceName = payload.instance || payload.instanceName || payload.instance_name || 
                     payload.data?.instance || payload.data?.instanceName || 'unknown'
      console.log(`📱 Instance name: ${instanceName}`)
      
      // List top-level keys
      console.log('\n📌 Top-level keys in payload:')
      Object.keys(payload).forEach(key => {
        const value = payload[key]
        const valueType = typeof value
        const preview = valueType === 'object' ? 
          (Array.isArray(value) ? `Array[${value.length}]` : 'Object{...}') : 
          String(value).substring(0, 50)
        console.log(`   - ${key}: (${valueType}) ${preview}`)
      })
      
      // If there's a data object, list its keys too
      if (payload.data && typeof payload.data === 'object') {
        console.log('\n📌 Keys in payload.data:')
        Object.keys(payload.data).forEach(key => {
          const value = payload.data[key]
          const valueType = typeof value
          const preview = valueType === 'object' ? 
            (Array.isArray(value) ? `Array[${value.length}]` : 'Object{...}') : 
            String(value).substring(0, 50)
          console.log(`   - ${key}: (${valueType}) ${preview}`)
        })
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ EVENT-SPECIFIC ANALYSIS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 6️⃣  EVENT-SPECIFIC ANALYSIS                                     │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    if (payload) {
      const eventLower = eventType.toLowerCase()
      
      // ─────────────────────────────────────────────────────────────────
      // MESSAGE EVENTS
      // ─────────────────────────────────────────────────────────────────
      if (eventLower.includes('message')) {
        console.log('💬 MESSAGE EVENT DETECTED')
        console.log('─────────────────────────────────────────────────────────────────')
        
        const data = payload.data || payload
        const message = data.message || data.messages?.[0] || data
        const key = message.key || data.key || {}
        
        console.log(`   📱 Instance: ${instanceName}`)
        console.log(`   👤 Remote JID: ${key.remoteJid || data.remoteJid || data.from || 'N/A'}`)
        console.log(`   🔄 From me: ${key.fromMe ?? data.fromMe ?? 'N/A'}`)
        console.log(`   🆔 Message ID: ${key.id || data.id || message.id || 'N/A'}`)
        console.log(`   ⏰ Timestamp: ${message.messageTimestamp || data.timestamp || 'N/A'}`)
        console.log(`   📝 Push name: ${data.pushName || message.pushName || 'N/A'}`)
        
        // Try to extract message content
        const msgContent = message.message || message.content || message
        if (msgContent) {
          console.log('\n   📨 Message content:')
          if (msgContent.conversation) {
            console.log(`      Text: ${msgContent.conversation}`)
          } else if (msgContent.extendedTextMessage) {
            console.log(`      Extended text: ${msgContent.extendedTextMessage.text}`)
          } else if (msgContent.imageMessage) {
            console.log(`      Type: Image`)
            console.log(`      Caption: ${msgContent.imageMessage.caption || 'N/A'}`)
            console.log(`      Mimetype: ${msgContent.imageMessage.mimetype || 'N/A'}`)
          } else if (msgContent.videoMessage) {
            console.log(`      Type: Video`)
            console.log(`      Caption: ${msgContent.videoMessage.caption || 'N/A'}`)
          } else if (msgContent.audioMessage) {
            console.log(`      Type: Audio`)
            console.log(`      Duration: ${msgContent.audioMessage.seconds || 'N/A'}s`)
          } else if (msgContent.documentMessage) {
            console.log(`      Type: Document`)
            console.log(`      Filename: ${msgContent.documentMessage.fileName || 'N/A'}`)
          } else if (msgContent.stickerMessage) {
            console.log(`      Type: Sticker`)
          } else if (msgContent.locationMessage) {
            console.log(`      Type: Location`)
            console.log(`      Lat: ${msgContent.locationMessage.degreesLatitude}`)
            console.log(`      Long: ${msgContent.locationMessage.degreesLongitude}`)
          } else if (msgContent.contactMessage) {
            console.log(`      Type: Contact`)
            console.log(`      Display name: ${msgContent.contactMessage.displayName || 'N/A'}`)
          } else if (typeof msgContent === 'string') {
            console.log(`      Text: ${msgContent}`)
          } else {
            console.log(`      Raw content type: ${Object.keys(msgContent).join(', ')}`)
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────
      // CONNECTION EVENTS
      // ─────────────────────────────────────────────────────────────────
      else if (eventLower.includes('connection') || eventLower.includes('status')) {
        console.log('🔌 CONNECTION EVENT DETECTED')
        console.log('─────────────────────────────────────────────────────────────────')
        
        const data = payload.data || payload
        const status = data.status || payload.status || {}
        const instance = data.instance || payload.instance || {}
        
        console.log(`   📱 Instance: ${instanceName}`)
        console.log(`   📊 State: ${data.state || status.state || instance.state || 'N/A'}`)
        console.log(`   🔗 Connected: ${status.connected ?? data.connected ?? 'N/A'}`)
        console.log(`   🔐 Logged in: ${status.loggedIn ?? data.loggedIn ?? 'N/A'}`)
        console.log(`   📞 Owner/Phone: ${instance.owner || data.owner || data.phone || 'N/A'}`)
        console.log(`   ❌ Disconnect reason: ${instance.lastDisconnectReason || data.reason || 'N/A'}`)
        
        if (typeof status === 'object') {
          console.log('\n   📋 Full status object:')
          console.log(JSON.stringify(status, null, 2).split('\n').map(l => '      ' + l).join('\n'))
        }
      }
      // ─────────────────────────────────────────────────────────────────
      // QR CODE EVENTS
      // ─────────────────────────────────────────────────────────────────
      else if (eventLower.includes('qr')) {
        console.log('📱 QR CODE EVENT DETECTED')
        console.log('─────────────────────────────────────────────────────────────────')
        
        const data = payload.data || payload
        const qrCode = data.qrcode || data.qr || data.base64 || payload.qrcode || ''
        
        console.log(`   📱 Instance: ${instanceName}`)
        console.log(`   🔲 QR Code present: ${qrCode ? 'YES' : 'NO'}`)
        console.log(`   📏 QR Code length: ${qrCode.length} characters`)
        
        if (qrCode && qrCode.length > 0) {
          console.log(`   🔍 QR Code preview: ${qrCode.substring(0, 50)}...`)
        }
      }
      // ─────────────────────────────────────────────────────────────────
      // UNKNOWN EVENTS
      // ─────────────────────────────────────────────────────────────────
      else {
        console.log('❓ UNKNOWN EVENT TYPE')
        console.log('─────────────────────────────────────────────────────────────────')
        console.log(`   🏷️ Event: ${eventType}`)
        console.log(`   📱 Instance: ${instanceName}`)
        console.log('\n   📋 Full payload:')
        console.log(JSON.stringify(payload, null, 2).split('\n').map(l => '      ' + l).join('\n'))
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 7️⃣ SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 7️⃣  SUMMARY                                                     │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    console.log(`   ✅ Event received successfully`)
    console.log(`   🏷️ Event type: ${eventType}`)
    console.log(`   📱 Instance: ${instanceName}`)
    console.log(`   📦 Payload size: ${rawBody.length} bytes`)
    console.log(`   ⏰ Processed at: ${new Date().toISOString()}`)
    
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ✅ WEBHOOK PROCESSING COMPLETE                     ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.log('\n')
    
    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook received and logged successfully',
        eventType: eventType,
        instance: instanceName,
        timestamp: timestamp
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    // ═══════════════════════════════════════════════════════════════════
    // ❌ ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ❌ ERROR PROCESSING WEBHOOK                         ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : 'No stack trace'
    
    console.log(`❌ Error message: ${errorMessage}`)
    console.log(`📚 Stack trace:`)
    console.log(errorStack)
    console.log('\n')
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
