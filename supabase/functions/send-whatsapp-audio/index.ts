import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get base URL from secrets (REQUIRED - no fallback)
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL')?.trim() || ''

serve(async (req) => {
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║              🎤 SEND WHATSAPP AUDIO                               ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('ℹ️ CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1️⃣ AUTENTICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 1️⃣  AUTENTICAÇÃO                                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('❌ Missing Authorization header')
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente com token do usuário para verificar auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      console.log('❌ Auth error:', authError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Usuário autenticado:', user.id)

    // Cliente service role para operações no banco
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ PARSE REQUEST BODY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 2️⃣  PARSE REQUEST                                               │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const body = await req.json()
    const { 
      audioData,      // Base64 encoded audio
      fileName,       // Original filename
      mimeType,       // audio/webm, audio/mpeg, etc
      duration,       // Duration in seconds
      conversationId, // UUID
      quotedMessageId // UUID (optional)
    } = body

    console.log('📦 Request:', { 
      audioDataLength: audioData?.length || 0,
      fileName, 
      mimeType, 
      duration,
      conversationId,
      quotedMessageId: quotedMessageId || '(nenhum)'
    })

    if (!audioData || !conversationId) {
      console.log('❌ Missing required fields')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing audioData or conversationId', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ VALIDAÇÕES
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3️⃣  VALIDAÇÕES                                                  │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Decode base64 to get size
    let audioBuffer: Uint8Array
    try {
      // Remove data URL prefix if present
      const base64Data = audioData.includes(',') 
        ? audioData.split(',')[1] 
        : audioData
      
      audioBuffer = base64Decode(base64Data)
      console.log('📊 Tamanho do áudio:', formatBytes(audioBuffer.length))
    } catch (e) {
      console.log('❌ Erro ao decodificar base64:', e)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid audio data', code: 'INVALID_AUDIO' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate size (16MB max)
    const MAX_SIZE = 16 * 1024 * 1024
    if (audioBuffer.length > MAX_SIZE) {
      console.log('❌ Arquivo muito grande:', formatBytes(audioBuffer.length))
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo muito grande. O limite é 16MB.', code: 'FILE_TOO_LARGE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate MIME type
    const validMimeTypes = ['audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a']
    const normalizedMime = mimeType?.split(';')[0]?.trim() || 'audio/webm'
    if (!validMimeTypes.includes(normalizedMime)) {
      console.log('⚠️ MIME type não padrão:', mimeType, '- usando como está')
    }

    console.log('✅ Validações OK')

    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ BUSCAR DADOS DA CONVERSA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 4️⃣  BUSCAR DADOS DA CONVERSA                                    │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        contacts!inner (id, phone_number, name),
        whatsapp_connections!inner (id, session_id, instance_token, status, company_id)
      `)
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      console.log('❌ Conversa não encontrada:', convError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Conversa não encontrada', code: 'CONVERSATION_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Conversa encontrada:', conversation.id)
    console.log('   - contact:', conversation.contacts?.name, conversation.contacts?.phone_number)
    console.log('   - connection status:', conversation.whatsapp_connections?.status)

    // Verify WhatsApp is connected
    if (conversation.whatsapp_connections?.status !== 'connected') {
      console.log('❌ WhatsApp não está conectado')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp desconectado. Reconecte em Configurações.', 
          code: 'WHATSAPP_DISCONNECTED' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const companyId = conversation.whatsapp_connections?.company_id
    const connectionId = conversation.whatsapp_connections?.id
    const instanceToken = conversation.whatsapp_connections?.instance_token
    const phoneNumber = conversation.contacts?.phone_number

    if (!instanceToken) {
      console.log('❌ Instance token não encontrado')
      return new Response(
        JSON.stringify({ success: false, error: 'Conexão sem token válido', code: 'MISSING_TOKEN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ UPLOAD PARA STORAGE
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 5️⃣  UPLOAD PARA STORAGE                                         │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    
    // Determine extension based on MIME type
    const extMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/aac': 'aac',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
    }
    const ext = extMap[normalizedMime] || 'webm'
    
    const storagePath = `${companyId}/${connectionId}/${yearMonth}/audio_${timestamp}_${randomSuffix}.${ext}`

    console.log('📤 Upload para Storage...')
    console.log('   - path:', storagePath)
    console.log('   - size:', formatBytes(audioBuffer.length))

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, audioBuffer, {
        contentType: normalizedMime,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.log('❌ Erro no upload:', uploadError.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao fazer upload do áudio', code: 'UPLOAD_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    const mediaUrl = publicUrlData.publicUrl
    console.log('✅ Upload OK:', mediaUrl)

    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ SALVAR MENSAGEM NO BANCO (PENDING)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 6️⃣  SALVAR MENSAGEM NO BANCO                                    │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const messageData = {
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'user',
      sender_id: user.id,
      message_type: 'audio',
      content: null,
      media_url: mediaUrl,
      media_mime_type: normalizedMime,
      quoted_message_id: quotedMessageId || null,
      status: 'pending',
      metadata: {
        duration: duration || 0,
        fileSize: audioBuffer.length,
        fileName: fileName || `audio_${timestamp}.${ext}`,
        storagePath,
        isPTT: true, // Push-to-talk voice message
      }
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single()

    if (messageError) {
      console.log('❌ Erro ao salvar mensagem:', messageError.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao salvar mensagem', code: 'MESSAGE_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Mensagem salva:', message.id)

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // ═══════════════════════════════════════════════════════════════════
    // 7️⃣ ENVIAR VIA UAZAPI
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 7️⃣  ENVIAR VIA UAZAPI                                           │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Clean phone number
    const cleanPhoneNumber = phoneNumber?.replace(/[^\d]/g, '') || ''
    
    if (!cleanPhoneNumber) {
      console.log('❌ Número do contato inválido')
      await updateMessageStatus(supabase, message.id, 'failed', 'Número do contato inválido')
      return new Response(
        JSON.stringify({ success: false, error: 'Número do contato inválido', code: 'INVALID_NUMBER', messageId: message.id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get replyid if quoting a message
    let replyId: string | null = null
    if (quotedMessageId) {
      console.log('🔍 Buscando whatsapp_message_id da mensagem citada...')
      const { data: quotedMessage } = await supabase
        .from('messages')
        .select('whatsapp_message_id')
        .eq('id', quotedMessageId)
        .maybeSingle()
      
      if (quotedMessage?.whatsapp_message_id) {
        const fullId = quotedMessage.whatsapp_message_id
        replyId = fullId.includes(':') ? fullId.split(':').pop()! : fullId
        console.log(`✅ replyId encontrado: ${replyId}`)
      } else {
        console.log('⚠️ Mensagem citada não tem whatsapp_message_id')
      }
    }

    // Build UAZAPI payload
    const uazapiPayload: { number: string; type: string; file: string; replyid?: string } = {
      number: cleanPhoneNumber,
      type: 'ptt', // Push-to-talk (voice message)
      file: mediaUrl
    }

    if (replyId) {
      uazapiPayload.replyid = replyId
    }

    console.log('📤 UAZAPI Request:')
    console.log('   - URL:', `${UAZAPI_BASE_URL}/send/media`)
    console.log('   - token: ***' + instanceToken.slice(-8))
    console.log('   - number:', cleanPhoneNumber)
    console.log('   - type:', 'ptt')
    console.log('   - file:', mediaUrl)
    console.log('   - replyid:', replyId || '(nenhum)')

    const uazapiResponse = await fetch(`${UAZAPI_BASE_URL}/send/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instanceToken
      },
      body: JSON.stringify(uazapiPayload)
    })

    const responseText = await uazapiResponse.text()
    console.log('📥 UAZAPI Response status:', uazapiResponse.status)
    console.log('📥 UAZAPI Response body:', responseText.substring(0, 500))

    let uazapiData: any = null
    try {
      uazapiData = JSON.parse(responseText)
    } catch (e) {
      console.log('⚠️ Response não é JSON válido')
    }

    if (!uazapiResponse.ok) {
      const errorMsg = uazapiData?.message || uazapiData?.error || `HTTP ${uazapiResponse.status}`
      console.log('❌ Erro UAZAPI:', errorMsg)
      await updateMessageStatus(supabase, message.id, 'failed', errorMsg)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao enviar: ${errorMsg}`, 
          code: 'UAZAPI_ERROR',
          messageId: message.id 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Áudio enviado com sucesso!')

    // ═══════════════════════════════════════════════════════════════════
    // 8️⃣ ATUALIZAR STATUS DA MENSAGEM
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 8️⃣  ATUALIZAR STATUS DA MENSAGEM                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Extract whatsapp_message_id from response
    const whatsappMessageId = uazapiData?.id || 
                              uazapiData?.key?.id || 
                              uazapiData?.messageid ||
                              uazapiData?.message?.id ||
                              null

    console.log('   - whatsapp_message_id:', whatsappMessageId || '(não retornado)')

    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        status: 'sent',
        whatsapp_message_id: whatsappMessageId
      })
      .eq('id', message.id)

    if (updateError) {
      console.log('⚠️ Erro ao atualizar status:', updateError.message)
    } else {
      console.log('✅ Status atualizado para: sent')
    }

    // ═══════════════════════════════════════════════════════════════════
    // ✅ RESPOSTA DE SUCESSO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ✅ ÁUDIO ENVIADO COM SUCESSO!                       ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝\n')

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: message.id,
        status: 'sent',
        mediaUrl,
        whatsappMessageId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.log('❌ Erro geral:', error.message)
    console.log('Stack:', error.stack)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to update message status
async function updateMessageStatus(
  supabase: any, 
  messageId: string, 
  status: string, 
  errorMessage?: string
) {
  const updateData: any = { status }
  if (errorMessage) {
    updateData.error_message = errorMessage
  }
  
  await supabase
    .from('messages')
    .update(updateData)
    .eq('id', messageId)
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
