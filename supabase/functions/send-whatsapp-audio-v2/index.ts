import { createClient } from 'npm:@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messageId, mediaUrl, contactPhoneNumber, replyId } = await req.json();

    if (!messageId || !mediaUrl || !contactPhoneNumber) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields: messageId, mediaUrl, contactPhoneNumber' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📤 [send-whatsapp-audio-v2] Sending audio for message:', messageId);

    // Get message to find connection
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('connection_id, quoted_message_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      throw new Error('Message not found');
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('instance_id, instance_token, status')
      .eq('id', message.connection_id)
      .single();

    if (connError || !connection) {
      throw new Error('WhatsApp connection not found');
    }

    if (connection.status !== 'connected') {
      throw new Error('WhatsApp connection is not active');
    }

    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL');
    if (!uazapiBaseUrl) {
      throw new Error('UAZAPI_BASE_URL not configured');
    }

    // Get quoted message whatsapp_message_id if replying
    let quotedWhatsappId: string | undefined;
    if (message.quoted_message_id) {
      const { data: quotedMsg } = await supabase
        .from('messages')
        .select('whatsapp_message_id')
        .eq('id', message.quoted_message_id)
        .single();
      quotedWhatsappId = quotedMsg?.whatsapp_message_id;
    }

    // Clean phone number
    const cleanPhone = contactPhoneNumber.replace(/\D/g, '');

    // Build UAZAPI payload
    const uazapiPayload: any = {
      number: cleanPhone,
      mediaUrl: mediaUrl,
      mediaType: 'audio',
    };

    if (quotedWhatsappId || replyId) {
      uazapiPayload.replyId = quotedWhatsappId || replyId;
    }

    console.log('📤 Sending to UAZAPI:', { number: cleanPhone });

    // Send to UAZAPI
    const uazapiResponse = await fetch(
      `${uazapiBaseUrl}/instance/${connection.instance_id}/send/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': connection.instance_token,
        },
        body: JSON.stringify(uazapiPayload),
      }
    );

    const uazapiResult = await uazapiResponse.json();
    console.log('📨 UAZAPI Response:', uazapiResult);

    if (!uazapiResponse.ok || uazapiResult.error) {
      // Update message status to failed
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          metadata: { 
            error: uazapiResult.error || 'UAZAPI error',
            failedAt: new Date().toISOString() 
          }
        })
        .eq('id', messageId);

      throw new Error(uazapiResult.error || 'Failed to send via UAZAPI');
    }

    // Update message with whatsapp_message_id and status
    const whatsappMessageId = uazapiResult.key?.id || uazapiResult.messageId;
    
    await supabase
      .from('messages')
      .update({ 
        status: 'sent',
        whatsapp_message_id: whatsappMessageId,
      })
      .eq('id', messageId);

    console.log('✅ Audio sent successfully:', whatsappMessageId);

    // Trigger commercial pixel in background
    EdgeRuntime.waitUntil((async () => {
      try {
        await supabase.functions.invoke('commercial-pixel', {
          body: { 
            conversationId: message.connection_id,
            eventType: 'message_sent',
            messageType: 'audio'
          }
        });
      } catch (e) {
        console.warn('Commercial pixel failed:', e);
      }
    })());

    return new Response(JSON.stringify({ 
      success: true, 
      messageId,
      whatsappMessageId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in send-whatsapp-audio-v2:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
