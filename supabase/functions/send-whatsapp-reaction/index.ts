import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendReactionRequest {
  messageId: string;
  emoji: string;
  connectionId: string;
  contactPhoneNumber: string;
  remove?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         📨 SEND-WHATSAPP-REACTION Edge Function                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL') || 'https://felix.uazapi.com';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('❌ Sem header de autorização');
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log('❌ Usuário não encontrado:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Usuário autenticado:', user.id);

    // Parse request body
    const body: SendReactionRequest = await req.json();
    const { messageId, emoji, connectionId, contactPhoneNumber, remove = false } = body;

    console.log('📝 Dados recebidos:');
    console.log('   - messageId:', messageId);
    console.log('   - emoji:', emoji);
    console.log('   - connectionId:', connectionId);
    console.log('   - contactPhoneNumber:', contactPhoneNumber);
    console.log('   - remove:', remove);

    // Validate inputs
    if (!messageId || !connectionId || !contactPhoneNumber) {
      console.log('❌ Dados incompletos');
      return new Response(
        JSON.stringify({ success: false, error: 'Dados incompletos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!remove && !emoji) {
      console.log('❌ Emoji é obrigatório para adicionar reação');
      return new Response(
        JSON.stringify({ success: false, error: 'Emoji é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch message to get whatsapp_message_id
    console.log('\n🔍 Buscando mensagem no banco...');
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('id, whatsapp_message_id, direction, conversation_id')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError || !messageData) {
      console.log('❌ Mensagem não encontrada:', messageError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Mensagem não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Mensagem encontrada:', messageData.id);
    console.log('   - whatsapp_message_id:', messageData.whatsapp_message_id);
    console.log('   - direction:', messageData.direction);

    // Log message direction (reactions allowed on both inbound and outbound)
    console.log('   - Direção da mensagem:', messageData.direction);

    if (!messageData.whatsapp_message_id) {
      console.log('❌ Mensagem sem ID do WhatsApp');
      return new Response(
        JSON.stringify({ success: false, error: 'Mensagem sem ID do WhatsApp' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract just the message ID part (without phone prefix)
    let whatsappMessageId = messageData.whatsapp_message_id;
    if (whatsappMessageId.includes(':')) {
      whatsappMessageId = whatsappMessageId.split(':')[1];
    }
    console.log('   - whatsapp_message_id limpo:', whatsappMessageId);

    // 2. Fetch connection to get instance_token and company_id
    console.log('\n🔍 Buscando conexão...');
    const { data: connectionData, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('id, instance_token, company_id, status')
      .eq('id', connectionId)
      .maybeSingle();

    if (connectionError || !connectionData) {
      console.log('❌ Conexão não encontrada:', connectionError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Conexão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Conexão encontrada:', connectionData.id);
    console.log('   - company_id:', connectionData.company_id);
    console.log('   - status:', connectionData.status);

    if (connectionData.status !== 'connected') {
      console.log('❌ WhatsApp desconectado');
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp desconectado', code: 'WHATSAPP_DISCONNECTED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connectionData.instance_token) {
      console.log('❌ Token da instância não encontrado');
      return new Response(
        JSON.stringify({ success: false, error: 'Token da instância não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Prepare phone number with @s.whatsapp.net
    const phoneNumber = contactPhoneNumber.replace(/\D/g, ''); // Remove non-digits
    const fullNumber = `${phoneNumber}@s.whatsapp.net`;
    console.log('\n📞 Número preparado:', fullNumber);

    // 4. Save/remove reaction in database FIRST (optimistic)
    console.log('\n💾 Salvando reação no banco...');
    
    if (remove) {
      // Delete existing reaction from this user
      const { error: deleteError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('reactor_id', user.id)
        .eq('reactor_type', 'user');

      if (deleteError) {
        console.log('❌ Erro ao deletar reação:', deleteError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao remover reação' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✅ Reação removida do banco');
    } else {
      // Upsert reaction - update if exists, insert if not
      const { error: upsertError } = await supabase
        .from('message_reactions')
        .upsert({
          message_id: messageId,
          company_id: connectionData.company_id,
          reactor_type: 'user',
          reactor_id: user.id,
          emoji: emoji,
        }, {
          onConflict: 'message_id,reactor_id,reactor_type',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.log('❌ Erro ao salvar reação:', upsertError.message);
        // Try insert with different approach
        const { error: insertError } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            company_id: connectionData.company_id,
            reactor_type: 'user',
            reactor_id: user.id,
            emoji: emoji,
          });
        
        if (insertError) {
          // Check if it's a duplicate error - if so, update instead
          if (insertError.code === '23505') {
            const { error: updateError } = await supabase
              .from('message_reactions')
              .update({ emoji: emoji, updated_at: new Date().toISOString() })
              .eq('message_id', messageId)
              .eq('reactor_id', user.id)
              .eq('reactor_type', 'user');
            
            if (updateError) {
              console.log('❌ Erro ao atualizar reação:', updateError.message);
              return new Response(
                JSON.stringify({ success: false, error: 'Erro ao salvar reação' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            console.log('❌ Erro ao inserir reação:', insertError.message);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao salvar reação' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
      console.log('✅ Reação salva no banco');
    }

    // 5. Send to UAZAPI
    console.log('\n📨 Enviando para UAZAPI...');
    console.log('   - URL:', `${uazapiBaseUrl}/message/react`);
    
    const uazapiBody = {
      number: fullNumber,
      text: remove ? '' : emoji,  // Empty string to remove
      id: whatsappMessageId,
    };
    
    console.log('   - Body:', JSON.stringify(uazapiBody));

    const uazapiResponse = await fetch(`${uazapiBaseUrl}/message/react`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': connectionData.instance_token,
      },
      body: JSON.stringify(uazapiBody),
    });

    const responseText = await uazapiResponse.text();
    console.log('   - Status:', uazapiResponse.status);
    console.log('   - Response:', responseText);

    if (!uazapiResponse.ok) {
      console.log('❌ Erro na UAZAPI');
      // Don't fail completely - the reaction is already saved in our database
      // The webhook might not arrive but the UI will show correctly
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: 'Reação salva localmente, mas houve erro ao enviar para WhatsApp',
          uazapiStatus: uazapiResponse.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('\n✅ Reação enviada com sucesso!');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
