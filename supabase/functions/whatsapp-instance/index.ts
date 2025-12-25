// Updated: 2025-12-09 - Auto webhook config on instance creation
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get base URL from secrets (REQUIRED - no fallback)
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL')?.trim() || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() || ''

// Helper function to configure webhook on UAZAPI instance
async function configureWebhook(instanceToken: string, adminToken: string): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`
  
  console.log('🔗 Configuring webhook on UAZAPI...')
  console.log('   - Webhook URL:', webhookUrl)
  console.log('   - Events: messages, messages_update, connection')
  console.log('   - Exclude: wasSentByApi, isGroupYes')
  
  try {
    const response = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instanceToken
      },
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        events: ['messages', 'messages_update', 'connection'],
        excludeMessages: ['wasSentByApi', 'isGroupYes']
      })
    })
    
    const responseText = await response.text()
    console.log('   - Response status:', response.status)
    console.log('   - Response:', responseText)
    
    if (!response.ok) {
      console.error('❌ Failed to configure webhook:', responseText)
      return { success: false, error: responseText }
    }
    
    console.log('✅ Webhook configured successfully!')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error configuring webhook:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Check authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestBody = await req.json()
    console.log('=== REQUEST DEBUG ===')
    console.log('Full request body:', JSON.stringify(requestBody))
    console.log('Keys received:', Object.keys(requestBody))
    console.log('====================')

    const { action, instanceName } = requestBody
    console.log('Parsed action:', action)
    console.log('Parsed instanceName:', instanceName)
    
    // Ler e limpar token (remove espaços extras)
    const UAZAPI_API_KEY = Deno.env.get('UAZAPI_API_KEY')?.trim()

    if (!UAZAPI_API_KEY) {
      console.error('UAZAPI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== UAZAPI DEBUG ===')
    console.log('Base URL:', UAZAPI_BASE_URL)
    console.log('Token exists:', !!UAZAPI_API_KEY)
    console.log('Token length:', UAZAPI_API_KEY?.length)
    console.log('Token starts:', UAZAPI_API_KEY?.substring(0, 10))
    console.log('Token ends:', UAZAPI_API_KEY?.substring(UAZAPI_API_KEY.length - 10))
    console.log('====================')
    console.log(`Processing action: ${action} for instance: ${instanceName}`)

    // ========== ACTION: INIT ==========
    if (action === 'init') {
      // Headers para operações ADMINISTRATIVAS
      const adminHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'admintoken': UAZAPI_API_KEY
      }

      console.log('Creating instance with admintoken...')

      // Criar/Iniciar instância na UAZAPI
      const initResponse = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: instanceName,
          systemName: "multiatendimento",
          adminField01: user.id,
          adminField02: new Date().toISOString()
        })
      })

      console.log('Init status:', initResponse.status)
      console.log('Init status text:', initResponse.statusText)

      // Ler resposta como texto primeiro
      const initText = await initResponse.text()
      console.log('Init response (raw):', initText)

      let initData
      try {
        initData = JSON.parse(initText)
        console.log('Init response (parsed):', JSON.stringify(initData))
      } catch (e) {
        console.error('Failed to parse init response as JSON:', e)
        return new Response(
          JSON.stringify({ 
            error: 'Invalid response from UAZAPI', 
            details: initText,
            status: initResponse.status 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!initResponse.ok) {
        console.error('Init failed with status:', initResponse.status)
        console.error('Init error details:', JSON.stringify(initData))
        return new Response(
          JSON.stringify({ 
            error: initData.message || initData.error || 'Failed to init instance',
            details: initData 
          }),
          { status: initResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Instance created successfully!')

      // Extrair o token da instância criada para usar nas próximas chamadas
      const instanceToken = initData.token || initData.instance?.token
      const instanceId = initData.id || initData.instance?.id

      console.log('Instance ID:', instanceId)
      console.log('Instance token:', instanceToken ? instanceToken.substring(0, 8) + '...' : 'not found')

      // SALVAR INSTANCE TOKEN NO BANCO
      if (instanceToken) {
        console.log('Saving instance token to database...')
        
        const { error: updateError } = await supabaseClient
          .from('whatsapp_connections')
          .update({ instance_token: instanceToken })
          .eq('session_id', instanceName)
        
        if (updateError) {
          console.error('Failed to save instance token:', updateError)
        } else {
          console.log('✅ Instance token saved!')
        }
        
        // Configurar webhook automaticamente
        const webhookResult = await configureWebhook(instanceToken, UAZAPI_API_KEY)
        if (!webhookResult.success) {
          console.warn('⚠️ Webhook configuration failed, but continuing with instance creation')
        }
      }

      // Headers para operações da INSTÂNCIA
      const instanceHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instanceToken || UAZAPI_API_KEY
      }

      console.log('Connecting instance to generate QR...')
      console.log('Using instance token:', instanceToken ? 'from response' : 'from env')

      // Conectar para gerar QR Code (sem phone = gera QR)
      const connectResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: 'POST',
        headers: instanceHeaders,
        body: JSON.stringify({})
      })

      console.log('Connect status:', connectResponse.status)

      const connectText = await connectResponse.text()
      console.log('Connect response (raw):', connectText)

      let connectData
      try {
        connectData = JSON.parse(connectText)
        console.log('Connect response (parsed):', JSON.stringify(connectData))
      } catch (e) {
        console.error('Failed to parse connect response as JSON:', e)
        return new Response(
          JSON.stringify({ 
            error: 'Invalid connect response', 
            details: connectText 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!connectResponse.ok) {
        console.error('Connect failed with status:', connectResponse.status)
        console.error('Connect error details:', JSON.stringify(connectData))
        return new Response(
          JSON.stringify({ 
            error: connectData.message || connectData.error || 'Failed to connect instance',
            details: connectData 
          }),
          { status: connectResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Connected successfully! QR Code available.')

      // Extrair QR Code - UAZAPI retorna em 'qrcode' (minúsculo) ou dentro de 'instance.qrcode'
      const qrCode = connectData.qrcode || connectData.instance?.qrcode || connectData.qrCode || connectData.base64 || connectData.qr
      console.log('QR Code found:', qrCode ? 'yes (length: ' + qrCode.length + ')' : 'no')

      return new Response(
        JSON.stringify({
          success: true,
          qrCode: qrCode,
          instanceToken: instanceToken,
          status: 'qr_ready'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== ACTION: STATUS ==========
    if (action === 'status') {
      console.log('🔍 [STATUS] ========== VERIFICANDO STATUS ==========')
      console.log('🔍 [STATUS] Instance name:', instanceName)
      
      // Usar service role para atualizar banco de forma confiável
      const serviceRoleClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      // Primeiro buscar dados da conexão
      const { data: connection } = await serviceRoleClient
        .from('whatsapp_connections')
        .select('instance_token, id, status, phone_number, company_id')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      const tokenToUse = connection?.instance_token || UAZAPI_API_KEY
      console.log('🔍 [STATUS] Token source:', connection?.instance_token ? 'instance_token from DB' : 'UAZAPI_API_KEY')
      console.log('🔍 [STATUS] Token (first 8 chars):', tokenToUse?.substring(0, 8))
      console.log('🔍 [STATUS] Current DB status:', connection?.status)

      // Tentar com instance name na query string
      const statusUrl = `${UAZAPI_BASE_URL}/instance/status?name=${encodeURIComponent(instanceName)}`
      console.log('📡 [API] Status URL:', statusUrl)

      const instanceHeaders = {
        'Accept': 'application/json',
        'token': tokenToUse
      }

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: instanceHeaders
      })

      console.log('📡 [API] Status HTTP code:', response.status)
      
      const responseText = await response.text()
      console.log('📡 [API] Status response RAW:', responseText)

      let data
      try {
        data = JSON.parse(responseText)
        console.log('📡 [API] Status response PARSED:', JSON.stringify(data, null, 2))
      } catch (e) {
        console.error('❌ [STATUS] Failed to parse response:', e)
        console.log('⚠️ [STATUS] Retornando disconnected (parse error)')
        return new Response(
          JSON.stringify({ 
            success: true,
            status: 'disconnected',
            phoneNumber: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Se retornou 401 e temos instance_token, já usamos. Se não, retornar disconnected
      if (response.status === 401) {
        console.log('⚠️ [STATUS] HTTP 401 - Retornando disconnected')
        return new Response(
          JSON.stringify({
            success: true,
            status: 'disconnected',
            phoneNumber: null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Mapear resposta UAZAPI para nosso formato
      let status = 'disconnected'
      let phoneNumber = null

      console.log('🔍 [STATUS] ===== ANALISANDO CAMPOS =====')
      console.log('🔍 [STATUS] data.instance:', JSON.stringify(data.instance))
      console.log('🔍 [STATUS] data.status:', JSON.stringify(data.status))
      console.log('🔍 [STATUS] data.state:', data.state)
      console.log('🔍 [STATUS] Todas as chaves:', Object.keys(data))
      console.log('')
      console.log('🔍 [STATUS] data.instance?.status =', data.instance?.status, '(tipo:', typeof data.instance?.status, ')')
      console.log('🔍 [STATUS] data.status?.connected =', data.status?.connected, '(tipo:', typeof data.status?.connected, ')')
      console.log('🔍 [STATUS] data.status?.loggedIn =', data.status?.loggedIn, '(tipo:', typeof data.status?.loggedIn, ')')
      console.log('🔍 [STATUS] data.instance?.owner =', data.instance?.owner)
      console.log('🔍 [STATUS] data.phone =', data.phone)
      console.log('🔍 [STATUS] data.number =', data.number)

      // Verificar conexão via múltiplos campos
      // IMPORTANTE: status.connected = socket conectado (NÃO significa WhatsApp autenticado)
      // status.loggedIn = WhatsApp autenticado ✅
      // instance.status === "open" = Sessão WhatsApp aberta ✅
      const checkConnected1 = data.status?.loggedIn === true
      const checkConnected2 = data.instance?.status === 'connected'
      const checkConnected3 = data.instance?.status === 'open'
      
      console.log('')
      console.log('🔍 [STATUS] ===== VERIFICAÇÕES DE CONEXÃO =====')
      console.log('🔍 [STATUS] Check 1: data.status?.loggedIn === true ?', checkConnected1)
      console.log('🔍 [STATUS] Check 2: data.instance?.status === "connected" ?', checkConnected2)
      console.log('🔍 [STATUS] Check 3: data.instance?.status === "open" ?', checkConnected3)
      
      const isConnected = checkConnected1 || checkConnected2 || checkConnected3
      console.log('🔍 [STATUS] isConnected (OR de todas):', isConnected)

      const isConnecting = 
        data.instance?.status === 'connecting' ||
        data.state === 'connecting'
      console.log('🔍 [STATUS] isConnecting:', isConnecting)

      if (isConnected) {
        status = 'connected'
        phoneNumber = data.instance?.owner || data.phone || data.number
        console.log('✅ [STATUS] DETECTADO COMO CONECTADO!')
        console.log('✅ [STATUS] phoneNumber extraído:', phoneNumber)
        
        // ═══════════════════════════════════════════════════════════════
        // 🔄 AUTO-UPDATE: Atualizar banco automaticamente quando conectar
        // ═══════════════════════════════════════════════════════════════
        if (connection && connection.status !== 'connected' && phoneNumber) {
          const normalizedPhone = phoneNumber.replace(/\D/g, '')
          console.log('📝 [STATUS] Atualizando banco automaticamente...')
          console.log('📝 [STATUS] normalized phone:', normalizedPhone)
          
          // ═══════════════════════════════════════════════════════════════
          // 🧹 PRE-UPDATE: Limpar phone_number de conexões arquivadas 
          // para evitar violação da constraint unique_company_phone
          // Usamos 'Aguardando...' pois o índice único ignora esse valor
          // ═══════════════════════════════════════════════════════════════
          if (normalizedPhone && normalizedPhone.length >= 10 && connection.company_id) {
            console.log('🧹 [PRE-UPDATE] Limpando phone_number de conexões arquivadas com mesmo número...')

            const { data: conflictingConnections, error: clearError } = await serviceRoleClient
              .from('whatsapp_connections')
              .update({
                // Usar 'Aguardando...' - o índice único ignora esse valor
                phone_number: 'Aguardando...',
              })
              .eq('company_id', connection.company_id)
              .eq('original_phone_normalized', normalizedPhone)
              .not('archived_at', 'is', null)
              .neq('id', connection.id)
              .select('id, name')
            
            if (clearError) {
              console.error('❌ [PRE-UPDATE] Erro ao limpar phone_number:', clearError)
            } else if (conflictingConnections && conflictingConnections.length > 0) {
              console.log('✅ [PRE-UPDATE] Limpou phone_number de', conflictingConnections.length, 'conexões arquivadas')
              conflictingConnections.forEach(c => console.log('   - ', c.name, '(', c.id, ')'))
            } else {
              console.log('ℹ️ [PRE-UPDATE] Nenhuma conexão arquivada conflitante encontrada')
            }
          }
          
          // ═══════════════════════════════════════════════════════════════
          // 📝 AGORA: Atualizar a nova conexão (sem conflito de constraint)
          // ═══════════════════════════════════════════════════════════════
          const { error: updateError } = await serviceRoleClient
            .from('whatsapp_connections')
            .update({
              status: 'connected',
              phone_number: phoneNumber,
              original_phone_normalized: normalizedPhone,
              last_connected_at: new Date().toISOString(),
              qr_code: null
            })
            .eq('id', connection.id)
          
          if (updateError) {
            console.error('❌ [STATUS] Erro ao atualizar banco:', updateError)
          } else {
            console.log('✅ [STATUS] Banco atualizado com sucesso!')
            
            // ═══════════════════════════════════════════════════════════════
            // 🔄 AUTO-MIGRATE: Migrar conversas de TODAS as conexões arquivadas
            // com o mesmo número (não apenas uma) + CONSOLIDAR DUPLICATAS
            // ═══════════════════════════════════════════════════════════════
            if (normalizedPhone && normalizedPhone.length >= 10 && connection.company_id) {
              console.log('🔍 [AUTO-MIGRATE] Verificando TODAS as conexões arquivadas com mesmo número...')
              
              // Buscar TODAS as conexões arquivadas com mesmo número
              const { data: archivedConnections, error: fetchArchivedError } = await serviceRoleClient
                .from('whatsapp_connections')
                .select('id, name')
                .eq('company_id', connection.company_id)
                .eq('original_phone_normalized', normalizedPhone)
                .not('archived_at', 'is', null)
                .neq('id', connection.id)
              
              if (fetchArchivedError) {
                console.error('❌ [AUTO-MIGRATE] Erro ao buscar conexões arquivadas:', fetchArchivedError)
              } else if (archivedConnections && archivedConnections.length > 0) {
                console.log('🔄 [AUTO-MIGRATE] Encontradas', archivedConnections.length, 'conexões arquivadas:')
                archivedConnections.forEach(c => console.log('   - ', c.name, '(', c.id, ')'))
                
                // Coletar IDs para migração em lote
                const archivedIds = archivedConnections.map(c => c.id)
                
                // Contar TODAS as conversas que serão migradas
                const { count: totalConversationsCount } = await serviceRoleClient
                  .from('conversations')
                  .select('*', { count: 'exact', head: true })
                  .in('whatsapp_connection_id', archivedIds)
                
                console.log('📊 [AUTO-MIGRATE] Total de conversas a migrar:', totalConversationsCount)
                
                // Migrar TODAS as conversas de uma vez
                const { error: migrateError } = await serviceRoleClient
                  .from('conversations')
                  .update({ whatsapp_connection_id: connection.id })
                  .in('whatsapp_connection_id', archivedIds)
                
                if (migrateError) {
                  console.error('❌ [AUTO-MIGRATE] Erro ao migrar:', migrateError)
                } else {
                  console.log('✅ [AUTO-MIGRATE] Migradas', totalConversationsCount, 'conversas de', archivedConnections.length, 'conexões!')
                  
                  // ═══════════════════════════════════════════════════════════════
                  // 🔄 CONSOLIDAR CONVERSAS DUPLICADAS DO MESMO CONTATO
                  // ═══════════════════════════════════════════════════════════════
                  console.log('🔍 [CONSOLIDATE] Verificando conversas duplicadas para consolidar...')
                  
                  // Buscar contatos com múltiplas conversas nesta conexão
                  const { data: duplicateContacts } = await serviceRoleClient
                    .from('conversations')
                    .select('contact_id')
                    .eq('whatsapp_connection_id', connection.id)
                  
                  if (duplicateContacts && duplicateContacts.length > 0) {
                    // Agrupar por contact_id para encontrar duplicatas
                    const contactCounts: Record<string, number> = {}
                    duplicateContacts.forEach(c => {
                      contactCounts[c.contact_id] = (contactCounts[c.contact_id] || 0) + 1
                    })
                    
                    const contactsWithDuplicates = Object.entries(contactCounts)
                      .filter(([_, count]) => count > 1)
                      .map(([contactId]) => contactId)
                    
                    console.log(`📊 [CONSOLIDATE] Encontrados ${contactsWithDuplicates.length} contatos com conversas duplicadas`)
                    
                    let totalMergedConversations = 0
                    let totalMovedMessages = 0
                    
                    for (const contactId of contactsWithDuplicates) {
                      // Buscar todas as conversas deste contato na conexão
                      const { data: contactConversations } = await serviceRoleClient
                        .from('conversations')
                        .select('id, last_message_at, status, created_at')
                        .eq('contact_id', contactId)
                        .eq('whatsapp_connection_id', connection.id)
                        .order('last_message_at', { ascending: false })
                      
                      if (!contactConversations || contactConversations.length <= 1) continue
                      
                      // A conversa principal é a mais recente
                      const [principalConversation, ...oldConversations] = contactConversations
                      const oldConversationIds = oldConversations.map(c => c.id)
                      
                      console.log(`🔀 [CONSOLIDATE] Consolidando ${oldConversations.length} conversas antigas para contato ${contactId} -> ${principalConversation.id}`)
                      
                      // Mover todas as mensagens das conversas antigas para a principal
                      const { data: movedMessagesData } = await serviceRoleClient
                        .from('messages')
                        .update({ conversation_id: principalConversation.id })
                        .in('conversation_id', oldConversationIds)
                        .select('id')
                      
                      const movedMessages = movedMessagesData?.length || 0
                      totalMovedMessages += movedMessages
                      
                      // Mover scheduled_messages
                      await serviceRoleClient
                        .from('scheduled_messages')
                        .update({ conversation_id: principalConversation.id })
                        .in('conversation_id', oldConversationIds)
                      
                      // Mover chat_summaries
                      await serviceRoleClient
                        .from('chat_summaries')
                        .update({ conversation_id: principalConversation.id })
                        .in('conversation_id', oldConversationIds)
                      
                      // Mover notas internas
                      await serviceRoleClient
                        .from('internal_notes')
                        .update({ conversation_id: principalConversation.id })
                        .in('conversation_id', oldConversationIds)
                      
                      // Registrar merge no histórico
                      await serviceRoleClient
                        .from('conversation_history')
                        .insert({
                          conversation_id: principalConversation.id,
                          event_type: 'connection_changed',
                          event_data: {
                            action: 'conversations_merged',
                            merged_conversation_ids: oldConversationIds,
                            merged_count: oldConversations.length,
                            moved_messages: movedMessages || 0,
                            reason: 'connection_migration_consolidation'
                          },
                          performed_by: null,
                          performed_by_name: 'Sistema',
                          is_automatic: true
                        })
                      
                      // Deletar conversas antigas (agora vazias)
                      await serviceRoleClient
                        .from('conversations')
                        .delete()
                        .in('id', oldConversationIds)
                      
                      totalMergedConversations += oldConversations.length
                    }
                    
                    if (totalMergedConversations > 0) {
                      console.log(`✅ [CONSOLIDATE] Consolidadas ${totalMergedConversations} conversas duplicadas, ${totalMovedMessages} mensagens movidas`)
                    }
                  }
                  
                  // Registrar migração (1 registro consolidado)
                  // Usamos a primeira conexão arquivada como source para manter compatibilidade
                  await serviceRoleClient
                    .from('connection_migrations')
                    .insert({
                      company_id: connection.company_id,
                      source_connection_id: archivedConnections[0].id,
                      target_connection_id: connection.id,
                      migration_type: 'auto_same_number',
                      migrated_conversations_count: totalConversationsCount || 0
                    })
                  
                  // Marcar TODAS como migradas
                  await serviceRoleClient
                    .from('whatsapp_connections')
                    .update({ archived_reason: 'migrated' })
                    .in('id', archivedIds)
                  
                  console.log('✅ [AUTO-MIGRATE] Marcadas', archivedConnections.length, 'conexões como migradas')
                }
              } else {
                console.log('ℹ️ [AUTO-MIGRATE] Nenhuma conexão arquivada com mesmo número')
              }
            }
          }
        }
      } else if (isConnecting) {
        status = 'connecting'
        console.log('🔄 [STATUS] Status: connecting')
      } else {
        status = 'disconnected'
        console.log('⏳ [STATUS] Status: disconnected (aguardando QR scan)')
      }

      console.log('')
      console.log('📤 [STATUS] ===== RESPOSTA FINAL =====')
      console.log('📤 [STATUS] status:', status)
      console.log('📤 [STATUS] phoneNumber:', phoneNumber)
      console.log('🔍 [STATUS] ========== FIM STATUS ==========')

      return new Response(
        JSON.stringify({
          success: true,
          status: status,
          phoneNumber: phoneNumber
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== ACTION: RECONNECT ==========
    if (action === 'reconnect') {
      console.log('Reconnecting instance:', instanceName)
      
      // Buscar instance token do banco
      const { data: connection, error: fetchError } = await supabaseClient
        .from('whatsapp_connections')
        .select('instance_token, session_id')
        .eq('session_id', instanceName)
        .single()
      
      if (fetchError || !connection || !connection.instance_token) {
        console.error('Connection not found or missing token:', fetchError)
        return new Response(
          JSON.stringify({ error: 'Connection not found. Please create a new connection.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('Found existing instance, reconnecting...')
      
      const instanceHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': connection.instance_token
      }
      
      // Conectar instância existente
      const connectResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: 'POST',
        headers: instanceHeaders,
        body: JSON.stringify({})
      })
      
      console.log('Reconnect status:', connectResponse.status)
      
      const connectText = await connectResponse.text()
      console.log('Reconnect response (raw):', connectText)
      
      let connectData
      try {
        connectData = JSON.parse(connectText)
        console.log('Reconnect response (parsed):', JSON.stringify(connectData))
      } catch (e) {
        console.error('Failed to parse reconnect response:', e)
        return new Response(
          JSON.stringify({ error: 'Invalid response from UAZAPI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (!connectResponse.ok) {
        console.error('Reconnect failed:', connectData)
        return new Response(
          JSON.stringify({ 
            error: connectData.message || connectData.error || 'Failed to reconnect'
          }),
          { status: connectResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Atualizar status no banco
      await supabaseClient
        .from('whatsapp_connections')
        .update({ 
          status: 'connecting',
          qr_code: connectData.qrcode || connectData.instance?.qrcode || connectData.qrCode || null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', instanceName)
      
      console.log('✅ Reconnect successful!')
      
      const qrCode = connectData.qrcode || connectData.instance?.qrcode || connectData.qrCode || connectData.base64 || connectData.qr
      
      return new Response(
        JSON.stringify({
          success: true,
          qrCode: qrCode,
          status: 'qr_ready'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== ACTION: LOGOUT ==========
    // Desconecta da UAZAPI mas mantém instância (pode reconectar depois)
    // Atualiza status no banco para 'disconnected'
    if (action === 'logout') {
      console.log('🔌 [LOGOUT] Disconnecting instance:', instanceName)
      
      // Buscar instance_token do banco
      const { data: connection } = await supabaseClient
        .from('whatsapp_connections')
        .select('instance_token, id')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      const tokenToUse = connection?.instance_token || UAZAPI_API_KEY
      console.log('🔌 [LOGOUT] Using token:', connection?.instance_token ? 'instance_token from DB' : 'UAZAPI_API_KEY')

      const instanceHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': tokenToUse
      }

      const response = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
        method: 'POST',
        headers: instanceHeaders
      })

      console.log('🔌 [LOGOUT] Disconnect status:', response.status)
      
      const responseText = await response.text()
      console.log('🔌 [LOGOUT] Disconnect response:', responseText)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { message: responseText }
      }

      // NOVO: Atualizar status no banco para 'disconnected'
      if (connection?.id) {
        console.log('🔌 [LOGOUT] Updating database status to disconnected...')
        const { error: updateError } = await supabaseClient
          .from('whatsapp_connections')
          .update({ 
            status: 'disconnected',
            qr_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        
        if (updateError) {
          console.error('🔌 [LOGOUT] Failed to update database:', updateError)
        } else {
          console.log('🔌 [LOGOUT] ✅ Database updated successfully')
        }
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== ACTION: ARCHIVE ==========
    // Remove da UAZAPI mas MANTÉM registro no banco (para migração/backup)
    // Libera slot de conexão
    if (action === 'archive') {
      console.log('📦 [ARCHIVE] Archiving instance:', instanceName)
      
      // Buscar instance token do banco
      const { data: connection } = await supabaseClient
        .from('whatsapp_connections')
        .select('instance_token, id')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      if (connection?.instance_token) {
        console.log('📦 [ARCHIVE] Found instance token, deleting from UAZAPI...')
        
        // Deletar na UAZAPI usando instance token
        const instanceHeaders = {
          'Accept': 'application/json',
          'token': connection.instance_token
        }
        
        const deleteResponse = await fetch(`${UAZAPI_BASE_URL}/instance`, {
          method: 'DELETE',
          headers: instanceHeaders
        })
        
        console.log('📦 [ARCHIVE] UAZAPI delete status:', deleteResponse.status)
        
        const deleteText = await deleteResponse.text()
        console.log('📦 [ARCHIVE] UAZAPI delete response:', deleteText)
      } else {
        console.log('📦 [ARCHIVE] No instance token found, skipping UAZAPI deletion')
      }
      
      // ATUALIZAR no banco (NÃO deletar) - preservar histórico
      if (connection?.id) {
        console.log('📦 [ARCHIVE] Updating database with archived status...')
        const { data: updatedConnection, error: updateError } = await supabaseClient
          .from('whatsapp_connections')
          .update({ 
            status: 'disconnected',
            archived_at: new Date().toISOString(),
            archived_reason: 'user_archived',
            active: false,
            qr_code: null,
            instance_token: null, // Limpar token já que foi removido da UAZAPI
            // IMPORTANTE: Liberar o phone_number para evitar conflito quando reconectar
            // Usamos 'Aguardando...' pois o índice único ignora esse valor
            phone_number: 'Aguardando...',
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
          .select()
          .single()
        
        if (updateError) {
          console.error('📦 [ARCHIVE] Failed to update database:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to archive in database', details: updateError }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log('📦 [ARCHIVE] ✅ Instance archived successfully!', updatedConnection)
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Instance archived',
            connection: updatedConnection
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        console.error('📦 [ARCHIVE] Connection not found in database')
        return new Response(
          JSON.stringify({ error: 'Connection not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ========== ACTION: DELETE_PERMANENT ==========
    // Remove da UAZAPI E deleta registro do banco permanentemente
    if (action === 'delete_permanent') {
      console.log('🗑️ [DELETE_PERMANENT] Permanently deleting instance:', instanceName)
      
      // Buscar instance token do banco
      const { data: connection } = await supabaseClient
        .from('whatsapp_connections')
        .select('instance_token')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      if (connection?.instance_token) {
        console.log('🗑️ [DELETE_PERMANENT] Found instance token, deleting from UAZAPI...')
        
        const instanceHeaders = {
          'Accept': 'application/json',
          'token': connection.instance_token
        }
        
        const deleteResponse = await fetch(`${UAZAPI_BASE_URL}/instance`, {
          method: 'DELETE',
          headers: instanceHeaders
        })
        
        console.log('🗑️ [DELETE_PERMANENT] UAZAPI delete status:', deleteResponse.status)
        const deleteText = await deleteResponse.text()
        console.log('🗑️ [DELETE_PERMANENT] UAZAPI delete response:', deleteText)
      } else {
        console.log('🗑️ [DELETE_PERMANENT] No instance token found, skipping UAZAPI deletion')
      }
      
      // DELETAR do banco permanentemente
      const { error: deleteError } = await supabaseClient
        .from('whatsapp_connections')
        .delete()
        .eq('session_id', instanceName)
      
      if (deleteError) {
        console.error('🗑️ [DELETE_PERMANENT] Failed to delete from database:', deleteError)
        return new Response(
          JSON.stringify({ error: 'Failed to delete from database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('🗑️ [DELETE_PERMANENT] ✅ Instance permanently deleted!')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Instance permanently deleted'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // NOTE: update_webhook action removed - groups are no longer supported
    // All webhooks now always exclude group messages (isGroupYes)

    console.error('Invalid action received:', action)
    console.error('Valid actions are: init, status, logout, archive, delete_permanent')

    return new Response(
      JSON.stringify({ 
        error: 'Invalid action',
        received: action,
        valid: ['init', 'status', 'logout', 'archive', 'delete_permanent']
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error in whatsapp-instance function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
