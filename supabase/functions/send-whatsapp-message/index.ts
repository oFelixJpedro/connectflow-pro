import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║              📤 SEND WHATSAPP MESSAGE                            ║')
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
    // 1.5️⃣ VERIFICAR ROLE DO USUÁRIO
    // ═══════════════════════════════════════════════════════════════════
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin'
    console.log('📋 Role do usuário:', userRole?.role, '| isAdminOrOwner:', isAdminOrOwner)

    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ PARSE REQUEST BODY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 2️⃣  PARSE REQUEST                                               │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const body = await req.json()
    const { messageId, conversationId } = body

    console.log('📦 Request:', { messageId, conversationId })

    if (!messageId || !conversationId) {
      console.log('❌ Missing required fields')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing messageId or conversationId', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ BUSCAR DADOS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3️⃣  BUSCAR DADOS                                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Buscar mensagem
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      console.log('❌ Mensagem não encontrada:', messageError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Message not found', code: 'MESSAGE_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Mensagem encontrada:', message.id)
    console.log('   - content:', message.content?.substring(0, 50))
    console.log('   - quoted_message_id:', message.quoted_message_id || 'Nenhuma')
    
    // Se tem mensagem citada, buscar o whatsapp_message_id dela
    let quotedWhatsappMessageId: string | null = null
    if (message.quoted_message_id) {
      console.log('🔍 Buscando whatsapp_message_id da mensagem citada...')
      const { data: quotedMessage } = await supabase
        .from('messages')
        .select('whatsapp_message_id')
        .eq('id', message.quoted_message_id)
        .maybeSingle()
      
      if (quotedMessage?.whatsapp_message_id) {
        quotedWhatsappMessageId = quotedMessage.whatsapp_message_id
        console.log('✅ Mensagem citada encontrada, whatsapp_message_id:', quotedWhatsappMessageId)
      } else {
        console.log('⚠️ Mensagem citada não tem whatsapp_message_id (pode ser mensagem local)')
      }
    }

    // Buscar conversa com contato e conexão
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
      await updateMessageStatus(supabase, messageId, 'failed', 'Conversa não encontrada')
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Conversa encontrada:', conversation.id)
    console.log('   - contact:', conversation.contacts?.name, conversation.contacts?.phone_number)
    console.log('   - connection status:', conversation.whatsapp_connections?.status)

    // Verificar se WhatsApp está conectado
    // ═══════════════════════════════════════════════════════════════════
    // 3.5️⃣ VERIFICAR ACESSO À CONEXÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3.5️⃣ VERIFICAR ACESSO À CONEXÃO                                 │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const connectionId = conversation.whatsapp_connections?.id

    if (!isAdminOrOwner && connectionId) {
      // Check if this connection has any assignments
      const { data: connectionAssignments } = await supabase
        .from('connection_users')
        .select('user_id')
        .eq('connection_id', connectionId)

      const hasAnyAssignments = connectionAssignments && connectionAssignments.length > 0
      console.log('📋 Conexão tem atribuições:', hasAnyAssignments)

      if (hasAnyAssignments) {
        // Connection has assignments - check if user is assigned
        const userIsAssigned = connectionAssignments.some(a => a.user_id === user.id)
        console.log('📋 Usuário está atribuído à conexão:', userIsAssigned)

        if (!userIsAssigned) {
          console.log('❌ Usuário não tem acesso a esta conexão')
          await updateMessageStatus(supabase, messageId, 'failed', 'Sem acesso a esta conexão')
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Você não tem acesso a esta conexão.', 
              code: 'CONNECTION_ACCESS_DENIED' 
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check department access
        const departmentId = conversation.department_id
        if (departmentId) {
          // Get all departments for this connection
          const { data: connectionDepts } = await supabase
            .from('departments')
            .select('id')
            .eq('whatsapp_connection_id', connectionId)
            .eq('active', true)

          // Check if any user has department assignments for this connection
          const { data: anyDeptAssignments } = await supabase
            .from('department_users')
            .select('department_id, user_id')
            .in('department_id', (connectionDepts || []).map(d => d.id))

          const hasDeptRestrictions = anyDeptAssignments && anyDeptAssignments.length > 0
          console.log('📋 Conexão tem restrições de departamento:', hasDeptRestrictions)

          if (hasDeptRestrictions) {
            // Check if user has access to this specific department
            const userHasDeptAccess = anyDeptAssignments.some(
              da => da.user_id === user.id && da.department_id === departmentId
            )
            console.log('📋 Usuário tem acesso ao departamento:', userHasDeptAccess)

            if (!userHasDeptAccess) {
              console.log('❌ Usuário não tem acesso a este departamento')
              await updateMessageStatus(supabase, messageId, 'failed', 'Sem acesso a este departamento')
              return new Response(
                JSON.stringify({ 
                  success: false, 
                  error: 'Você não tem acesso a este departamento.', 
                  code: 'DEPARTMENT_ACCESS_DENIED' 
                }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
        }
      }
      // If no assignments on connection, allow (legacy behavior)
    }

    console.log('✅ Acesso à conexão e departamento verificado')

    if (conversation.whatsapp_connections?.status !== 'connected') {
      console.log('❌ WhatsApp não está conectado')
      await updateMessageStatus(supabase, messageId, 'failed', 'WhatsApp desconectado')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp desconectado. Reconecte em Configurações.', 
          code: 'WHATSAPP_DISCONNECTED' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const phoneNumber = conversation.contacts?.phone_number
    if (!phoneNumber) {
      console.log('❌ Número do contato não encontrado')
      await updateMessageStatus(supabase, messageId, 'failed', 'Número do contato inválido')
      return new Response(
        JSON.stringify({ success: false, error: 'Número do contato inválido', code: 'INVALID_NUMBER' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const messageContent = message.content
    if (!messageContent || !messageContent.trim()) {
      console.log('❌ Conteúdo da mensagem vazio')
      await updateMessageStatus(supabase, messageId, 'failed', 'Mensagem vazia')
      return new Response(
        JSON.stringify({ success: false, error: 'Mensagem vazia', code: 'EMPTY_MESSAGE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ ENVIAR PARA UAZAPI
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 4️⃣  ENVIAR PARA UAZAPI                                          │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    // Usar instance_token da conexão WhatsApp (não API key global)
    const instanceToken = conversation.whatsapp_connections?.instance_token
    
    if (!instanceToken) {
      console.log('❌ Instance token não encontrado na conexão')
      await updateMessageStatus(supabase, messageId, 'failed', 'Conexão sem token válido')
      return new Response(
        JSON.stringify({ success: false, error: 'Conexão WhatsApp sem token válido. Tente reconectar.', code: 'MISSING_INSTANCE_TOKEN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Limpar número de telefone (remover caracteres especiais)
    const cleanPhoneNumber = phoneNumber.replace(/[^\d]/g, '')

    // Montar payload para UAZAPI - incluir quoted se houver
    const uazapiPayload: { number: string; text: string; quoted?: string } = {
      number: cleanPhoneNumber,
      text: messageContent
    }
    
    // Adicionar campo quoted se estiver respondendo a uma mensagem
    if (quotedWhatsappMessageId) {
      uazapiPayload.quoted = quotedWhatsappMessageId
      console.log('💬 Enviando com citação!')
    }

    console.log('📤 UAZAPI Request:')
    console.log('   - URL: https://whatsapi.uazapi.com/send/text')
    console.log('   - token: ***' + instanceToken.slice(-8))
    console.log('   - number:', cleanPhoneNumber)
    console.log('   - text:', messageContent.substring(0, 100))
    console.log('   - quoted:', quotedWhatsappMessageId || '(nenhum)')

    const uazapiResponse = await fetch('https://whatsapi.uazapi.com/send/text', {
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
      console.log('❌ Erro ao parsear resposta da UAZAPI')
      await updateMessageStatus(supabase, messageId, 'failed', 'Erro na resposta da UAZAPI')
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar resposta do WhatsApp', code: 'UAZAPI_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!uazapiResponse.ok) {
      console.log('❌ UAZAPI retornou erro:', uazapiResponse.status)
      await updateMessageStatus(supabase, messageId, 'failed', uazapiData?.message || 'Erro da UAZAPI')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: uazapiData?.message || 'Erro ao enviar mensagem pelo WhatsApp', 
          code: 'UAZAPI_ERROR' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extrair whatsapp_message_id da resposta
    const whatsappMessageId = uazapiData?.key?.id || uazapiData?.id || null
    console.log('✅ Mensagem enviada com sucesso!')
    console.log('   - whatsapp_message_id:', whatsappMessageId)

    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ ATUALIZAR MENSAGEM NO BANCO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 5️⃣  ATUALIZAR MENSAGEM                                          │')
    console.log('└─────────────────────────────────────────────────────────────────┘')

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'sent',
        whatsapp_message_id: whatsappMessageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)

    if (updateError) {
      console.log('⚠️ Erro ao atualizar mensagem (mas foi enviada):', updateError.message)
    } else {
      console.log('✅ Mensagem atualizada no banco')
    }

    // ═══════════════════════════════════════════════════════════════════
    // ✅ SUCESSO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ✅ MENSAGEM ENVIADA COM SUCESSO!                    ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')

    return new Response(
      JSON.stringify({ 
        success: true, 
        whatsappMessageId,
        status: 'sent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro inesperado:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper para atualizar status da mensagem
async function updateMessageStatus(
  supabase: any, 
  messageId: string, 
  status: 'failed' | 'sent' | 'pending',
  errorMessage?: string
) {
  try {
    await supabase
      .from('messages')
      .update({
        status,
        error_message: errorMessage || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
    console.log(`📝 Status da mensagem atualizado para: ${status}`)
  } catch (e) {
    console.error('⚠️ Erro ao atualizar status da mensagem:', e)
  }
}
