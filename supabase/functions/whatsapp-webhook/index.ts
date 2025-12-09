import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to extract phone number from WhatsApp JID
function extractPhoneNumber(jid: string): string {
  if (!jid) return ''
  return jid.split('@')[0]
}

// Helper to convert Unix timestamp (milliseconds) to ISO string
function convertTimestamp(timestamp: number): string {
  if (!timestamp) return new Date().toISOString()
  return new Date(timestamp).toISOString()
}

// Helper to get file extension from mime type
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    // Audio
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/opus': 'opus',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    // Images
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    // Videos
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
  }
  
  // Handle mime types with codecs (e.g., "audio/ogg; codecs=opus")
  const baseMime = mimeType.split(';')[0].trim().toLowerCase()
  
  // Return from map or derive from mime type
  if (mimeMap[baseMime]) return mimeMap[baseMime]
  
  // Try to extract from mime type (e.g., "image/jpeg" -> "jpeg")
  const typePart = baseMime.split('/')[1]
  if (typePart) {
    if (typePart === 'jpeg') return 'jpg'
    return typePart
  }
  
  return 'bin'
}

// Helper to download media from UAZAPI via POST /message/download with base64
async function downloadMediaFromUazapi(
  messageId: string, 
  uazapiBaseUrl: string, 
  instanceToken: string
): Promise<{ buffer: Uint8Array; mimeType: string; fileSize: number } | null> {
  const downloadUrl = `${uazapiBaseUrl}/message/download`
  
  console.log(`🔽 Downloading media via POST ${downloadUrl}`)
  console.log(`   - messageId: ${messageId}`)
  console.log(`🔑 Token para download: ${instanceToken ? `${instanceToken.substring(0, 10)}... (${instanceToken.length} chars)` : 'VAZIO'}`)
  
  if (!instanceToken) {
    console.log(`❌ Erro: Token vazio! Não é possível fazer download.`)
    return null
  }
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/2...`)
      
      const headers = {
        'Content-Type': 'application/json',
        'token': instanceToken,
      }
      console.log(`📤 Headers: Content-Type=application/json, token=${instanceToken.substring(0, 10)}...`)
      
      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: messageId,
          return_base64: true,
        }),
      })
      
      const responseText = await response.text()
      console.log(`📥 Response status: ${response.status}`)
      
      if (!response.ok) {
        console.log(`❌ Download failed: ${response.status} - ${responseText.substring(0, 200)}`)
        if (attempt === 2) return null
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.log(`❌ Failed to parse response as JSON`)
        if (attempt === 2) return null
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      
      console.log(`📋 Response keys: ${Object.keys(data).join(', ')}`)
      
      // Extract base64 from various possible response structures - UAZAPI uses base64Data
      let base64 = data.base64Data || data.base64 || data.data?.base64 || data.media?.base64
      const mimeType = data.mimetype || data.data?.mimetype || data.media?.mimetype || 'audio/ogg'
      const fileSize = data.fileSize || data.data?.fileSize || data.media?.fileSize || 0
      
      if (!base64) {
        console.log(`❌ base64Data not found in response. Keys: ${JSON.stringify(Object.keys(data))}`)
        if (attempt === 2) return null
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      
      // Remove data URL prefix if present (e.g., "data:audio/ogg;base64,")
      if (base64.includes(',')) {
        base64 = base64.split(',')[1]
      }
      
      // Convert base64 to Uint8Array
      const binaryString = atob(base64)
      const buffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i)
      }
      
      console.log(`✅ Downloaded ${buffer.byteLength} bytes, type: ${mimeType}`)
      return { buffer, mimeType: mimeType.split(';')[0].trim(), fileSize: fileSize || buffer.byteLength }
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} error:`, error)
      if (attempt === 2) return null
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  
  return null
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
    // 1️⃣ PARSE REQUEST
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 1️⃣  PARSING REQUEST                                             │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const rawBody = await req.text()
    console.log(`📦 Body length: ${rawBody.length} characters`)
    
    let payload: any = null
    try {
      payload = JSON.parse(rawBody)
      console.log('✅ JSON parsed successfully')
      
      // DEBUG COMPLETO - Log do payload inteiro
      console.log('🔍 [DEBUG COMPLETO] ==========================================')
      console.log('🔍 [PAYLOAD COMPLETO]:', JSON.stringify(payload, null, 2))
      console.log('🔍 ==========================================')
      
    } catch (e) {
      console.log(`❌ Failed to parse JSON: ${e}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Log payload structure for debugging
    console.log(`🔔 EventType: ${payload.EventType}`)
    console.log(`📱 instanceName: ${payload.instanceName}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ VALIDATIONS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 2️⃣  VALIDATIONS                                                 │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    // Check if it's a message event
    if (payload.EventType !== 'messages') {
      console.log(`ℹ️ Event type "${payload.EventType}" - não é mensagem, ignorando`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event type "${payload.EventType}" ignored (not a message event)` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('✅ EventType = messages')
    
    // Check if it's a group message
    if (payload.message?.isGroup === true) {
      console.log('ℹ️ Mensagem de grupo ignorada')
      return new Response(
        JSON.stringify({ success: true, message: 'Group message ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('✅ Não é mensagem de grupo')
    
    // Check message type - detect the actual type from payload
    const rawMessageType = payload.message?.type
    const messageType = payload.message?.messageType // AudioMessage, ImageMessage, etc.
    const mediaType = payload.message?.mediaType // ptt, audio, image, video, etc.
    const contentMimetype = payload.message?.content?.mimetype || ''
    
    console.log(`📋 Tipo de mensagem:`)
    console.log(`   - type (raw): ${rawMessageType}`)
    console.log(`   - messageType: ${messageType}`)
    console.log(`   - mediaType: ${mediaType}`)
    console.log(`   - content.mimetype: ${contentMimetype}`)
    
    // Detect if it's a media message and identify the subtype
    let isAudioMessage = false
    let isMediaMessage = false
    let detectedSubtype = ''
    let audioContentData: any = null
    
    // Check for AudioMessage (UAZAPI sends messageType = "AudioMessage" for audio)
    const isAudioByMessageType = messageType === 'AudioMessage'
    const isAudioByMediaType = mediaType === 'ptt' || mediaType === 'audio'
    const isAudioByMimetype = typeof contentMimetype === 'string' && contentMimetype.startsWith('audio/')
    
    if (isAudioByMessageType || isAudioByMediaType || isAudioByMimetype) {
      isAudioMessage = true
      isMediaMessage = true
      detectedSubtype = 'audio'
      audioContentData = payload.message?.content || {}
      console.log(`🎵 [ÁUDIO DETECTADO]`)
      console.log(`   - via messageType: ${isAudioByMessageType}`)
      console.log(`   - via mediaType: ${isAudioByMediaType}`)
      console.log(`   - via mimetype: ${isAudioByMimetype}`)
      console.log(`   - content:`, JSON.stringify(audioContentData, null, 2))
    }
    // Check for ImageMessage
    let isImageMessage = false
    let imageContentData: any = null
    
    const isImageByMessageType = messageType === 'ImageMessage'
    const isImageByMediaType = mediaType === 'image'
    const isImageByMimetype = typeof contentMimetype === 'string' && contentMimetype.startsWith('image/')
    
    if (isImageByMessageType || isImageByMediaType || isImageByMimetype) {
      isImageMessage = true
      isMediaMessage = true
      detectedSubtype = 'image'
      imageContentData = payload.message?.content || {}
      console.log(`🖼️ [IMAGEM DETECTADA]`)
      console.log(`   - via messageType: ${isImageByMessageType}`)
      console.log(`   - via mediaType: ${isImageByMediaType}`)
      console.log(`   - via mimetype: ${isImageByMimetype}`)
      console.log(`   - content:`, JSON.stringify(imageContentData, null, 2))
    }
    // Check for VideoMessage
    let isVideoMessage = false
    let videoContentData: any = null
    
    const isVideoByMessageType = messageType === 'VideoMessage'
    const isVideoByMediaType = mediaType === 'video'
    const isVideoByMimetype = typeof contentMimetype === 'string' && contentMimetype.startsWith('video/')
    
    if (isVideoByMessageType || isVideoByMediaType || isVideoByMimetype) {
      isVideoMessage = true
      isMediaMessage = true
      detectedSubtype = 'video'
      videoContentData = payload.message?.content || {}
      console.log(`🎬 [VÍDEO DETECTADO]`)
      console.log(`   - via messageType: ${isVideoByMessageType}`)
      console.log(`   - via mediaType: ${isVideoByMediaType}`)
      console.log(`   - via mimetype: ${isVideoByMimetype}`)
      console.log(`   - content:`, JSON.stringify(videoContentData, null, 2))
    }
    // Check for DocumentMessage
    let isDocumentMessage = false
    let documentContentData: any = null
    
    const isDocumentByMessageType = messageType === 'DocumentMessage' || messageType === 'DocumentWithCaptionMessage'
    const isDocumentByType = rawMessageType === 'document'
    const isDocumentByMediaType = mediaType === 'document'
    
    if (isDocumentByMessageType || isDocumentByType || isDocumentByMediaType) {
      isDocumentMessage = true
      isMediaMessage = true
      detectedSubtype = 'document'
      documentContentData = payload.message?.content || {}
      console.log(`📄 [DOCUMENTO DETECTADO]`)
      console.log(`   - via messageType: ${isDocumentByMessageType}`)
      console.log(`   - via type: ${isDocumentByType}`)
      console.log(`   - via mediaType: ${isDocumentByMediaType}`)
      console.log(`   - content:`, JSON.stringify(documentContentData, null, 2))
    }
    // Check for StickerMessage
    let isStickerMessage = false
    let stickerContentData: any = null
    
    const isStickerByMessageType = messageType === 'StickerMessage'
    const isStickerByType = rawMessageType === 'sticker'
    
    if (isStickerByMessageType || isStickerByType) {
      isStickerMessage = true
      isMediaMessage = true
      detectedSubtype = 'sticker'
      stickerContentData = payload.message?.content || {}
      console.log(`🎨 [STICKER DETECTADO]`)
      console.log(`   - via messageType: ${isStickerByMessageType}`)
      console.log(`   - via type: ${isStickerByType}`)
      console.log(`   - content:`, JSON.stringify(stickerContentData, null, 2))
    }
    // Old detection for backward compatibility: rawMessageType = 'media' with media object
    else if (rawMessageType === 'media') {
      isMediaMessage = true
      const media = payload.message?.media || {}
      const mediaMime = media.mimetype || media.mimeType || ''
      
      if (media.audio || (typeof mediaMime === 'string' && mediaMime.startsWith('audio/'))) {
        isAudioMessage = true
        detectedSubtype = 'audio (legacy media)'
        audioContentData = media.audio || media
        console.log(`🎵 [ÁUDIO via media object]`)
      } else if (media.image || (typeof mediaMime === 'string' && mediaMime.startsWith('image/'))) {
        detectedSubtype = 'image'
      } else if (media.video || (typeof mediaMime === 'string' && mediaMime.startsWith('video/'))) {
        detectedSubtype = 'video'
      } else if (media.document || (typeof mediaMime === 'string' && mediaMime.startsWith('application/'))) {
        detectedSubtype = 'document'
      } else {
        detectedSubtype = 'unknown'
        console.log(`❓ [MÍDIA DESCONHECIDA]`, JSON.stringify(media, null, 2))
      }
    }
    // Direct audio/ptt types (backward compatibility)
    else if (rawMessageType === 'audio' || rawMessageType === 'ptt') {
      isAudioMessage = true
      isMediaMessage = true
      detectedSubtype = rawMessageType
      audioContentData = payload.message?.audio || payload.message?.ptt || payload.message?.content || {}
      console.log(`🎵 [ÁUDIO tipo direto: ${rawMessageType}]`)
    }
    // Text type
    else if (rawMessageType === 'text' || rawMessageType === 'chat') {
      detectedSubtype = 'text'
      console.log(`✅ Tipo texto detectado`)
    }
    // Other unsupported types
    else {
      console.log(`ℹ️ Mensagem tipo "${rawMessageType}" / messageType="${messageType}" ignorada`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Message type "${rawMessageType || messageType}" ignored` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // If it's a media type but not audio, image, video, sticker, or document, save as unsupported
    if (isMediaMessage && !isAudioMessage && !isImageMessage && !isVideoMessage && !isStickerMessage && !isDocumentMessage && detectedSubtype !== 'unknown') {
      console.log(`ℹ️ Mídia tipo "${detectedSubtype}" ainda não implementada`)
      // Continue to save as unsupported media message
    }
    
    // Validate required fields
    const instanceName = payload.instanceName
    const messageId = payload.message?.messageid
    const sender = payload.message?.sender
    const messageText = payload.message?.text
    
    if (!instanceName) {
      console.log('❌ Campo obrigatório faltando: instanceName')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: instanceName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!messageId) {
      console.log('❌ Campo obrigatório faltando: message.messageid')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: message.messageid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!sender) {
      console.log('❌ Campo obrigatório faltando: message.sender')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: message.sender' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // For text messages only, validate text content
    const isTextMessage = !isAudioMessage && !isMediaMessage
    if (isTextMessage && !messageText && messageText !== '') {
      console.log('❌ Campo obrigatório faltando: message.text')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: message.text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Todos os campos obrigatórios presentes')
    console.log(`   - instanceName: ${instanceName}`)
    console.log(`   - messageid: ${messageId}`)
    console.log(`   - sender: ${sender}`)
    console.log(`   - detectedSubtype: ${detectedSubtype}`)
    if (isTextMessage) {
      console.log(`   - text: ${messageText?.substring(0, 50)}${messageText?.length > 50 ? '...' : ''}`)
    }
    if (isAudioMessage && audioContentData) {
      console.log(`   - audioContentData disponível: sim`)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ INITIALIZE SUPABASE CLIENT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3️⃣  SUPABASE CLIENT                                             │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('✅ Supabase client initialized with service role')
    
    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ ETAPA 1: IDENTIFICAR CONEXÃO/EMPRESA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 4️⃣  ETAPA 1: IDENTIFICAR CONEXÃO                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    console.log(`🔍 Buscando conexão com session_id: ${instanceName}`)
    
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('id, company_id, instance_token, uazapi_base_url')
      .eq('session_id', instanceName)
      .maybeSingle()
    
    let defaultDepartmentId: string | null = null
    
    if (connectionError) {
      console.log(`❌ Erro ao buscar conexão: ${connectionError.message}`)
      console.log('📋 Payload completo:', JSON.stringify(payload, null, 2))
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database error while finding connection',
          details: connectionError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!connection) {
      console.log(`❌ Conexão não encontrada para instanceName: ${instanceName}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection not found for instance: ${instanceName}` 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const whatsappConnectionId = connection.id
    const companyId = connection.company_id
    
    // Get instance token - use database value or fallback to payload token
    const dbInstanceToken = connection.instance_token
    const payloadToken = payload.token
    const instanceToken = dbInstanceToken || payloadToken
    
    console.log(`✅ Conexão encontrada!`)
    console.log(`   - whatsapp_connection_id: ${whatsappConnectionId}`)
    console.log(`   - company_id: ${companyId}`)
    console.log(`🔑 Token do banco (instance_token): ${dbInstanceToken ? `${dbInstanceToken.substring(0, 10)}... (${dbInstanceToken.length} chars)` : 'VAZIO/NULL'}`)
    console.log(`🔑 Token do payload: ${payloadToken ? `${payloadToken.substring(0, 10)}... (${payloadToken.length} chars)` : 'VAZIO/NULL'}`)
    console.log(`🔑 Token a ser usado: ${instanceToken ? `${instanceToken.substring(0, 10)}... (${instanceToken.length} chars)` : 'NENHUM'}`)
    
    // If DB token is empty but payload has token, update the connection record
    if (!dbInstanceToken && payloadToken) {
      console.log(`📝 Atualizando instance_token na conexão...`)
      const { error: updateError } = await supabase
        .from('whatsapp_connections')
        .update({ instance_token: payloadToken })
        .eq('id', whatsappConnectionId)
      
      if (updateError) {
        console.log(`⚠️ Falha ao atualizar instance_token: ${updateError.message}`)
      } else {
        console.log(`✅ instance_token atualizado com sucesso!`)
      }
    }
    
    // Buscar departamento padrão da conexão
    const { data: defaultDepartment, error: deptError } = await supabase
      .from('departments')
      .select('id')
      .eq('whatsapp_connection_id', whatsappConnectionId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    
    if (deptError) {
      console.log(`⚠️ Erro ao buscar departamento padrão: ${deptError.message}`)
    } else if (defaultDepartment) {
      defaultDepartmentId = defaultDepartment.id
      console.log(`✅ Departamento padrão encontrado: ${defaultDepartmentId}`)
    } else {
      console.log(`⚠️ Nenhum departamento padrão encontrado para esta conexão`)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ ETAPA 2: CRIAR/ATUALIZAR CONTATO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 5️⃣  ETAPA 2: PROCESSAR CONTATO                                  │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    // Phone number extraction
    let phoneNumber: string
    let source: string

    if (payload.chat?.wa_chatid) {
      phoneNumber = payload.chat.wa_chatid.split('@')[0]
      source = 'chat.wa_chatid'
    } else if (payload.message?.chatid) {
      phoneNumber = payload.message.chatid.split('@')[0]
      source = 'message.chatid'
    } else if (payload.chat?.phone) {
      phoneNumber = payload.chat.phone.replace(/[^\d]/g, '')
      source = 'chat.phone (formatado)'
    } else {
      phoneNumber = extractPhoneNumber(sender)
      source = 'message.sender (FALLBACK)'
    }

    console.log(`📞 Phone number extraído: ${phoneNumber}`)
    console.log(`   - Fonte: ${source}`)
    
    const contactName = payload.chat?.wa_name || payload.message?.senderName || phoneNumber
    console.log(`👤 Nome do contato: ${contactName}`)
    
    // Upsert contact
    console.log('💾 Fazendo UPSERT do contato...')
    
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .upsert(
        {
          company_id: companyId,
          phone_number: phoneNumber,
          name: contactName,
          last_interaction_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'company_id,phone_number',
          ignoreDuplicates: false
        }
      )
      .select('id')
      .single()
    
    if (contactError) {
      console.log(`❌ Erro ao processar contato: ${contactError.message}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error processing contact',
          details: contactError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const contactId = contact.id
    console.log(`✅ Contato processado!`)
    console.log(`   - contact_id: ${contactId}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ ETAPA 3: CRIAR/ATUALIZAR CONVERSA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 6️⃣  ETAPA 3: PROCESSAR CONVERSA                                 │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const isFromMe = payload.message?.fromMe === true
    const messageTimestamp = convertTimestamp(payload.message?.messageTimestamp)
    
    console.log(`🔍 Buscando conversa ativa para contact_id: ${contactId}`)
    
    const { data: existingConversation, error: convSearchError } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('contact_id', contactId)
      .eq('whatsapp_connection_id', whatsappConnectionId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (convSearchError) {
      console.log(`❌ Erro ao buscar conversa: ${convSearchError.message}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error searching conversation',
          details: convSearchError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    let conversationId: string
    
    if (existingConversation) {
      console.log(`📝 Conversa existente encontrada: ${existingConversation.id}`)
      
      const newUnreadCount = isFromMe ? existingConversation.unread_count : (existingConversation.unread_count || 0) + 1
      
      const { error: updateConvError } = await supabase
        .from('conversations')
        .update({
          last_message_at: messageTimestamp,
          unread_count: newUnreadCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConversation.id)
      
      if (updateConvError) {
        console.log(`❌ Erro ao atualizar conversa: ${updateConvError.message}`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error updating conversation',
            details: updateConvError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      conversationId = existingConversation.id
      console.log(`✅ Conversa atualizada!`)
    } else {
      console.log('📝 Nenhuma conversa ativa encontrada, criando nova...')
      
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          company_id: companyId,
          contact_id: contactId,
          whatsapp_connection_id: whatsappConnectionId,
          department_id: defaultDepartmentId,
          status: 'open',
          unread_count: isFromMe ? 0 : 1,
          last_message_at: messageTimestamp,
          channel: 'whatsapp'
        })
        .select('id')
        .single()
      
      if (createConvError) {
        console.log(`❌ Erro ao criar conversa: ${createConvError.message}`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Error creating conversation',
            details: createConvError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      conversationId = newConversation.id
      console.log(`✅ Nova conversa criada: ${conversationId}`)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 7️⃣ ETAPA 4: VERIFICAR DUPLICATA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 7️⃣  ETAPA 4: VERIFICAR DUPLICATA                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    console.log(`🔍 Verificando se mensagem já existe: ${messageId}`)
    
    const { data: existingMessage, error: msgSearchError } = await supabase
      .from('messages')
      .select('id')
      .eq('whatsapp_message_id', messageId)
      .maybeSingle()
    
    if (msgSearchError) {
      console.log(`❌ Erro ao buscar mensagem: ${msgSearchError.message}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error checking for duplicate message',
          details: msgSearchError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (existingMessage) {
      console.log(`⚠️ Mensagem duplicada ignorada - messageid: ${messageId}`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Duplicate message ignored',
          data: { message_id: existingMessage.id, duplicate: true }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Mensagem não é duplicata')
    
    // ═══════════════════════════════════════════════════════════════════
    // 8️⃣ ETAPA 5: PROCESSAR MÍDIA
    // ═══════════════════════════════════════════════════════════════════
    let mediaUrl: string | null = null
    let mediaMimeType: string | null = null
    let mediaMetadata: Record<string, any> = {}
    let unsupportedMediaText: string | null = null
    let documentCaption: string | null = null
    
    // Handle document messages
    if (isDocumentMessage) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 8️⃣  ETAPA 5: PROCESSAR DOCUMENTO                                │')
      console.log('└─────────────────────────────────────────────────────────────────┘')
      
      const docSource = documentContentData || payload.message?.content || {}
      
      console.log(`🔍 [DOCUMENT SOURCE]:`, JSON.stringify(docSource, null, 2))
      
      // Extract document properties from UAZAPI payload
      const mimeType = docSource.mimetype || docSource.mimeType || 'application/octet-stream'
      const fileName = docSource.fileName || docSource.filename || `document_${Date.now()}`
      const fileSize = docSource.fileLength || docSource.fileSize || 0
      const pageCount = docSource.pageCount || 0
      const hasJPEGThumbnail = !!docSource.JPEGThumbnail
      const caption = docSource.caption || null
      
      // Validate file size (max 100MB for documents)
      const MAX_DOC_SIZE = 100 * 1024 * 1024 // 100MB
      if (fileSize > MAX_DOC_SIZE) {
        console.log(`❌ Documento muito grande: ${fileSize} bytes (max: ${MAX_DOC_SIZE})`)
        mediaMetadata = {
          error: 'File too large',
          mimeType,
          fileName,
          fileSize,
          pageCount,
          hasJPEGThumbnail
        }
      } else {
        console.log(`📄 Documento recebido:`)
        console.log(`   - Nome: ${fileName}`)
        console.log(`   - MimeType: ${mimeType}`)
        console.log(`   - Tamanho: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
        console.log(`   - Páginas: ${pageCount || 'N/A'}`)
        console.log(`   - Caption: ${caption || 'Nenhum'}`)
        console.log(`   - Tem thumbnail: ${hasJPEGThumbnail}`)
        console.log(`   - messageId para download: ${messageId}`)
        
        const uazapiBaseUrl = connection.uazapi_base_url || 'https://whatsapi.uazapi.com'
        
        if (!instanceToken) {
          console.log(`⚠️ Token não disponível para download`)
          mediaMetadata = {
            error: 'No instance token available',
            mimeType,
            fileName,
            fileSize,
            pageCount,
            hasJPEGThumbnail
          }
        } else {
          console.log(`📥 Baixando documento via UAZAPI /message/download...`)
          console.log(`   - URL: ${uazapiBaseUrl}/message/download`)
          console.log(`   - messageId: ${messageId}`)
          
          const downloadResult = await downloadMediaFromUazapi(messageId, uazapiBaseUrl, instanceToken)
          
          if (downloadResult) {
            const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult
            const actualMimeType = downloadedMimeType || mimeType.split(';')[0].trim()
            
            // Get extension from fileName or mimeType
            let extension = 'bin'
            if (fileName && fileName.includes('.')) {
              extension = fileName.split('.').pop()?.toLowerCase() || 'bin'
            } else {
              extension = getExtensionFromMimeType(actualMimeType)
            }
            
            // Generate unique filename
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const randomId = Math.random().toString(36).substring(2, 8)
            const uniqueFileName = `document_${Date.now()}_${randomId}.${extension}`
            const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${uniqueFileName}`
            
            console.log(`📤 Fazendo upload para Storage: ${storagePath}`)
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, buffer, {
                contentType: actualMimeType,
                cacheControl: '31536000', // 1 year cache
                upsert: false
              })
            
            if (uploadError) {
              console.log(`❌ Erro no upload: ${uploadError.message}`)
              mediaMetadata = {
                error: 'Upload failed',
                errorMessage: uploadError.message,
                mimeType: actualMimeType,
                fileName,
                fileSize: downloadedSize,
                pageCount,
                hasJPEGThumbnail
              }
            } else {
              console.log(`✅ Upload concluído: ${uploadData.path}`)
              
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('whatsapp-media')
                .getPublicUrl(storagePath)
              
              mediaUrl = publicUrl
              mediaMimeType = actualMimeType
              
              // Set caption as message content
              if (caption) {
                documentCaption = caption
              }
              
              mediaMetadata = {
                fileName,
                originalFileName: fileName,
                fileSize: downloadedSize,
                fileExtension: extension,
                pageCount,
                storagePath,
                originalMessageId: messageId,
                downloadedAt: new Date().toISOString(),
                originalMimetype: mimeType,
                hasJPEGThumbnail,
                hasCaption: !!caption,
                captionLength: caption?.length || 0
              }
              
              console.log(`🔗 URL pública: ${mediaUrl}`)
            }
          } else {
            console.log(`⚠️ Falha no download do documento via UAZAPI`)
            mediaMetadata = {
              error: 'Download failed',
              mimeType,
              fileName,
              fileSize,
              pageCount,
              hasJPEGThumbnail
            }
          }
        }
      }
    }
    // Handle unsupported media types
    else if (isMediaMessage && !isAudioMessage && !isImageMessage && !isVideoMessage && !isStickerMessage && !isDocumentMessage) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 8️⃣  ETAPA 5: MÍDIA NÃO SUPORTADA                                │')
      console.log('└─────────────────────────────────────────────────────────────────┘')
      console.log(`⚠️ Tipo de mídia "${detectedSubtype}" ainda não implementado`)
      unsupportedMediaText = `[Mídia não suportada: ${detectedSubtype}]`
      mediaMetadata = {
        unsupportedType: detectedSubtype,
        originalPayload: payload.message?.media
      }
    }
    // Handle sticker messages
    else if (isStickerMessage) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 8️⃣  ETAPA 5: PROCESSAR STICKER                                  │')
      console.log('└─────────────────────────────────────────────────────────────────┘')
      
      const stickerSource = stickerContentData || payload.message?.content || {}
      
      console.log(`🔍 [STICKER SOURCE]:`, JSON.stringify(stickerSource, null, 2))
      
      // Extract sticker properties from UAZAPI payload
      const mimeType = stickerSource.mimetype || 'image/webp'
      const width = stickerSource.width || 512
      const height = stickerSource.height || 512
      const fileSize = stickerSource.fileLength || stickerSource.fileSize || 0
      const isAnimated = stickerSource.isAnimated || false
      const hasJPEGThumbnail = !!stickerSource.JPEGThumbnail
      
      // Validate file size (max 10MB for stickers)
      const MAX_STICKER_SIZE = 10 * 1024 * 1024 // 10MB
      if (fileSize > MAX_STICKER_SIZE) {
        console.log(`❌ Sticker muito grande: ${fileSize} bytes (max: ${MAX_STICKER_SIZE})`)
        mediaMetadata = {
          error: 'File too large',
          mimeType,
          width,
          height,
          fileSize,
          isAnimated,
          hasJPEGThumbnail
        }
      } else {
        console.log(`🎨 Sticker recebido:`)
        console.log(`   - MimeType: ${mimeType}`)
        console.log(`   - Dimensões: ${width}×${height}`)
        console.log(`   - Tamanho: ${fileSize} bytes (${(fileSize / 1024).toFixed(2)} KB)`)
        console.log(`   - Animado: ${isAnimated}`)
        console.log(`   - Tem thumbnail: ${hasJPEGThumbnail}`)
        console.log(`   - messageId para download: ${messageId}`)
        
        const uazapiBaseUrl = connection.uazapi_base_url || 'https://whatsapi.uazapi.com'
        
        if (!instanceToken) {
          console.log(`⚠️ Token não disponível para download`)
          mediaMetadata = {
            error: 'No instance token available',
            mimeType,
            width,
            height,
            fileSize,
            isAnimated,
            hasJPEGThumbnail
          }
        } else {
          console.log(`📥 Baixando sticker via UAZAPI /message/download...`)
          console.log(`   - URL: ${uazapiBaseUrl}/message/download`)
          console.log(`   - messageId: ${messageId}`)
          
          const downloadResult = await downloadMediaFromUazapi(messageId, uazapiBaseUrl, instanceToken)
          
          if (downloadResult) {
            const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult
            
            // Generate unique filename - stickers are always .webp
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const randomId = Math.random().toString(36).substring(2, 8)
            const fileName = `sticker_${Date.now()}_${randomId}.webp`
            const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${fileName}`
            
            console.log(`📤 Fazendo upload para Storage: ${storagePath}`)
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, buffer, {
                contentType: 'image/webp',
                cacheControl: '31536000', // 1 year cache
                upsert: false
              })
            
            if (uploadError) {
              console.log(`❌ Erro no upload: ${uploadError.message}`)
              mediaMetadata = {
                error: 'Upload failed',
                errorMessage: uploadError.message,
                mimeType: 'image/webp',
                width,
                height,
                fileSize: downloadedSize,
                isAnimated,
                hasJPEGThumbnail
              }
            } else {
              console.log(`✅ Upload concluído: ${uploadData.path}`)
              
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('whatsapp-media')
                .getPublicUrl(storagePath)
              
              mediaUrl = publicUrl
              mediaMimeType = 'image/webp'
              
              mediaMetadata = {
                width,
                height,
                fileSize: downloadedSize,
                fileName,
                storagePath,
                originalMessageId: messageId,
                downloadedAt: new Date().toISOString(),
                originalMimetype: mimeType,
                isAnimated,
                hasJPEGThumbnail,
                stickerType: isAnimated ? 'animated' : 'regular'
              }
              
              console.log(`🔗 URL pública: ${mediaUrl}`)
            }
          } else {
            console.log(`⚠️ Falha no download do sticker via UAZAPI`)
            mediaMetadata = {
              error: 'Download failed',
              mimeType,
              width,
              height,
              fileSize,
              isAnimated,
              hasJPEGThumbnail
            }
          }
        }
      }
    }
    // Handle video messages
    else if (isVideoMessage) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 8️⃣  ETAPA 5: PROCESSAR VÍDEO                                    │')
      console.log('└─────────────────────────────────────────────────────────────────┘')
      
      const videoSource = videoContentData || payload.message?.content || {}
      
      console.log(`🔍 [VIDEO SOURCE]:`, JSON.stringify(videoSource, null, 2))
      
      // Extract video properties from UAZAPI payload
      const mimeType = videoSource.mimetype || 
                      videoSource.mimeType || 
                      'video/mp4'
      const width = videoSource.width || 0
      const height = videoSource.height || 0
      const fileSize = videoSource.fileLength || videoSource.fileSize || 0
      const duration = videoSource.seconds || videoSource.duration || 0
      const hasJPEGThumbnail = !!videoSource.JPEGThumbnail
      
      // Validate file size (max 100MB for videos)
      const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB
      if (fileSize > MAX_VIDEO_SIZE) {
        console.log(`❌ Vídeo muito grande: ${fileSize} bytes (max: ${MAX_VIDEO_SIZE})`)
        mediaMetadata = {
          error: 'File too large',
          mimeType,
          width,
          height,
          duration,
          fileSize,
          hasJPEGThumbnail
        }
      } else {
        console.log(`🎬 Vídeo recebido:`)
        console.log(`   - MimeType: ${mimeType}`)
        console.log(`   - Dimensões: ${width}×${height}`)
        console.log(`   - Duração: ${duration}s`)
        console.log(`   - Tamanho: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
        console.log(`   - Tem thumbnail: ${hasJPEGThumbnail}`)
        console.log(`   - messageId para download: ${messageId}`)
        
        const uazapiBaseUrl = connection.uazapi_base_url || 'https://whatsapi.uazapi.com'
        
        if (!instanceToken) {
          console.log(`⚠️ Token não disponível para download`)
          mediaMetadata = {
            error: 'No instance token available',
            mimeType,
            width,
            height,
            duration,
            fileSize,
            hasJPEGThumbnail
          }
        } else {
          console.log(`📥 Baixando vídeo via UAZAPI /message/download...`)
          console.log(`   - URL: ${uazapiBaseUrl}/message/download`)
          console.log(`   - messageId: ${messageId}`)
          
          const downloadResult = await downloadMediaFromUazapi(messageId, uazapiBaseUrl, instanceToken)
          
          if (downloadResult) {
            const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult
            const actualMimeType = downloadedMimeType.startsWith('video/') ? downloadedMimeType : mimeType.split(';')[0].trim()
            const extension = getExtensionFromMimeType(actualMimeType)
            
            // Generate unique filename
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const randomId = Math.random().toString(36).substring(2, 8)
            const fileName = `video_${Date.now()}_${randomId}.${extension}`
            const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${fileName}`
            
            console.log(`📤 Fazendo upload para Storage: ${storagePath}`)
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, buffer, {
                contentType: actualMimeType,
                cacheControl: '31536000', // 1 year cache
                upsert: false
              })
            
            if (uploadError) {
              console.log(`❌ Erro no upload: ${uploadError.message}`)
              mediaMetadata = {
                error: 'Upload failed',
                errorMessage: uploadError.message,
                mimeType: actualMimeType,
                width,
                height,
                duration,
                fileSize: downloadedSize,
                hasJPEGThumbnail
              }
            } else {
              console.log(`✅ Upload concluído: ${uploadData.path}`)
              
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('whatsapp-media')
                .getPublicUrl(storagePath)
              
              mediaUrl = publicUrl
              mediaMimeType = actualMimeType
              
              // Extract caption if present
              const caption = videoSource.caption || payload.message?.content?.caption || null
              
              mediaMetadata = {
                width,
                height,
                duration,
                fileSize: downloadedSize,
                fileName,
                storagePath,
                originalMessageId: messageId,
                downloadedAt: new Date().toISOString(),
                originalMimetype: mimeType,
                hasJPEGThumbnail,
                hasCaption: !!caption,
                captionLength: caption?.length || 0
              }
              
              console.log(`🔗 URL pública: ${mediaUrl}`)
            }
          } else {
            console.log(`⚠️ Falha no download do vídeo via UAZAPI`)
            mediaMetadata = {
              error: 'Download failed from UAZAPI',
              mimeType,
              width,
              height,
              duration,
              fileSize,
              hasJPEGThumbnail
            }
          }
        }
      }
    }
    // Handle image messages
    else if (isImageMessage) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 8️⃣  ETAPA 5: PROCESSAR IMAGEM                                   │')
      console.log('└─────────────────────────────────────────────────────────────────┘')
      
      const imageSource = imageContentData || payload.message?.content || {}
      
      console.log(`🔍 [IMAGE SOURCE]:`, JSON.stringify(imageSource, null, 2))
      
      // Extract image properties from UAZAPI payload
      const mimeType = imageSource.mimetype || 
                      imageSource.mimeType || 
                      'image/jpeg'
      const width = imageSource.width || 0
      const height = imageSource.height || 0
      const fileSize = imageSource.fileLength || imageSource.fileSize || 0
      const hasJPEGThumbnail = !!imageSource.JPEGThumbnail
      
      // Validate file size (max 50MB)
      const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
      if (fileSize > MAX_FILE_SIZE) {
        console.log(`❌ Imagem muito grande: ${fileSize} bytes (max: ${MAX_FILE_SIZE})`)
        mediaMetadata = {
          error: 'File too large',
          mimeType,
          width,
          height,
          fileSize,
          hasJPEGThumbnail
        }
      } else {
        console.log(`🖼️ Imagem recebida:`)
        console.log(`   - MimeType: ${mimeType}`)
        console.log(`   - Dimensões: ${width}×${height}`)
        console.log(`   - Tamanho: ${fileSize} bytes (${(fileSize / 1024).toFixed(1)} KB)`)
        console.log(`   - Tem thumbnail: ${hasJPEGThumbnail}`)
        console.log(`   - messageId para download: ${messageId}`)
        
        const uazapiBaseUrl = connection.uazapi_base_url || 'https://whatsapi.uazapi.com'
        
        if (!instanceToken) {
          console.log(`⚠️ Token não disponível para download`)
          mediaMetadata = {
            error: 'No instance token available',
            mimeType,
            width,
            height,
            fileSize,
            hasJPEGThumbnail
          }
        } else {
          console.log(`📥 Baixando imagem via UAZAPI /message/download...`)
          console.log(`   - URL: ${uazapiBaseUrl}/message/download`)
          console.log(`   - messageId: ${messageId}`)
          
          const downloadResult = await downloadMediaFromUazapi(messageId, uazapiBaseUrl, instanceToken)
          
          if (downloadResult) {
            const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult
            const actualMimeType = downloadedMimeType.startsWith('image/') ? downloadedMimeType : mimeType.split(';')[0].trim()
            const extension = getExtensionFromMimeType(actualMimeType)
            
            // Generate unique filename
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const randomId = Math.random().toString(36).substring(2, 8)
            const fileName = `image_${Date.now()}_${randomId}.${extension}`
            const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${fileName}`
            
            console.log(`📤 Fazendo upload para Storage: ${storagePath}`)
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, buffer, {
                contentType: actualMimeType,
                cacheControl: '31536000', // 1 year cache for images
                upsert: false
              })
            
            if (uploadError) {
              console.log(`❌ Erro no upload: ${uploadError.message}`)
              mediaMetadata = {
                error: 'Upload failed',
                errorMessage: uploadError.message,
                mimeType: actualMimeType,
                width,
                height,
                fileSize: downloadedSize,
                hasJPEGThumbnail
              }
            } else {
              console.log(`✅ Upload concluído: ${uploadData.path}`)
              
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('whatsapp-media')
                .getPublicUrl(storagePath)
              
              mediaUrl = publicUrl
              mediaMimeType = actualMimeType
              
              // Extract caption if present
              const caption = imageSource.caption || payload.message?.content?.caption || null
              
              mediaMetadata = {
                width,
                height,
                fileSize: downloadedSize,
                fileName,
                storagePath,
                originalMessageId: messageId,
                downloadedAt: new Date().toISOString(),
                originalMimetype: mimeType,
                hasJPEGThumbnail,
                hasCaption: !!caption,
                captionLength: caption?.length || 0
              }
              
              console.log(`🔗 URL pública: ${mediaUrl}`)
            }
          } else {
            console.log(`⚠️ Falha no download da imagem via UAZAPI`)
            mediaMetadata = {
              error: 'Download failed from UAZAPI',
              mimeType,
              width,
              height,
              fileSize,
              hasJPEGThumbnail
            }
          }
        }
      }
    }
    // Handle audio messages
    else if (isAudioMessage) {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 8️⃣  ETAPA 5: PROCESSAR ÁUDIO                                    │')
      console.log('└─────────────────────────────────────────────────────────────────┘')
      
      // Use audioContentData extracted during detection (from message.content)
      // Fallbacks for backward compatibility
      const audioSource = audioContentData || 
                         payload.message?.content || 
                         payload.message?.audio || 
                         payload.message?.ptt || 
                         payload.message?.media || 
                         {}
      
      console.log(`🔍 [AUDIO SOURCE]:`, JSON.stringify(audioSource, null, 2))
      
      // Extract mimetype - UAZAPI sends in content.mimetype (e.g., "audio/ogg; codecs=opus")
      const mimeType = audioSource.mimetype || 
                      audioSource.mimeType || 
                      payload.message?.content?.mimetype ||
                      'audio/ogg'
      
      // Extract duration - UAZAPI sends in content.seconds
      const duration = audioSource.seconds || 
                      audioSource.duration || 
                      payload.message?.content?.seconds || 
                      0
      
      // Extract file size - UAZAPI sends in content.fileLength
      const fileSize = audioSource.fileLength || 
                      audioSource.fileSize || 
                      payload.message?.content?.fileLength || 
                      0
      
      // Check if it's PTT (Push-to-Talk voice message)
      const isPTT = audioSource.PTT === true || 
                   audioSource.ptt === true || 
                   mediaType === 'ptt'
      
      console.log(`🎵 Áudio recebido:`)
      console.log(`   - MimeType: ${mimeType}`)
      console.log(`   - Duração: ${duration}s`)
      console.log(`   - Tamanho: ${fileSize} bytes`)
      console.log(`   - É PTT (voz): ${isPTT}`)
      console.log(`   - messageId para download: ${messageId}`)
      
      // Download via UAZAPI POST /message/download endpoint
      const uazapiBaseUrl = connection.uazapi_base_url || 'https://whatsapi.uazapi.com'
      
      if (!instanceToken) {
        console.log(`⚠️ Token não disponível para download`)
        mediaMetadata = {
          error: 'No instance token available',
          mimeType,
          duration,
          fileSize,
          isPTT
        }
      } else {
        console.log(`📥 Baixando áudio via UAZAPI /message/download...`)
        console.log(`   - URL: ${uazapiBaseUrl}/message/download`)
        console.log(`   - messageId: ${messageId}`)
        
        const downloadResult = await downloadMediaFromUazapi(messageId, uazapiBaseUrl, instanceToken)
        
        if (downloadResult) {
          const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult
          const actualMimeType = downloadedMimeType.startsWith('audio/') ? downloadedMimeType : mimeType.split(';')[0].trim()
          const extension = getExtensionFromMimeType(actualMimeType)
          
          // Generate unique filename
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const randomId = Math.random().toString(36).substring(2, 8)
          const fileName = `audio_${Date.now()}_${randomId}.${extension}`
          const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${fileName}`
          
          console.log(`📤 Fazendo upload para Storage: ${storagePath}`)
          
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('whatsapp-media')
            .upload(storagePath, buffer, {
              contentType: actualMimeType,
              cacheControl: '3600',
              upsert: false
            })
          
          if (uploadError) {
            console.log(`❌ Erro no upload: ${uploadError.message}`)
            mediaMetadata = {
              error: 'Upload failed',
              errorMessage: uploadError.message,
              mimeType: actualMimeType,
              duration,
              fileSize: downloadedSize,
              isPTT
            }
          } else {
            console.log(`✅ Upload concluído: ${uploadData.path}`)
            
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('whatsapp-media')
              .getPublicUrl(storagePath)
            
            mediaUrl = publicUrl
            mediaMimeType = actualMimeType
            mediaMetadata = {
              duration,
              fileSize: downloadedSize,
              fileName,
              storagePath,
              isPTT,
              originalMessageId: messageId,
              downloadedAt: new Date().toISOString()
            }
            
            console.log(`🔗 URL pública: ${mediaUrl}`)
          }
        } else {
          console.log(`⚠️ Falha no download do áudio via UAZAPI`)
          mediaMetadata = {
            error: 'Download failed from UAZAPI',
            mimeType,
            duration,
            fileSize,
            isPTT
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 9️⃣ ETAPA 6: SALVAR MENSAGEM
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 9️⃣  ETAPA 6: SALVAR MENSAGEM                                    │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const direction = isFromMe ? 'outbound' : 'inbound'
    const senderType = isFromMe ? 'user' : 'contact'
    
    // Determine message type for database
    let dbMessageType: string
    if (isAudioMessage) {
      dbMessageType = 'audio'
    } else if (isImageMessage) {
      dbMessageType = 'image'
    } else if (isVideoMessage) {
      dbMessageType = 'video'
    } else if (isStickerMessage) {
      dbMessageType = 'sticker'
    } else if (isDocumentMessage) {
      dbMessageType = 'document'
    } else if (unsupportedMediaText) {
      dbMessageType = 'text' // Save unsupported media as text with placeholder
    } else {
      dbMessageType = 'text'
    }
    
    const status = mediaMetadata.error ? 'failed' : 'delivered'
    
    // Determine content - null for audio/sticker, caption for images/videos, text for everything else
    // For images, extract caption from message.content.caption
    const imageCaption = isImageMessage ? (
      payload.message?.content?.caption || 
      imageContentData?.caption || 
      null
    ) : null
    // For videos, extract caption from message.content.caption
    const videoCaption = isVideoMessage ? (
      payload.message?.content?.caption || 
      videoContentData?.caption || 
      null
    ) : null
    // Stickers never have captions
    const messageContent = unsupportedMediaText || (isAudioMessage || isStickerMessage ? null : (isImageMessage ? imageCaption : (isVideoMessage ? videoCaption : (isDocumentMessage ? documentCaption : messageText))))
    
    console.log(`💾 Salvando mensagem...`)
    console.log(`   - direction: ${direction}`)
    console.log(`   - sender_type: ${senderType}`)
    console.log(`   - message_type: ${dbMessageType}`)
    console.log(`   - status: ${status}`)
    console.log(`   - content: ${messageContent?.substring(0, 50) || '[null]'}`)
    if (mediaUrl) {
      console.log(`   - media_url: ${mediaUrl}`)
    }
    
    const { data: savedMessage, error: saveMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction: direction,
        sender_type: senderType,
        sender_id: null,
        content: messageContent,
        message_type: dbMessageType,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        whatsapp_message_id: messageId,
        status: status,
        error_message: mediaMetadata.error || null,
        metadata: mediaMetadata,
        created_at: messageTimestamp
      })
      .select('id')
      .single()
    
    if (saveMessageError) {
      console.log(`❌ Erro ao salvar mensagem: ${saveMessageError.message}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error saving message',
          details: saveMessageError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`✅ Mensagem salva com sucesso!`)
    console.log(`   - message_id: ${savedMessage.id}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎉 SUCESSO FINAL
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              🎉 WEBHOOK PROCESSADO COM SUCESSO!                  ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.log(`   📱 Instance: ${instanceName}`)
    console.log(`   👤 Contact: ${contactName} (${phoneNumber})`)
    console.log(`   💬 Conversation: ${conversationId}`)
    console.log(`   📨 Message: ${savedMessage.id}`)
    console.log(`   📝 Type: ${dbMessageType}`)
    console.log(`   ⏰ Processed at: ${new Date().toISOString()}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message processed successfully',
        data: {
          contact_id: contactId,
          conversation_id: conversationId,
          message_id: savedMessage.id,
          message_type: dbMessageType,
          media_url: mediaUrl
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ❌ ERRO INESPERADO NO WEBHOOK                       ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.error('Error:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})