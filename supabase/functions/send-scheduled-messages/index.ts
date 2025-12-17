import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledMessage {
  id: string
  company_id: string
  contact_id: string
  conversation_id: string | null
  message_type: string
  content: string | null
  media_url: string | null
  media_mime_type: string | null
  media_file_name: string | null
  scheduled_at: string
  created_by: string
  contact: {
    id: string
    phone_number: string
    company_id: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('[send-scheduled-messages] Starting to process scheduled messages')

    // Fetch pending messages that are due
    const now = new Date().toISOString()
    const { data: messages, error: fetchError } = await supabaseAdmin
      .from('scheduled_messages')
      .select(`
        *,
        contact:contacts(id, phone_number, company_id)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(50)

    if (fetchError) {
      console.error('[send-scheduled-messages] Error fetching messages:', fetchError)
      throw fetchError
    }

    if (!messages || messages.length === 0) {
      console.log('[send-scheduled-messages] No pending messages to process')
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[send-scheduled-messages] Found ${messages.length} messages to process`)

    let successCount = 0
    let failCount = 0

    for (const msg of messages as ScheduledMessage[]) {
      try {
        console.log(`[send-scheduled-messages] Processing message ${msg.id} for contact ${msg.contact_id}`)

        // Get the CURRENT conversation for this contact (most recent)
        const { data: conversation, error: convError } = await supabaseAdmin
          .from('conversations')
          .select('id, whatsapp_connection_id, department_id')
          .eq('contact_id', msg.contact_id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single()

        if (convError || !conversation) {
          console.error(`[send-scheduled-messages] No conversation found for contact ${msg.contact_id}`)
          await supabaseAdmin
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: 'Conversa não encontrada para este contato'
            })
            .eq('id', msg.id)
          failCount++
          continue
        }

        // Get connection details
        const { data: connection, error: connError } = await supabaseAdmin
          .from('whatsapp_connections')
          .select('id, instance_token, status, uazapi_base_url')
          .eq('id', conversation.whatsapp_connection_id)
          .single()

        if (connError || !connection) {
          console.error(`[send-scheduled-messages] Connection not found for conversation`)
          await supabaseAdmin
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: 'Conexão WhatsApp não encontrada'
            })
            .eq('id', msg.id)
          failCount++
          continue
        }

        if (connection.status !== 'connected') {
          console.error(`[send-scheduled-messages] Connection ${connection.id} is not connected`)
          await supabaseAdmin
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: 'Conexão WhatsApp desconectada no momento do envio'
            })
            .eq('id', msg.id)
          failCount++
          continue
        }

        // Create message in database
        const messageInsert: Record<string, unknown> = {
          conversation_id: conversation.id,
          content: msg.content,
          message_type: msg.message_type,
          direction: 'outbound',
          sender_type: 'user',
          sender_id: msg.created_by,
          status: 'pending',
          metadata: {
            scheduled: true,
            scheduled_message_id: msg.id,
            original_scheduled_at: msg.scheduled_at
          }
        }

        if (msg.media_url) {
          messageInsert.media_url = msg.media_url
          messageInsert.media_mime_type = msg.media_mime_type
        }

        const { data: newMessage, error: msgError } = await supabaseAdmin
          .from('messages')
          .insert(messageInsert)
          .select()
          .single()

        if (msgError) {
          console.error(`[send-scheduled-messages] Error creating message:`, msgError)
          await supabaseAdmin
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: 'Erro ao criar mensagem'
            })
            .eq('id', msg.id)
          failCount++
          continue
        }

        // Update conversation last_message_at
        await supabaseAdmin
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversation.id)

        // Send via UAZAPI
        const phoneNumber = msg.contact.phone_number.replace(/\D/g, '')
        const baseUrl = connection.uazapi_base_url || Deno.env.get('UAZAPI_BASE_URL')

        let uazapiResponse
        let uazapiEndpoint: string
        let uazapiBody: Record<string, unknown>

        if (msg.message_type === 'text') {
          uazapiEndpoint = `${baseUrl}/send/text`
          uazapiBody = {
            number: phoneNumber,
            text: msg.content
          }
        } else {
          // For media messages
          uazapiEndpoint = `${baseUrl}/send/media`
          uazapiBody = {
            number: phoneNumber,
            media: msg.media_url,
            text: msg.content || ''
          }
        }

        console.log(`[send-scheduled-messages] Sending to UAZAPI: ${uazapiEndpoint}`)

        uazapiResponse = await fetch(uazapiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': connection.instance_token
          },
          body: JSON.stringify(uazapiBody)
        })

        const uazapiResult = await uazapiResponse.json()
        console.log(`[send-scheduled-messages] UAZAPI response:`, JSON.stringify(uazapiResult))

        if (!uazapiResponse.ok || uazapiResult.error) {
          console.error(`[send-scheduled-messages] UAZAPI error:`, uazapiResult)
          
          // Update message as failed
          await supabaseAdmin
            .from('messages')
            .update({
              status: 'failed',
              error_message: uazapiResult.message || 'Erro ao enviar via WhatsApp'
            })
            .eq('id', newMessage.id)

          await supabaseAdmin
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: uazapiResult.message || 'Erro ao enviar via WhatsApp'
            })
            .eq('id', msg.id)
          
          failCount++
          continue
        }

        // Extract WhatsApp message ID
        const whatsappMessageId = uazapiResult.key?.id || uazapiResult.messageId || uazapiResult.id

        // Update message as sent
        await supabaseAdmin
          .from('messages')
          .update({
            status: 'sent',
            whatsapp_message_id: whatsappMessageId
          })
          .eq('id', newMessage.id)

        // Update scheduled message as sent
        await supabaseAdmin
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_message_id: newMessage.id
          })
          .eq('id', msg.id)

        console.log(`[send-scheduled-messages] Successfully sent message ${msg.id}`)
        successCount++

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro interno ao processar mensagem'
        console.error(`[send-scheduled-messages] Error processing message ${msg.id}:`, error)
        
        await supabaseAdmin
          .from('scheduled_messages')
          .update({
            status: 'failed',
            error_message: errorMessage
          })
          .eq('id', msg.id)
        
        failCount++
      }
    }

    console.log(`[send-scheduled-messages] Completed: ${successCount} sent, ${failCount} failed`)

    return new Response(
      JSON.stringify({
        processed: messages.length,
        success: successCount,
        failed: failCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[send-scheduled-messages] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
