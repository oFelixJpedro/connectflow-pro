import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL') || 'https://g1.uazapi.com';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { notification_id, event_data = {} } = await req.json();

    if (!notification_id) {
      return new Response(
        JSON.stringify({ error: 'notification_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-notification] Processing notification: ${notification_id}`);

    // Fetch notification config with recipients
    const { data: notification, error: notifError } = await supabase
      .from('whatsapp_notifications')
      .select(`
        *,
        whatsapp_notification_recipients (*),
        whatsapp_connections!inner (
          id,
          instance_token,
          instance_name,
          phone_number
        )
      `)
      .eq('id', notification_id)
      .eq('is_active', true)
      .single();

    if (notifError || !notification) {
      console.error('[send-notification] Notification not found or inactive:', notifError);
      return new Response(
        JSON.stringify({ error: 'Notification not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipients = notification.whatsapp_notification_recipients?.filter(
      (r: { is_active: boolean }) => r.is_active
    ) || [];

    if (recipients.length === 0) {
      console.log('[send-notification] No active recipients found');
      return new Response(
        JSON.stringify({ error: 'No active recipients configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const connection = notification.whatsapp_connections;
    if (!connection?.instance_token) {
      console.error('[send-notification] Connection missing instance_token');
      return new Response(
        JSON.stringify({ error: 'WhatsApp connection not properly configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Replace placeholders in message template
    let message = notification.message_template;
    const placeholders: Record<string, string> = {
      '{{cliente_nome}}': event_data.cliente_nome || 'N/A',
      '{{cliente_telefone}}': event_data.cliente_telefone || 'N/A',
      '{{valor}}': event_data.valor || 'N/A',
      '{{data_hora}}': event_data.data_hora || new Date().toLocaleString('pt-BR'),
      '{{agente}}': event_data.agente || 'N/A',
      '{{empresa}}': event_data.empresa || 'N/A',
    };

    for (const [placeholder, value] of Object.entries(placeholders)) {
      message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    console.log(`[send-notification] Sending to ${recipients.length} recipients`);

    const results: Array<{ phone: string; success: boolean; error?: string }> = [];

    // Send to each recipient
    for (const recipient of recipients) {
      const phone = recipient.phone_number;
      
      try {
        // Log the attempt
        const { data: logEntry } = await supabase
          .from('whatsapp_notification_logs')
          .insert({
            notification_id: notification.id,
            company_id: notification.company_id,
            recipient_phone: phone,
            recipient_name: recipient.name,
            message_content: message,
            status: 'pending',
            event_data
          })
          .select('id')
          .single();

        // Send via UAZAPI
        const sendResponse = await fetch(`${uazapiBaseUrl}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': connection.instance_token
          },
          body: JSON.stringify({ phone, message })
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          console.error(`[send-notification] UAZAPI error for ${phone}:`, errorText);
          
          if (logEntry?.id) {
            await supabase
              .from('whatsapp_notification_logs')
              .update({ status: 'failed', error_message: errorText })
              .eq('id', logEntry.id);
          }

          results.push({ phone, success: false, error: errorText });
          continue;
        }

        if (logEntry?.id) {
          await supabase
            .from('whatsapp_notification_logs')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', logEntry.id);
        }

        console.log(`[send-notification] Successfully sent to ${phone}`);
        results.push({ phone, success: true });

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[send-notification] Error sending to ${phone}:`, error);
        results.push({ phone, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[send-notification] Complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
