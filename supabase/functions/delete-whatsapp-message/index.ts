import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🗑️ Starting message deletion...')
    
    const body = await req.json()
    const { messageId } = body

    if (!messageId) {
      throw new Error('messageId is required')
    }

    console.log(`📝 Message ID: ${messageId}`)

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token')
    }

    console.log(`👤 User: ${user.id}`)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Profile not found')
    }

    console.log(`👤 User profile: ${profile.full_name}`)

    // Get message with conversation and connection details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        whatsapp_message_id,
        direction,
        sender_type,
        message_type,
        is_deleted,
        content,
        conversations!inner (
          id,
          assigned_user_id,
          company_id,
          whatsapp_connection_id,
          whatsapp_connections!inner (
            id,
            instance_token,
            uazapi_base_url
          )
        )
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      console.error('❌ Message not found:', messageError)
      throw new Error('Message not found')
    }

    console.log(`📨 Message found: ${message.id}`)
    console.log(`📨 Direction: ${message.direction}, SenderType: ${message.sender_type}, Type: ${message.message_type}`)

    const conversation = (message as any).conversations
    const connection = conversation?.whatsapp_connections

    // Validate company access
    if (conversation.company_id !== profile.company_id) {
      throw new Error('Access denied: Message belongs to different company')
    }

    // Validate conversation is assigned to current user
    if (conversation.assigned_user_id !== user.id) {
      console.log(`❌ Conversation assigned to: ${conversation.assigned_user_id}, User: ${user.id}`)
      throw new Error('Você precisa estar responsável pela conversa para apagar mensagens')
    }

    // Validate message is outbound (sent by system/agent)
    if (message.direction !== 'outbound') {
      throw new Error('Apenas mensagens enviadas podem ser apagadas')
    }

    // Validate message is from user (not system/bot)
    if (message.sender_type !== 'user') {
      throw new Error('Apenas mensagens de atendentes podem ser apagadas')
    }

    // Validate message is text type
    if (message.message_type !== 'text') {
      throw new Error('Apenas mensagens de texto podem ser apagadas')
    }

    // Validate message is not already deleted
    if (message.is_deleted) {
      throw new Error('Esta mensagem já foi apagada')
    }

    // Validate message has whatsapp_message_id
    if (!message.whatsapp_message_id) {
      throw new Error('Não é possível apagar esta mensagem (ID WhatsApp não encontrado)')
    }

    // Get connection token
    if (!connection?.instance_token) {
      throw new Error('WhatsApp connection not found or missing instance token')
    }

    const instanceToken = connection.instance_token
    const apiBaseUrl = connection.uazapi_base_url || 'https://felix.uazapi.com'

    console.log(`🔗 Calling UAZAPI to delete message...`)

    // Call UAZAPI to delete message
    const uazapiResponse = await fetch(`${apiBaseUrl}/message/delete`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': instanceToken
      },
      body: JSON.stringify({
        id: message.whatsapp_message_id
      })
    })

    const uazapiResult = await uazapiResponse.json()
    console.log(`📡 UAZAPI Response:`, JSON.stringify(uazapiResult))

    if (!uazapiResponse.ok || uazapiResult.error) {
      console.error('❌ UAZAPI error:', uazapiResult)
      throw new Error(uazapiResult.message || uazapiResult.error || 'Erro ao apagar mensagem no WhatsApp')
    }

    console.log(`✅ Message deleted from WhatsApp`)

    // Update message in database
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_type: 'agent',
        deleted_by: user.id,
        deleted_by_name: profile.full_name,
        original_content: message.content
      })
      .eq('id', messageId)

    if (updateError) {
      console.error('❌ Database update error:', updateError)
      throw new Error('Erro ao marcar mensagem como apagada no banco de dados')
    }

    console.log(`✅ Message marked as deleted in database`)

    // Record in conversation history
    try {
      await supabase.from('conversation_history').insert({
        conversation_id: message.conversation_id,
        event_type: 'message_deleted',
        event_data: {
          message_id: message.id,
          message_content: message.content,
          deleted_by: user.id,
          deleted_by_name: profile.full_name
        },
        performed_by: user.id,
        performed_by_name: profile.full_name,
        is_automatic: false
      })
      console.log(`✅ Recorded in conversation history`)
    } catch (historyError) {
      console.warn('⚠️ Failed to record history (non-critical):', historyError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mensagem apagada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao apagar mensagem'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
