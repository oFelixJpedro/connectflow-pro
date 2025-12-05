// Updated: 2025-12-05 - Fixed UAZAPI token configuration
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
    const UAZAPI_API_KEY = Deno.env.get('UAZAPI_API_KEY')

    if (!UAZAPI_API_KEY) {
      console.error('UAZAPI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('UAZAPI Config:', { 
      baseUrl: UAZAPI_BASE_URL,
      hasApiKey: !!UAZAPI_API_KEY,
      keyPrefix: UAZAPI_API_KEY?.substring(0, 8)
    })
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
      const initData = await initResponse.json()
      console.log('Init response:', JSON.stringify(initData))

      if (!initResponse.ok) {
        return new Response(
          JSON.stringify({ error: initData.message || 'Failed to init instance' }),
          { status: initResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Headers para operações da INSTÂNCIA
      const instanceHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': UAZAPI_API_KEY
      }

      console.log('Connecting instance to generate QR...')

      // Conectar para gerar QR Code (sem phone = gera QR)
      const connectResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: 'POST',
        headers: instanceHeaders,
        body: JSON.stringify({})
      })

      console.log('Connect status:', connectResponse.status)
      const connectData = await connectResponse.json()
      console.log('Connect response:', JSON.stringify(connectData))

      if (!connectResponse.ok) {
        return new Response(
          JSON.stringify({ error: connectData.message || 'Failed to connect instance' }),
          { status: connectResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          qrCode: connectData.qrCode || connectData.base64 || connectData.qr,
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
