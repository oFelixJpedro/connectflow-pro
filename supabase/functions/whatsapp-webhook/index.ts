import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to extract phone number from WhatsApp JID
function extractPhoneNumber(jid: string): string {
  if (!jid) return ''
  // Remove @s.whatsapp.net, @c.us, etc.
  return jid.split('@')[0]
}

// Helper to convert Unix timestamp (milliseconds) to ISO string
function convertTimestamp(timestamp: number): string {
  if (!timestamp) return new Date().toISOString()
  // UAZAPI sends timestamp in milliseconds
  return new Date(timestamp).toISOString()
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
    
    // Check message type - only process text for now
    const messageType = payload.message?.type
    if (messageType !== 'text') {
      console.log(`ℹ️ Mensagem tipo "${messageType}" ignorada (processando apenas texto)`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Message type "${messageType}" ignored (processing text only)` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('✅ Tipo = text')
    
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
    
    if (!messageText && messageText !== '') {
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
    console.log(`   - text: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`)
    
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
      .select('id, company_id')
      .eq('session_id', instanceName)
      .maybeSingle()
    
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
    
    console.log(`✅ Conexão encontrada!`)
    console.log(`   - whatsapp_connection_id: ${whatsappConnectionId}`)
    console.log(`   - company_id: ${companyId}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ ETAPA 2: CRIAR/ATUALIZAR CONTATO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 5️⃣  ETAPA 2: PROCESSAR CONTATO                                  │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    // Extract phone number - prioritize chat.owner (always correct) over sender (can have @lid format)
    const phoneNumber = payload.chat?.owner || extractPhoneNumber(sender)
    console.log(`📞 Phone number extraído: ${phoneNumber}`)
    console.log(`   - Fonte: ${payload.chat?.owner ? 'chat.owner' : 'message.sender'}`)
    
    // Extract contact name
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
      console.log('📋 Payload completo:', JSON.stringify(payload, null, 2))
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
    console.log(`   - phone: ${phoneNumber}`)
    console.log(`   - name: ${contactName}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ ETAPA 3: CRIAR/ATUALIZAR CONVERSA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 6️⃣  ETAPA 3: PROCESSAR CONVERSA                                 │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const isFromMe = payload.message?.fromMe === true
    const messageTimestamp = convertTimestamp(payload.message?.messageTimestamp)
    
    console.log(`🔍 Buscando conversa ativa para contact_id: ${contactId}`)
    
    // Find existing open conversation
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
      // Update existing conversation
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
      console.log(`   - conversation_id: ${conversationId}`)
      console.log(`   - unread_count: ${newUnreadCount}`)
    } else {
      // Create new conversation
      console.log('📝 Nenhuma conversa ativa encontrada, criando nova...')
      
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          company_id: companyId,
          contact_id: contactId,
          whatsapp_connection_id: whatsappConnectionId,
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
      console.log(`✅ Nova conversa criada!`)
      console.log(`   - conversation_id: ${conversationId}`)
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
          data: {
            message_id: existingMessage.id,
            duplicate: true
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Mensagem não é duplicata')
    
    // ═══════════════════════════════════════════════════════════════════
    // 8️⃣ ETAPA 5: SALVAR MENSAGEM
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 8️⃣  ETAPA 5: SALVAR MENSAGEM                                    │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    // Define direction and sender_type based on fromMe
    const direction = isFromMe ? 'outbound' : 'inbound'
    const senderType = isFromMe ? 'user' : 'contact'
    
    console.log(`💾 Salvando mensagem...`)
    console.log(`   - direction: ${direction}`)
    console.log(`   - sender_type: ${senderType}`)
    console.log(`   - content: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`)
    
    const { data: savedMessage, error: saveMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction: direction,
        sender_type: senderType,
        sender_id: null, // Always NULL in this phase
        content: messageText,
        message_type: 'text',
        whatsapp_message_id: messageId,
        status: 'delivered',
        created_at: messageTimestamp
      })
      .select('id')
      .single()
    
    if (saveMessageError) {
      console.log(`❌ Erro ao salvar mensagem: ${saveMessageError.message}`)
      console.log('📋 Payload completo:', JSON.stringify(payload, null, 2))
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
    // 9️⃣ SUCESSO FINAL
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              🎉 WEBHOOK PROCESSADO COM SUCESSO!                  ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.log(`   📱 Instance: ${instanceName}`)
    console.log(`   👤 Contact: ${contactName} (${phoneNumber})`)
    console.log(`   💬 Conversation: ${conversationId}`)
    console.log(`   📨 Message: ${savedMessage.id}`)
    console.log(`   ⏰ Processed at: ${new Date().toISOString()}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message processed successfully',
        data: {
          contact_id: contactId,
          conversation_id: conversationId,
          message_id: savedMessage.id
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
