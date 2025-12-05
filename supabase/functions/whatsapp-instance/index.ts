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

    // Header padrão para autenticação na UAZAPI (Evolution API)
    const apiHeaders = {
      'apikey': UAZAPI_API_KEY,
      'Content-Type': 'application/json'
    }

    console.log('UAZAPI Auth configured:', { 
      hasApiKey: !!UAZAPI_API_KEY,
      keyPrefix: UAZAPI_API_KEY?.substring(0, 8) 
    })
    console.log(`Processing action: ${action} for instance: ${instanceName}`)

    if (action === 'init') {
      // Initialize WhatsApp instance and get QR code
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`
      
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/create`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          instanceName: instanceName,
          token: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: webhookUrl,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED"
          ]
        })
      })

      // Se a instância já existe ou deu erro na criação, tenta buscar o status/connect
      if (!response.ok && response.status !== 403) {
         const errorText = await response.text();
         console.log('Error creating instance:', errorText);
      }

      // Conectar para pegar o QR Code
      const connectResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: apiHeaders
      })

      const data = await connectResponse.json()
      console.log('uazapi connect response:', JSON.stringify(data))

      if (!connectResponse.ok) {
        return new Response(
          JSON.stringify({ error: data.message || 'Failed to initialize instance' }),
          { status: connectResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          qrCode: data.base64 || data.qrcode?.base64 || data.qrcode,
          status: data.state || 'qr_ready'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'status') {
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: apiHeaders
      })

      const data = await response.json()
      
      // Mapeamento de resposta da Evolution/UAZAPI
      let status = 'disconnected';
      if (data.instance?.state === 'open') status = 'connected';
      if (data.instance?.state === 'connecting') status = 'connecting';
      
      // Tenta pegar o número se estiver conectado
      let phoneNumber = null;
      if (status === 'connected') {
         phoneNumber = data.instance?.ownerJid?.split('@')[0]; 
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
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: apiHeaders
      })
      const data = await response.json()
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: apiHeaders
      })
      const data = await response.json()
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
