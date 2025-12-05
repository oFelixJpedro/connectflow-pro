// Updated: 2025-12-05 - Added detailed logging and .trim() for token
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

    const { action, instanceName } = await req.json()
    
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
    console.log('Expected: 92Nl4AKwuR...X1vzmS2UJ0 (50 chars)')
    console.log('====================')
    console.log(`Processing action: ${action} for instance: ${instanceName}`)

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

    if (action === 'status') {
      const instanceHeaders = {
        'Accept': 'application/json',
        'token': UAZAPI_API_KEY
      }

      const response = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
        method: 'GET',
        headers: instanceHeaders
      })

      console.log('Status response code:', response.status)
      const data = await response.json()
      console.log('Status data:', JSON.stringify(data))
      
      // Mapear resposta UAZAPI para nosso formato
      let status = 'disconnected'
      let phoneNumber = null

      if (data.state === 'open' || data.connected === true) {
        status = 'connected'
        phoneNumber = data.phone || data.number
      } else if (data.state === 'connecting') {
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

    if (action === 'logout') {
      const instanceHeaders = {
        'Accept': 'application/json',
        'token': UAZAPI_API_KEY
      }

      const response = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
        method: 'POST',
        headers: instanceHeaders
      })

      console.log('Disconnect status:', response.status)
      const data = await response.json()
      console.log('Disconnect response:', JSON.stringify(data))

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
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
