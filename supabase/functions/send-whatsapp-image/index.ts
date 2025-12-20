import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║              📷 SEND-WHATSAPP-IMAGE - INICIADA                   ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get auth user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('❌ Erro: Authorization header ausente')
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { 
      imageData, 
      fileName, 
      mimeType, 
      conversationId, 
      connectionId, 
      contactPhoneNumber, 
      caption,
      quotedMessageId 
    } = body

    console.log('📥 Dados recebidos:')
    console.log(`   - fileName: ${fileName}`)
    console.log(`   - mimeType: ${mimeType}`)
    console.log(`   - conversationId: ${conversationId}`)
    console.log(`   - connectionId: ${connectionId}`)
    console.log(`   - contactPhoneNumber: ${contactPhoneNumber}`)
    console.log(`   - caption: ${caption ? caption.substring(0, 50) + '...' : '(sem legenda)'}`)
    console.log(`   - quotedMessageId: ${quotedMessageId || '(nenhum)'}`)

    // Validate required fields
    if (!imageData || !fileName || !mimeType || !conversationId || !connectionId || !contactPhoneNumber) {
      console.log('❌ Erro: Campos obrigatórios ausentes')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate mime type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedMimeTypes.includes(mimeType)) {
      console.log(`❌ Erro: Tipo MIME não suportado: ${mimeType}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Formato não suportado. Use JPG, PNG, GIF ou WebP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.log('❌ Erro: Usuário não autenticado')
      return new Response(
        JSON.stringify({ success: false, error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Usuário autenticado: ${user.id}`)

    // Get connection details
    console.log('\n🔍 Buscando dados da conexão...')
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('id, company_id, instance_token, status')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      console.log(`❌ Erro: Conexão não encontrada: ${connectionError?.message}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Conexão encontrada: ${connection.id}`)
    console.log(`   - company_id: ${connection.company_id}`)
    console.log(`   - status: ${connection.status}`)

    if (connection.status !== 'connected') {
      console.log(`❌ Erro: WhatsApp desconectado`)
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp desconectado. Reconecte para enviar mensagens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const instanceToken = connection.instance_token
    if (!instanceToken) {
      console.log(`❌ Erro: Instance token não encontrado`)
      return new Response(
        JSON.stringify({ success: false, error: 'Instance token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get UAZAPI base URL from secrets
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL')
    if (!uazapiBaseUrl) {
      console.log(`❌ Erro: UAZAPI_BASE_URL não configurada nos secrets`)
      return new Response(
        JSON.stringify({ success: false, error: 'UAZAPI_BASE_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log(`✅ UAZAPI_BASE_URL: ${uazapiBaseUrl}`)

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Upload image to Storage
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 1️⃣  UPLOAD PARA STORAGE                                         │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Decode base64
    let imageBuffer: Uint8Array
    try {
      // Remove data URL prefix if present
      let base64Data = imageData
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1]
      }
      
      const binaryString = atob(base64Data)
      imageBuffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        imageBuffer[i] = binaryString.charCodeAt(i)
      }
      console.log(`✅ Base64 decodificado: ${imageBuffer.byteLength} bytes`)
    } catch (e) {
      console.log(`❌ Erro ao decodificar base64: ${e}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid image data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (imageBuffer.byteLength > maxSize) {
      console.log(`❌ Erro: Arquivo muito grande: ${imageBuffer.byteLength} bytes`)
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo muito grande. O limite é 50MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate storage path
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg'
    const storagePath = `${connection.company_id}/${connectionId}/${yearMonth}/image_${timestamp}_${random}.${extension}`

    console.log(`📁 Storage path: ${storagePath}`)

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, imageBuffer, {
        contentType: mimeType,
        upsert: false
      })

    if (uploadError) {
      console.log(`❌ Erro no upload: ${uploadError.message}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao fazer upload da imagem. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Upload concluído: ${uploadData.path}`)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    const mediaUrl = urlData.publicUrl
    console.log(`✅ URL pública: ${mediaUrl}`)

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Save message to database (pending status)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 2️⃣  SALVANDO MENSAGEM NO BANCO (PENDING)                        │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const messageMetadata = {
      fileSize: imageBuffer.byteLength,
      fileName: fileName,
      hasCaption: !!caption,
      storagePath: storagePath,
      originalFileName: fileName
    }

    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'user',
        sender_id: user.id,
        message_type: 'image',
        content: caption || null,
        media_url: mediaUrl,
        media_mime_type: mimeType,
        quoted_message_id: quotedMessageId || null,
        status: 'pending',
        metadata: messageMetadata
      })
      .select('id')
      .single()

    if (messageError) {
      console.log(`❌ Erro ao salvar mensagem: ${messageError.message}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao salvar mensagem no banco.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const messageId = messageData.id
    console.log(`✅ Mensagem salva: ${messageId}`)

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Send to UAZAPI
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3️⃣  ENVIANDO PARA UAZAPI                                        │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Clean phone number
    const cleanPhoneNumber = contactPhoneNumber.replace(/[^\d]/g, '')
    console.log(`📞 Número limpo: ${cleanPhoneNumber}`)

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

    // Prepare UAZAPI payload
    const uazapiPayload: { number: string; type: string; file: string; text?: string; replyid?: string } = {
      number: cleanPhoneNumber,
      type: 'image',
      file: mediaUrl
    }

    if (caption && caption.trim()) {
      uazapiPayload.text = caption.trim()
    }

    if (replyId) {
      uazapiPayload.replyid = replyId
    }

    console.log(`📤 Payload UAZAPI:`)
    console.log(`   - number: ${uazapiPayload.number}`)
    console.log(`   - type: ${uazapiPayload.type}`)
    console.log(`   - file: ${uazapiPayload.file.substring(0, 50)}...`)
    console.log(`   - text: ${uazapiPayload.text || '(sem legenda)'}`)
    console.log(`   - replyid: ${replyId || '(nenhum)'}`)

    const uazapiUrl = `${uazapiBaseUrl}/send/media`
    console.log(`📨 POST ${uazapiUrl}`)

    let uazapiResponse
    let uazapiResponseText = ''
    let uazapiSuccess = false
    let whatsappMessageId: string | null = null

    try {
      uazapiResponse = await fetch(uazapiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'token': instanceToken
        },
        body: JSON.stringify(uazapiPayload)
      })

      uazapiResponseText = await uazapiResponse.text()
      console.log(`📥 Response status: ${uazapiResponse.status}`)
      console.log(`📥 Response: ${uazapiResponseText.substring(0, 500)}`)

      if (uazapiResponse.ok) {
        try {
          const uazapiData = JSON.parse(uazapiResponseText)
          whatsappMessageId = uazapiData?.key?.id || uazapiData?.id || null
          uazapiSuccess = true
          console.log(`✅ Enviado com sucesso! whatsapp_message_id: ${whatsappMessageId}`)
        } catch (e) {
          // Response OK but not JSON - still consider success
          uazapiSuccess = true
          console.log(`✅ Enviado com sucesso! (resposta não-JSON)`)
        }
      } else {
        console.log(`❌ Erro UAZAPI: ${uazapiResponse.status}`)
      }
    } catch (e) {
      console.log(`❌ Erro ao chamar UAZAPI: ${e}`)
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Update message status
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 4️⃣  ATUALIZANDO STATUS DA MENSAGEM                              │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    if (uazapiSuccess) {
      const updateData: any = { status: 'sent' }
      if (whatsappMessageId) {
        updateData.whatsapp_message_id = whatsappMessageId
      }

      await supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageId)

      console.log(`✅ Status atualizado para 'sent'`)

      // ═══════════════════════════════════════════════════════════════════
      // STEP 5: Disparar Commercial Pixel (Background)
      // ═══════════════════════════════════════════════════════════════════
      console.log('\n┌─────────────────────────────────────────────────────────────────┐')
      console.log('│ 5️⃣  DISPARAR COMMERCIAL PIXEL                                   │')
      console.log('└─────────────────────────────────────────────────────────────────┘')

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      // Disparar Commercial Pixel em background (não bloqueia a resposta)
      fetch(`${supabaseUrl}/functions/v1/commercial-pixel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          company_id: connection.company_id,
          message_content: caption || '[Imagem]',
          message_type: 'image',
          direction: 'outbound',
          contact_name: 'Contato'
        }),
      })
        .then(res => console.log('📊 [PIXEL] Commercial Pixel disparado:', res.status))
        .catch(e => console.log('⚠️ [PIXEL] Erro ao disparar Commercial Pixel:', e.message))

      console.log('\n╔══════════════════════════════════════════════════════════════════╗')
      console.log('║              🎉 IMAGEM ENVIADA COM SUCESSO!                      ║')
      console.log('╚══════════════════════════════════════════════════════════════════╝')

      return new Response(
        JSON.stringify({
          success: true,
          messageId: messageId,
          status: 'sent',
          mediaUrl: mediaUrl,
          whatsappMessageId: whatsappMessageId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          metadata: {
            ...messageMetadata,
            error: uazapiResponseText.substring(0, 500)
          }
        })
        .eq('id', messageId)

      console.log(`❌ Status atualizado para 'failed'`)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao enviar imagem para o WhatsApp.',
          messageId: messageId,
          status: 'failed'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
