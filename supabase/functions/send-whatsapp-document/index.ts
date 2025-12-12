import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📨 Edge Function: send-whatsapp-document iniciada');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uazapiBaseUrl = Deno.env.get('UAZAPI_BASE_URL');

    if (!uazapiBaseUrl) {
      throw new Error('UAZAPI_BASE_URL not configured in secrets');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const {
      documentData,
      fileName,
      mimeType,
      conversationId,
      connectionId,
      contactPhoneNumber,
      text,
      quotedMessageId
    } = body;

    console.log(`📥 Recebido documento: ${fileName}`);

    // Validate required fields
    if (!documentData || !fileName || !conversationId || !connectionId || !contactPhoneNumber) {
      throw new Error('Missing required fields');
    }

    // Extract base64 data (remove data URI prefix if present)
    const base64Match = documentData.match(/^data:[^;]+;base64,(.+)$/);
    const pureBase64 = base64Match ? base64Match[1] : documentData;

    // Calculate file size
    const fileSize = Math.round((pureBase64.length * 3) / 4);
    const maxSize = 100 * 1024 * 1024; // 100MB

    console.log(`💾 Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    if (fileSize > maxSize) {
      throw new Error('Arquivo muito grande. O limite é 100MB.');
    }

    // Get file extension
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'bin';
    
    // Get file type description
    const getFileType = (ext: string): string => {
      switch(ext) {
        case 'pdf': return 'PDF';
        case 'doc':
        case 'docx': return 'Word';
        case 'xls':
        case 'xlsx': return 'Excel';
        case 'ppt':
        case 'pptx': return 'PowerPoint';
        case 'txt': return 'Texto';
        case 'csv': return 'CSV';
        case 'md': return 'Markdown';
        case 'zip': return 'ZIP';
        case 'rar': return 'RAR';
        default: return 'Documento';
      }
    };

    const fileType = getFileType(fileExtension);
    console.log(`📄 Tipo: ${fileType}`);

    // Get connection data
    console.log('🔍 Buscando dados da conexão...');
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('instance_token, company_id, status')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      console.error('❌ Conexão não encontrada:', connectionError);
      throw new Error('CONNECTION_NOT_FOUND');
    }

    if (connection.status !== 'connected') {
      console.error('❌ WhatsApp desconectado');
      throw new Error('WHATSAPP_DISCONNECTED');
    }

    console.log(`✅ Token: ${connection.instance_token?.substring(0, 10)}...`);

    // Convert base64 to buffer
    const binaryString = atob(pureBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename for storage
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const storagePath = `${connection.company_id}/${connectionId}/${yearMonth}/document_${timestamp}_${randomSuffix}.${fileExtension}`;

    console.log('📤 Upload para Storage...');

    // Convert unsupported mime types to application/octet-stream
    // Supabase Storage doesn't support text/plain and some other text types
    const unsupportedMimeTypes = ['text/plain', 'text/csv', 'text/markdown', 'text/x-markdown'];
    const storageContentType = unsupportedMimeTypes.includes(mimeType) 
      ? 'application/octet-stream' 
      : (mimeType || 'application/octet-stream');

    console.log(`📦 Content-Type para Storage: ${storageContentType} (original: ${mimeType})`);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, bytes, {
        contentType: storageContentType,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    const mediaUrl = publicUrlData.publicUrl;
    console.log(`✅ Upload OK: ${mediaUrl}`);

    // Save message to database with pending status
    console.log('💾 Salvando mensagem no banco (pending)...');

    const messageData: any = {
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'user',
      sender_id: user.id,
      message_type: 'document',
      content: text || null,
      media_url: mediaUrl,
      media_mime_type: mimeType || 'application/octet-stream',
      status: 'pending',
      metadata: {
        fileName: fileName,
        fileExtension: fileExtension,
        fileType: fileType,
        fileSize: fileSize,
        originalFileName: fileName,
        hasText: !!text,
        storagePath: storagePath
      }
    };

    if (quotedMessageId) {
      messageData.quoted_message_id = quotedMessageId;
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao salvar mensagem:', messageError);
      throw new Error(`Failed to save message: ${messageError.message}`);
    }

    console.log(`✅ Mensagem salva: ${message.id}`);

    // Update conversation's last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Extract phone number
    const phoneNumber = contactPhoneNumber.replace(/[^0-9]/g, '');
    console.log(`📞 Número extraído: ${phoneNumber}`);

    // Get replyid if quoting a message
    let replyId: string | null = null;
    if (quotedMessageId) {
      console.log('🔍 Buscando whatsapp_message_id da mensagem citada...');
      const { data: quotedMessage } = await supabase
        .from('messages')
        .select('whatsapp_message_id')
        .eq('id', quotedMessageId)
        .maybeSingle();
      
      if (quotedMessage?.whatsapp_message_id) {
        const fullId = quotedMessage.whatsapp_message_id;
        replyId = fullId.includes(':') ? fullId.split(':').pop()! : fullId;
        console.log(`✅ replyId encontrado: ${replyId}`);
      } else {
        console.log('⚠️ Mensagem citada não tem whatsapp_message_id');
      }
    }

    // Send to UAZAPI
    console.log(`🔍 Buscando UAZAPI_BASE_URL dos secrets...`);
    console.log(`✅ URL: ${uazapiBaseUrl}`);
    console.log('📨 Enviando para UAZAPI...');

    const uazapiPayload: any = {
      number: phoneNumber,
      type: 'document',
      file: mediaUrl
    };

    if (text) {
      uazapiPayload.text = text;
    }

    if (replyId) {
      uazapiPayload.replyid = replyId;
    }

    console.log('📤 POST /send/media');
    console.log(`   Body: { number: ${phoneNumber}, type: "document", file: ${mediaUrl.substring(0, 50)}..., text: ${text ? 'yes' : 'no'}, replyid: ${replyId || 'no'} }`);

    const uazapiResponse = await fetch(`${uazapiBaseUrl}/send/media`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': connection.instance_token!
      },
      body: JSON.stringify(uazapiPayload)
    });

    const responseText = await uazapiResponse.text();
    console.log(`📥 UAZAPI Response status: ${uazapiResponse.status}`);
    console.log(`📥 UAZAPI Response: ${responseText.substring(0, 500)}`);

    let uazapiData;
    try {
      uazapiData = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse UAZAPI response:', e);
      uazapiData = { raw: responseText };
    }

    if (!uazapiResponse.ok) {
      console.error('❌ Erro no envio UAZAPI:', uazapiData);

      // Update message status to failed
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          metadata: {
            ...messageData.metadata,
            error: uazapiData
          }
        })
        .eq('id', message.id);

      throw new Error(`UAZAPI error: ${JSON.stringify(uazapiData)}`);
    }

    // Extract whatsapp_message_id from response - check multiple possible locations
    const whatsappMessageId = uazapiData?.key?.id || 
                              uazapiData?.messageId || 
                              uazapiData?.id ||
                              uazapiData?.message?.id ||
                              null;
    console.log(`📋 UAZAPI Response structure:`, JSON.stringify(uazapiData, null, 2));
    console.log(`✅ WhatsApp Message ID extraído: ${whatsappMessageId}`);

    // Update message status to sent with whatsapp_message_id
    console.log('🔄 Atualizando status: sent e whatsapp_message_id...');
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'sent',
        whatsapp_message_id: whatsappMessageId
      })
      .eq('id', message.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar mensagem:', updateError);
    } else {
      console.log(`✅ Mensagem atualizada com whatsapp_message_id: ${whatsappMessageId}`);
    }

    console.log('✅ Concluído!');

    return new Response(
      JSON.stringify({
        success: true,
        messageId: message.id,
        status: 'sent',
        mediaUrl: mediaUrl,
        whatsappMessageId: whatsappMessageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in send-whatsapp-document:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        status: error.message === 'Unauthorized' ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
