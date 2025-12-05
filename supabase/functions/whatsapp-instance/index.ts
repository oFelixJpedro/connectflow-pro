// Updated: 2025-12-05 - Fixed status, logout, added delete action, save instance_token
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UAZAPI_BASE_URL = 'https://whatsapi.uazapi.com'

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
      // Primeiro buscar instance_token do banco
      const { data: connection } = await supabaseClient
        .from('whatsapp_connections')
        .select('instance_token')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      const tokenToUse = connection?.instance_token || UAZAPI_API_KEY
      console.log('Using token:', connection?.instance_token ? 'instance_token from DB' : 'UAZAPI_API_KEY')

      // Tentar com instance name na query string
      const statusUrl = `${UAZAPI_BASE_URL}/instance/status?name=${encodeURIComponent(instanceName)}`
      console.log('Checking status with URL:', statusUrl)

      const instanceHeaders = {
        'Accept': 'application/json',
        'token': tokenToUse
      }

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: instanceHeaders
      })

      console.log('Status response code:', response.status)
      
      const responseText = await response.text()
      console.log('Status response (raw):', responseText)

      let data
      try {
        data = JSON.parse(responseText)
        console.log('Status data:', JSON.stringify(data))
      } catch (e) {
        console.error('Failed to parse status response:', e)
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
        console.log('Status returned 401, assuming disconnected')
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

      if (data.state === 'open' || data.connected === true || data.status === 'connected') {
        status = 'connected'
        phoneNumber = data.phone || data.number || data.instance?.owner
      } else if (data.state === 'connecting' || data.status === 'connecting') {
        status = 'connecting'
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: status,
          phoneNumber: phoneNumber
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== ACTION: LOGOUT ==========
    if (action === 'logout') {
      console.log('Disconnecting instance:', instanceName)
      
      // Buscar instance_token do banco
      const { data: connection } = await supabaseClient
        .from('whatsapp_connections')
        .select('instance_token')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      const tokenToUse = connection?.instance_token || UAZAPI_API_KEY
      console.log('Using token:', connection?.instance_token ? 'instance_token from DB' : 'UAZAPI_API_KEY')

      const instanceHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': tokenToUse
      }

      const response = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
        method: 'POST',
        headers: instanceHeaders
      })

      console.log('Disconnect status:', response.status)
      
      const responseText = await response.text()
      console.log('Disconnect response:', responseText)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { message: responseText }
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== ACTION: DELETE ==========
    if (action === 'delete') {
      console.log('Deleting instance:', instanceName)
      
      // Deletar na UAZAPI usando admin token
      const adminHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'admintoken': UAZAPI_API_KEY
      }
      
      // DELETE com nome na query string
      const deleteUrl = `${UAZAPI_BASE_URL}/instance?name=${encodeURIComponent(instanceName)}`
      console.log('Delete URL:', deleteUrl)
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: adminHeaders
      })
      
      console.log('Delete response status:', deleteResponse.status)
      
      const deleteText = await deleteResponse.text()
      console.log('Delete response:', deleteText)
      
      // Deletar do banco independente do resultado da API
      const { error: deleteError } = await supabaseClient
        .from('whatsapp_connections')
        .delete()
        .eq('session_id', instanceName)
      
      if (deleteError) {
        console.error('Failed to delete from database:', deleteError)
      } else {
        console.log('✅ Deleted from database!')
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Connection deleted'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.error('Invalid action received:', action)
    console.error('Valid actions are: init, status, logout, delete')

    return new Response(
      JSON.stringify({ 
        error: 'Invalid action',
        received: action,
        valid: ['init', 'status', 'logout', 'delete']
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
