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

    const { action, instanceName, connectionId } = await req.json()
    const UAZAPI_API_KEY = Deno.env.get('UAZAPI_API_KEY')

    if (!UAZAPI_API_KEY) {
      console.error('UAZAPI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing action: ${action} for instance: ${instanceName}`)

    if (action === 'init') {
      // Initialize WhatsApp instance and get QR code
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`
      
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${UAZAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceName: instanceName,
          number: "auto",
          webhook: {
            url: webhookUrl,
            events: ['messages', 'connection.update'],
            byEvents: false
          }
        })
      })

      const data = await response.json()
      console.log('uazapi init response:', JSON.stringify(data))

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: data.message || 'Failed to initialize instance' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          qrCode: data.qrcode?.base64 || data.qrcode || data.base64,
          status: data.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'status') {
      // Check instance status
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${UAZAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      console.log('uazapi status response:', JSON.stringify(data))

      return new Response(
        JSON.stringify({
          success: true,
          status: data.state || data.status,
          phoneNumber: data.phoneNumber || data.number
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'logout') {
      // Logout/disconnect instance
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${UAZAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      console.log('uazapi logout response:', JSON.stringify(data))

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete') {
      // Delete instance completely
      const response = await fetch(`${UAZAPI_BASE_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${UAZAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      console.log('uazapi delete response:', JSON.stringify(data))

      return new Response(
        JSON.stringify({ success: true }),
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
