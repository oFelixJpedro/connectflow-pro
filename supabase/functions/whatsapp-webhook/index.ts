import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get base URL from secrets (REQUIRED - no fallback)
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL')?.trim() || ''

// Initialize Redis client for queue operations
let redis: Redis | null = null
try {
  const redisUrl = Deno.env.get('UPSTASH_REDIS_URL')
  const redisToken = Deno.env.get('UPSTASH_REDIS_TOKEN')
  if (redisUrl && redisToken) {
    redis = new Redis({ url: redisUrl, token: redisToken })
  }
} catch (e) {
  console.log('⚠️ Redis not configured, falling back to EdgeRuntime.waitUntil')
}

// Declare EdgeRuntime for TypeScript (fallback when Redis unavailable)
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};
// Helper to extract phone number from WhatsApp JID
function extractPhoneNumber(jid: string): string {
  if (!jid) return ''
  return jid.split('@')[0]
}

// Helper to convert Unix timestamp (milliseconds) to ISO string
function convertTimestamp(timestamp: number): string {
  if (!timestamp) return new Date().toISOString()
  return new Date(timestamp).toISOString()
}

// Helper to get correct mimetype based on file extension for display purposes
function getDisplayMimeType(fileName: string | undefined, originalMimeType: string): string {
  const extension = fileName?.split('.').pop()?.toLowerCase()
  
  const extensionMimeMap: Record<string, string> = {
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    '3gp': 'video/3gpp',
    'avi': 'video/x-msvideo',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
  }
  
  if (extension && extensionMimeMap[extension]) {
    return extensionMimeMap[extension]
  }
  
  if (originalMimeType && originalMimeType.trim()) {
    return originalMimeType.split(';')[0].trim()
  }
  
  return 'application/octet-stream'
}

// Helper to get Storage-safe mimetype
function getStorageSafeMimeType(displayMimeType: string): string {
  const unsupportedMimeTypes = [
    'text/markdown',
    'text/html',
    'text/css',
    'text/javascript',
    'text/xml',
    'text/csv',
    'text/plain',
  ]
  
  if (unsupportedMimeTypes.includes(displayMimeType) || displayMimeType.startsWith('text/')) {
    return 'application/octet-stream'
  }
  
  return displayMimeType
}

// Helper to get file extension from mime type
function getExtensionFromMimeType(mimeType: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext && ext.length <= 10) {
      return ext
    }
  }
  
  const mimeMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/opus': 'opus',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
  }
  
  const baseMime = mimeType.split(';')[0].trim().toLowerCase()
  
  if (mimeMap[baseMime]) return mimeMap[baseMime]
  
  const typePart = baseMime.split('/')[1]
  if (typePart) {
    if (typePart === 'jpeg') return 'jpg'
    return typePart
  }
  
  return 'bin'
}

// Helper to download media from UAZAPI via POST /message/download with base64
async function downloadMediaFromUazapi(
  messageId: string, 
  uazapiBaseUrl: string, 
  instanceToken: string
): Promise<{ buffer: Uint8Array; mimeType: string; fileSize: number } | null> {
  const downloadUrl = `${uazapiBaseUrl}/message/download`
  
  console.log(`🔽 Downloading media via POST ${downloadUrl}`)
  console.log(`   - messageId: ${messageId}`)
  
  if (!instanceToken) {
    console.log(`❌ Erro: Token vazio!`)
    return null
  }
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instanceToken,
        },
        body: JSON.stringify({
          id: messageId,
          return_base64: true,
        }),
      })
      
      const responseText = await response.text()
      
      if (!response.ok) {
        console.log(`❌ Download failed: ${response.status}`)
        if (attempt === 2) return null
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.log(`❌ Failed to parse response as JSON`)
        if (attempt === 2) return null
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      
      let base64 = data.base64Data || data.base64 || data.data?.base64 || data.media?.base64
      const mimeType = data.mimetype || data.data?.mimetype || data.media?.mimetype || 'audio/ogg'
      const fileSize = data.fileSize || data.data?.fileSize || data.media?.fileSize || 0
      
      if (!base64) {
        console.log(`❌ base64Data not found in response`)
        if (attempt === 2) return null
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      
      if (base64.includes(',')) {
        base64 = base64.split(',')[1]
      }
      
      const binaryString = atob(base64)
      const buffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i)
      }
      
      console.log(`✅ Downloaded ${buffer.byteLength} bytes`)
      return { buffer, mimeType: mimeType.split(';')[0].trim(), fileSize: fileSize || buffer.byteLength }
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} error:`, error)
      if (attempt === 2) return null
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTO ASSÍNCRONO DE MÍDIA (Background Task)
// ═══════════════════════════════════════════════════════════════════════════════
async function processMediaInBackground(params: {
  messageId: string;
  messageDbId: string;
  mediaType: 'audio' | 'image' | 'video' | 'document' | 'sticker';
  companyId: string;
  whatsappConnectionId: string;
  instanceToken: string;
  mediaMetadata: any;
  contentData: any;
}) {
  const { messageId, messageDbId, mediaType, companyId, whatsappConnectionId, instanceToken, mediaMetadata, contentData } = params;
  
  console.log(`🔄 [BACKGROUND] Iniciando processamento de ${mediaType} para mensagem ${messageDbId}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const downloadResult = await downloadMediaFromUazapi(messageId, UAZAPI_BASE_URL, instanceToken);
    
    if (!downloadResult) {
      console.log(`❌ [BACKGROUND] Falha no download de ${mediaType}`);
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          error_message: 'Download failed from UAZAPI',
          metadata: { ...mediaMetadata, error: 'Download failed', processedAt: new Date().toISOString() }
        })
        .eq('id', messageDbId);
      return;
    }
    
    const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult;
    
    // Determine extension and storage path
    let extension: string;
    let actualMimeType: string;
    
    if (mediaType === 'sticker') {
      extension = 'webp';
      actualMimeType = 'image/webp';
    } else if (mediaType === 'document') {
      const fileName = contentData?.fileName || '';
      const originalMimeType = contentData?.mimetype || 'application/octet-stream';
      extension = getExtensionFromMimeType(originalMimeType, fileName);
      actualMimeType = getStorageSafeMimeType(getDisplayMimeType(fileName, originalMimeType));
    } else {
      actualMimeType = downloadedMimeType;
      extension = getExtensionFromMimeType(actualMimeType);
    }
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileName = `${mediaType}_${Date.now()}_${randomId}.${extension}`;
    const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${fileName}`;
    
    console.log(`📤 [BACKGROUND] Uploading ${mediaType} to: ${storagePath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, buffer, {
        contentType: actualMimeType,
        cacheControl: '31536000',
        upsert: false
      });
    
    if (uploadError) {
      console.log(`❌ [BACKGROUND] Upload error: ${uploadError.message}`);
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          error_message: `Upload failed: ${uploadError.message}`,
          metadata: { ...mediaMetadata, error: 'Upload failed', processedAt: new Date().toISOString() }
        })
        .eq('id', messageDbId);
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uploadData.path);
    
    console.log(`✅ [BACKGROUND] Upload complete: ${publicUrl}`);
    
    // Update message with media URL
    const displayMimeType = mediaType === 'document' 
      ? getDisplayMimeType(contentData?.fileName, contentData?.mimetype || 'application/octet-stream')
      : actualMimeType;
    
    await supabase
      .from('messages')
      .update({
        media_url: publicUrl,
        media_mime_type: displayMimeType,
        status: 'delivered',
        error_message: null,
        metadata: {
          ...mediaMetadata,
          fileName,
          storagePath,
          fileSize: downloadedSize,
          downloadedAt: new Date().toISOString(),
          processedAsync: true
        }
      })
      .eq('id', messageDbId);
    
    console.log(`🎉 [BACKGROUND] ${mediaType} processado com sucesso!`);
    
  } catch (error) {
    console.error(`❌ [BACKGROUND] Erro ao processar ${mediaType}:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTO ASSÍNCRONO DE AGENTE DE IA (Background Task)
// ═══════════════════════════════════════════════════════════════════════════════
async function processAIAgentResponse(params: {
  connectionId: string;
  conversationId: string;
  messageContent: string;
  contactName: string;
  contactPhone: string;
  companyId: string;
  instanceToken: string;
  msgType?: string;
  msgMediaUrl?: string;
}) {
  const { connectionId, conversationId, messageContent, contactName, contactPhone, companyId, instanceToken, msgType = 'text', msgMediaUrl } = params;
  
  console.log(`🤖 [AI AGENT] Iniciando processamento para conversa ${conversationId} (tipo: ${msgType})`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Call AI agent process function
    const aiProcessUrl = `${supabaseUrl}/functions/v1/ai-agent-process`;
    
    const response = await fetch(aiProcessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        connectionId,
        conversationId,
        messageContent,
        contactName,
        contactPhone,
        messageType: msgType,
        mediaUrl: msgMediaUrl
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      if (result.skip) {
        console.log(`🤖 [AI AGENT] Pulando: ${result.reason}`);
      } else {
        console.log(`❌ [AI AGENT] Erro: ${result.error}`);
      }
      return;
    }
    
    const aiResponse = result.response;
    const delaySeconds = result.delaySeconds || 0;
    const voiceName = result.voiceName;
    const speechSpeed = result.speechSpeed || 1.0;
    const audioTemperature = result.audioTemperature || 0.7;
    const languageCode = result.languageCode || 'pt-BR';
    
    console.log(`✅ [AI AGENT] Resposta gerada, aguardando ${delaySeconds}s antes de enviar...`);
    console.log(`🎤 [AI AGENT] Voice config: ${voiceName ? `${voiceName} (speed: ${speechSpeed}, temp: ${audioTemperature}, lang: ${languageCode})` : 'TEXTO'}`);
    
    // Wait for configured delay
    if (delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
    
    // Get contact phone for sending
    const { data: conversation } = await supabase
      .from('conversations')
      .select(`
        contacts!inner (phone_number)
      `)
      .eq('id', conversationId)
      .single();
    
    const contactData = conversation?.contacts as any;
    if (!contactData?.phone_number) {
      console.log('❌ [AI AGENT] Contato não encontrado');
      return;
    }
    
    const phoneNumber = contactData.phone_number;
    
    let whatsappMessageId: string | null = null;
    let messageType: 'text' | 'audio' = 'text';
    let mediaUrl: string | null = null;
    
    // Check if should send audio (voice_name configured)
    if (voiceName) {
      console.log(`🎵 [AI AGENT] Gerando áudio com voz: ${voiceName}`);
      
      // Call ai-agent-tts to generate audio
      const ttsUrl = `${supabaseUrl}/functions/v1/ai-agent-tts`;
      
      const ttsResponse = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          text: aiResponse,
          voiceName: voiceName,
          speed: speechSpeed,
          temperature: audioTemperature,
          languageCode: languageCode
        }),
      });
      
      if (ttsResponse.ok) {
        const ttsResult = await ttsResponse.json();
        const audioUrl = ttsResult.audioUrl;
        
        if (audioUrl) {
          console.log(`✅ [AI AGENT] Áudio gerado: ${audioUrl}`);
          
          // Send audio via UAZAPI /send/media with type: 'ptt' (push-to-talk)
          const sendMediaUrl = `${UAZAPI_BASE_URL}/send/media`;
          
          console.log(`📤 [AI AGENT] Enviando áudio PTT para ${phoneNumber}...`);
          
          const sendResponse = await fetch(sendMediaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': instanceToken,
            },
            body: JSON.stringify({
              number: phoneNumber,
              type: 'ptt',
              file: audioUrl
            }),
          });
          
          if (sendResponse.ok) {
            const sendResult = await sendResponse.json();
            whatsappMessageId = sendResult.key?.id || sendResult.messageId || sendResult.id;
            messageType = 'audio';
            mediaUrl = audioUrl;
            console.log(`✅ [AI AGENT] Áudio enviado! WhatsApp ID: ${whatsappMessageId}`);
          } else {
            const errorText = await sendResponse.text();
            console.log(`❌ [AI AGENT] Erro ao enviar áudio: ${sendResponse.status} - ${errorText}`);
            console.log(`⚠️ [AI AGENT] Fallback para envio de texto...`);
          }
        } else {
          console.log(`❌ [AI AGENT] audioUrl não retornado pelo TTS`);
          console.log(`⚠️ [AI AGENT] Fallback para envio de texto...`);
        }
      } else {
        const errorText = await ttsResponse.text();
        console.log(`❌ [AI AGENT] Erro ao gerar TTS: ${ttsResponse.status} - ${errorText}`);
        console.log(`⚠️ [AI AGENT] Fallback para envio de texto...`);
      }
    }
    
    // Fallback to text if audio failed or not configured
    if (!whatsappMessageId) {
      const sendUrl = `${UAZAPI_BASE_URL}/send/text`;
      
      console.log(`📤 [AI AGENT] Enviando texto para ${phoneNumber}...`);
      
      const sendResponse = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instanceToken,
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: aiResponse
        }),
      });
      
      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        console.log(`❌ [AI AGENT] Erro ao enviar: ${sendResponse.status} - ${errorText}`);
        return;
      }
      
      const sendResult = await sendResponse.json();
      whatsappMessageId = sendResult.key?.id || sendResult.messageId || sendResult.id;
      messageType = 'text';
      console.log(`✅ [AI AGENT] Texto enviado! WhatsApp ID: ${whatsappMessageId}`);
    }
    
    // Save message to database
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'bot',
        sender_id: null,
        content: aiResponse,
        message_type: messageType,
        media_url: mediaUrl,
        media_mime_type: mediaUrl ? 'audio/wav' : null,
        whatsapp_message_id: whatsappMessageId,
        status: 'sent',
        metadata: {
          sentByAIAgent: true,
          agentId: result.agentId,
          agentName: result.agentName,
          audioGenerated: messageType === 'audio',
          voiceName: voiceName || null
        }
      });
    
    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);
    
    console.log(`🎉 [AI AGENT] Processamento completo! (${messageType})`);
    
  } catch (error) {
    console.error(`❌ [AI AGENT] Erro:`, error);
  }
}

// Helper function for error handling (unused but kept for reference)
// async function _handleMediaProcessingError(messageDbId: string, mediaMetadata: any, error: unknown) {
//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL')!,
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
//     );
//     
//     await supabase
//       .from('messages')
//       .update({
//         status: 'failed',
//         error_message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
//         metadata: { ...mediaMetadata, error: 'Processing failed', processedAt: new Date().toISOString() }
//       })
//       .eq('id', messageDbId);
// }

serve(async (req) => {
  const timestamp = new Date().toISOString()
  
  console.log(`📨 WEBHOOK RECEIVED - ${timestamp}`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1️⃣ PARSE REQUEST (FAST PATH)
    // ═══════════════════════════════════════════════════════════════════
    const rawBody = await req.text()
    
    let payload: any = null
    try {
      payload = JSON.parse(rawBody)
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const eventType = payload.EventType
    const instanceName = payload.instanceName
    
    console.log(`🔔 Event: ${eventType} | Instance: ${instanceName}`)
    
    // ═══════════════════════════════════════════════════════════════════
    // HANDLE messages_update EVENT (for deleted messages)
    // ═══════════════════════════════════════════════════════════════════
    if (eventType === 'messages_update') {
      const isDeleted = 
        payload.type === 'DeletedMessage' || 
        payload.state === 'Deleted' || 
        payload.event?.Type === 'Deleted'
      
      if (isDeleted) {
        console.log('🗑️ [MENSAGEM APAGADA]')
        
        const messageIds = payload.event?.MessageIDs || []
        const isFromMe = payload.event?.IsFromMe === true
        const deletedByType = isFromMe ? 'agent' : 'client'
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        for (const waMessageId of messageIds) {
          await supabase
            .from('messages')
            .update({
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              deleted_by_type: deletedByType
            })
            .eq('whatsapp_message_id', waMessageId)
        }
        
        return new Response(
          JSON.stringify({ success: true, action: 'message_deleted', processed: messageIds.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ success: true, message: `messages_update type "${payload.type}" ignored` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if it's a message event
    if (eventType !== 'messages') {
      return new Response(
        JSON.stringify({ success: true, message: `Event type "${eventType}" ignored` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if it's a group message
    if (payload.message?.isGroup === true) {
      return new Response(
        JSON.stringify({ success: true, message: 'Group message ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ DETECT MESSAGE TYPE
    // ═══════════════════════════════════════════════════════════════════
    const rawMessageType = payload.message?.type
    const messageType = payload.message?.messageType
    const mediaType = payload.message?.mediaType
    const contentMimetype = payload.message?.content?.mimetype || ''
    
    // Detect media type
    let isAudioMessage = false
    let isImageMessage = false
    let isVideoMessage = false
    let isDocumentMessage = false
    let isStickerMessage = false
    let isMediaMessage = false
    let contentData: any = null
    
    const isAudioByMessageType = messageType === 'AudioMessage'
    const isAudioByMediaType = mediaType === 'ptt' || mediaType === 'audio'
    const isAudioByMimetype = typeof contentMimetype === 'string' && contentMimetype.startsWith('audio/')
    
    if (isAudioByMessageType || isAudioByMediaType || isAudioByMimetype) {
      isAudioMessage = true
      isMediaMessage = true
      contentData = payload.message?.content || {}
    }
    
    const isImageByMessageType = messageType === 'ImageMessage'
    const isImageByMediaType = mediaType === 'image'
    const isImageByMimetype = typeof contentMimetype === 'string' && contentMimetype.startsWith('image/')
    
    if (!isAudioMessage && (isImageByMessageType || isImageByMediaType || isImageByMimetype)) {
      isImageMessage = true
      isMediaMessage = true
      contentData = payload.message?.content || {}
    }
    
    const isVideoByMessageType = messageType === 'VideoMessage'
    const isVideoByMediaType = mediaType === 'video'
    const isVideoByMimetype = typeof contentMimetype === 'string' && contentMimetype.startsWith('video/')
    
    if (!isAudioMessage && !isImageMessage && (isVideoByMessageType || isVideoByMediaType || isVideoByMimetype)) {
      isVideoMessage = true
      isMediaMessage = true
      contentData = payload.message?.content || {}
    }
    
    const isDocumentByMessageType = messageType === 'DocumentMessage' || messageType === 'DocumentWithCaptionMessage'
    const isDocumentByType = rawMessageType === 'document'
    const isDocumentByMediaType = mediaType === 'document'
    const documentFileName = payload.message?.content?.fileName || ''
    const isMarkdownByExtension = /\.(md|markdown)$/i.test(documentFileName)
    
    if (!isAudioMessage && !isImageMessage && !isVideoMessage && (isDocumentByMessageType || isDocumentByType || isDocumentByMediaType || isMarkdownByExtension)) {
      isDocumentMessage = true
      isMediaMessage = true
      contentData = payload.message?.content || {}
    }
    
    const isStickerByMessageType = messageType === 'StickerMessage'
    const isStickerByType = rawMessageType === 'sticker'
    
    if (!isAudioMessage && !isImageMessage && !isVideoMessage && !isDocumentMessage && (isStickerByMessageType || isStickerByType)) {
      isStickerMessage = true
      isMediaMessage = true
      contentData = payload.message?.content || {}
    }
    
    // Handle reactions separately
    if (rawMessageType === 'reaction' || messageType === 'ReactionMessage') {
      console.log(`😀 [REAÇÃO DETECTADA]`)
      
      const reactionEmoji = payload.message?.text || payload.message?.content?.text || ''
      const originalMessageId = payload.message?.content?.key?.ID || payload.message?.reaction || ''
      const fromMe = payload.message?.fromMe || payload.message?.content?.key?.fromMe || false
      const reactionMessageId = payload.message?.messageid
      const reactionSender = payload.message?.sender
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: connection } = await supabase
        .from('whatsapp_connections')
        .select('id, company_id')
        .eq('session_id', instanceName)
        .maybeSingle()
      
      if (!connection) {
        return new Response(
          JSON.stringify({ success: true, message: 'Connection not found for reaction' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const companyId = connection.company_id
      
      const phoneOwner = payload.message?.owner || payload.chat?.owner || payload.owner || ''
      const possibleIds = [
        originalMessageId,
        `${phoneOwner}:${originalMessageId}`,
        originalMessageId.includes(':') ? originalMessageId.split(':')[1] : null
      ].filter(Boolean)
      
      let originalMessage = null
      for (const searchId of possibleIds) {
        const { data: msg } = await supabase
          .from('messages')
          .select('id, conversation_id')
          .eq('whatsapp_message_id', searchId)
          .maybeSingle()
        
        if (msg) {
          originalMessage = msg
          break
        }
      }
      
      if (!originalMessage) {
        return new Response(
          JSON.stringify({ success: true, message: 'Original message not found for reaction' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      let reactorType: 'contact' | 'user' = 'contact'
      let reactorId: string | null = null
      
      if (fromMe) {
        reactorType = 'user'
        const { data: companyUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', companyId)
          .limit(1)
          .maybeSingle()
        
        if (companyUser) {
          reactorId = companyUser.id
        }
      } else {
        const phoneNumber = reactionSender?.split('@')[0] || payload.chat?.wa_chatid?.split('@')[0] || ''
        
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('company_id', companyId)
          .eq('phone_number', phoneNumber)
          .maybeSingle()
        
        if (contact) {
          reactorId = contact.id
        }
      }
      
      if (!reactorId) {
        return new Response(
          JSON.stringify({ success: true, message: 'Could not identify reactor' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (!reactionEmoji || reactionEmoji.trim() === '') {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', originalMessage.id)
          .eq('reactor_type', reactorType)
          .eq('reactor_id', reactorId)
      } else {
        await supabase
          .from('message_reactions')
          .upsert({
            message_id: originalMessage.id,
            company_id: companyId,
            reactor_type: reactorType,
            reactor_id: reactorId,
            emoji: reactionEmoji,
            whatsapp_message_id: reactionMessageId,
          }, {
            onConflict: 'message_id,reactor_type,reactor_id',
          })
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Reaction processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check for text messages (including links with preview)
    if (!isMediaMessage && (rawMessageType === 'text' || rawMessageType === 'chat' || rawMessageType === 'media' && (messageType === 'ExtendedTextMessage' || mediaType === 'url'))) {
      // Text message - continue processing
    } else if (!isMediaMessage) {
      // Unsupported type
      return new Response(
        JSON.stringify({ success: true, message: `Message type "${rawMessageType || messageType}" ignored` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ VALIDATE REQUIRED FIELDS
    // ═══════════════════════════════════════════════════════════════════
    const messageId = payload.message?.messageid
    const sender = payload.message?.sender
    const messageText = payload.message?.text
    
    if (!instanceName || !messageId || !sender) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const isTextMessage = !isMediaMessage
    if (isTextMessage && !messageText && messageText !== '') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing message.text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Extract quoted message ID if present
    const quotedWhatsAppId = 
      payload.message?.quoted || 
      payload.message?.content?.contextInfo?.stanzaID ||
      null
    
    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ INITIALIZE SUPABASE & FIND CONNECTION
    // ═══════════════════════════════════════════════════════════════════
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('id, company_id, instance_token, name')
      .eq('session_id', instanceName)
      .maybeSingle()
    
    if (connectionError || !connection) {
      console.log(`❌ Conexão não encontrada: ${instanceName}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const whatsappConnectionId = connection.id
    const companyId = connection.company_id
    const dbInstanceToken = connection.instance_token
    const payloadToken = payload.token || payload.instanceToken || ''
    const instanceToken = dbInstanceToken || payloadToken
    
    // Update instance_token if missing in DB
    if (!dbInstanceToken && payloadToken) {
      await supabase
        .from('whatsapp_connections')
        .update({ instance_token: payloadToken })
        .eq('id', whatsappConnectionId)
    }
    
    // Get default department
    let defaultDepartmentId: string | null = null
    const { data: defaultDepartment } = await supabase
      .from('departments')
      .select('id, name')
      .eq('whatsapp_connection_id', whatsappConnectionId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    
    if (defaultDepartment) {
      defaultDepartmentId = defaultDepartment.id
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ PROCESS CONTACT
    // ═══════════════════════════════════════════════════════════════════
    let phoneNumber: string
    
    if (payload.chat?.wa_chatid) {
      phoneNumber = payload.chat.wa_chatid.split('@')[0]
    } else if (payload.message?.chatid) {
      phoneNumber = payload.message.chatid.split('@')[0]
    } else if (payload.chat?.phone) {
      phoneNumber = payload.chat.phone.replace(/[^\d]/g, '')
    } else {
      phoneNumber = extractPhoneNumber(sender)
    }
    
    const contactName = payload.chat?.wa_name || payload.message?.senderName || phoneNumber
    const profilePictureUrl = payload.chat?.imagePreview || payload.chat?.image || payload.chat?.profilePicUrl || null
    
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, name, name_manually_edited')
      .eq('company_id', companyId)
      .eq('phone_number', phoneNumber)
      .maybeSingle()
    
    let contactId: string
    
    if (existingContact) {
      const updateData: any = {
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      if (!existingContact.name_manually_edited) {
        updateData.name = contactName
      }
      
      if (profilePictureUrl) {
        updateData.avatar_url = profilePictureUrl
      }
      
      await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', existingContact.id)
      
      contactId = existingContact.id
    } else {
      const { data: newContact, error: createContactError } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          phone_number: phoneNumber,
          name: contactName,
          name_manually_edited: false,
          avatar_url: profilePictureUrl,
          last_interaction_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()
      
      if (createContactError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating contact' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      contactId = newContact.id
      
      // Auto-add to CRM if enabled
      const { data: boardData } = await supabase
        .from('kanban_boards')
        .select('id, auto_add_new_contacts')
        .eq('whatsapp_connection_id', whatsappConnectionId)
        .maybeSingle()
      
      if (boardData?.auto_add_new_contacts) {
        const { data: firstColumn } = await supabase
          .from('kanban_columns')
          .select('id')
          .eq('board_id', boardData.id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle()
        
        if (firstColumn) {
          const { data: existingCard } = await supabase
            .from('kanban_cards')
            .select('id')
            .eq('contact_id', contactId)
            .maybeSingle()
          
          if (!existingCard) {
            const { data: maxPosData } = await supabase
              .from('kanban_cards')
              .select('position')
              .eq('column_id', firstColumn.id)
              .order('position', { ascending: false })
              .limit(1)
              .maybeSingle()
            
            const newPosition = (maxPosData?.position ?? -1) + 1
            
            await supabase
              .from('kanban_cards')
              .insert({
                contact_id: contactId,
                column_id: firstColumn.id,
                position: newPosition,
                priority: 'medium'
              })
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ PROCESS CONVERSATION
    // ═══════════════════════════════════════════════════════════════════
    const isFromMe = payload.message?.fromMe === true
    const messageTimestamp = convertTimestamp(payload.message?.messageTimestamp)
    
    // First: try to find an OPEN conversation
    const { data: openConversation } = await supabase
      .from('conversations')
      .select('id, unread_count, status')
      .eq('contact_id', contactId)
      .eq('whatsapp_connection_id', whatsappConnectionId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    let conversationId: string
    
    if (openConversation) {
      // Use existing open conversation
      const newUnreadCount = isFromMe ? openConversation.unread_count : (openConversation.unread_count || 0) + 1
      
      await supabase
        .from('conversations')
        .update({
          last_message_at: messageTimestamp,
          unread_count: newUnreadCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', openConversation.id)
      
      conversationId = openConversation.id
    } else {
      // No open conversation found - check for a CLOSED conversation to reopen
      const { data: closedConversation } = await supabase
        .from('conversations')
        .select('id, status, metadata')
        .eq('contact_id', contactId)
        .eq('whatsapp_connection_id', whatsappConnectionId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (closedConversation) {
        // REOPEN the closed conversation (don't create a new one!)
        console.log(`🔄 Reabrindo conversa fechada: ${closedConversation.id}`)
        
        const existingMetadata = (closedConversation.metadata as Record<string, unknown>) || {}
        
        await supabase
          .from('conversations')
          .update({
            status: 'open',
            closed_at: null,
            assigned_user_id: null,
            assigned_at: null,
            unread_count: isFromMe ? 0 : 1,
            last_message_at: messageTimestamp,
            updated_at: new Date().toISOString(),
            metadata: {
              ...existingMetadata,
              autoReopened: true,
              reopenedAt: new Date().toISOString(),
              reopenedByClient: true
            }
          })
          .eq('id', closedConversation.id)
        
        // Log the reopening in conversation history
        await supabase
          .from('conversation_history')
          .insert({
            conversation_id: closedConversation.id,
            event_type: 'reopened',
            event_data: {
              reason: 'client_message',
              previous_status: 'closed'
            },
            performed_by: null,
            performed_by_name: 'Sistema',
            is_automatic: true
          })
        
        conversationId = closedConversation.id
      } else {
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          company_id: companyId,
          contact_id: contactId,
          whatsapp_connection_id: whatsappConnectionId,
          department_id: defaultDepartmentId,
          status: 'open',
          unread_count: isFromMe ? 0 : 1,
          last_message_at: messageTimestamp,
          channel: 'whatsapp'
        })
        .select('id')
        .single()
      
      if (createConvError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
        conversationId = newConversation.id
        
        // Log conversation creation
        await supabase
          .from('conversation_history')
          .insert({
            conversation_id: conversationId,
            event_type: 'created',
            event_data: {
              connection_id: whatsappConnectionId,
              connection_name: connection.name || 'WhatsApp',
              department_id: defaultDepartmentId,
              department_name: defaultDepartment?.name || 'Geral',
              contact_name: contactName,
              contact_phone: phoneNumber
            },
            performed_by: null,
            performed_by_name: 'Sistema',
            is_automatic: true
          })
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 7️⃣ CHECK DUPLICATE
    // ═══════════════════════════════════════════════════════════════════
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('whatsapp_message_id', messageId)
      .maybeSingle()
    
    if (existingMessage) {
      console.log(`⚠️ Duplicate message: ${messageId}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Duplicate message ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 8️⃣ LOOKUP QUOTED MESSAGE
    // ═══════════════════════════════════════════════════════════════════
    let quotedMessageDbId: string | null = null
    if (quotedWhatsAppId) {
      let { data: quotedMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('whatsapp_message_id', quotedWhatsAppId)
        .eq('conversation_id', conversationId)
        .maybeSingle()
      
      if (!quotedMsg) {
        const { data: quotedMsgLike } = await supabase
          .from('messages')
          .select('id')
          .like('whatsapp_message_id', `%${quotedWhatsAppId}`)
          .eq('conversation_id', conversationId)
          .limit(1)
          .maybeSingle()
        
        quotedMsg = quotedMsgLike
      }
      
      if (quotedMsg) {
        quotedMessageDbId = quotedMsg.id
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 9️⃣ SAVE MESSAGE (FAST - WITHOUT MEDIA DOWNLOAD)
    // ═══════════════════════════════════════════════════════════════════
    const direction = isFromMe ? 'outbound' : 'inbound'
    const senderType = isFromMe ? 'user' : 'contact'
    
    let dbMessageType: string
    let messageContent: string | null = null
    let initialStatus = 'delivered'
    let mediaMetadata: any = {}
    
    if (isAudioMessage) {
      dbMessageType = 'audio'
      initialStatus = 'pending' // Will be updated after background processing
      mediaMetadata = {
        duration: contentData?.seconds || 0,
        fileSize: contentData?.fileLength || 0,
        isPTT: contentData?.PTT === true || mediaType === 'ptt',
        mimeType: contentData?.mimetype || 'audio/ogg',
        pendingDownload: true
      }
    } else if (isImageMessage) {
      dbMessageType = 'image'
      initialStatus = 'pending'
      messageContent = contentData?.caption || null
      mediaMetadata = {
        width: contentData?.width || 0,
        height: contentData?.height || 0,
        fileSize: contentData?.fileLength || 0,
        mimeType: contentData?.mimetype || 'image/jpeg',
        hasCaption: !!contentData?.caption,
        pendingDownload: true
      }
    } else if (isVideoMessage) {
      dbMessageType = 'video'
      initialStatus = 'pending'
      messageContent = contentData?.caption || null
      mediaMetadata = {
        width: contentData?.width || 0,
        height: contentData?.height || 0,
        duration: contentData?.seconds || 0,
        fileSize: contentData?.fileLength || 0,
        mimeType: contentData?.mimetype || 'video/mp4',
        hasCaption: !!contentData?.caption,
        pendingDownload: true
      }
    } else if (isDocumentMessage) {
      dbMessageType = 'document'
      initialStatus = 'pending'
      messageContent = contentData?.caption || null
      mediaMetadata = {
        fileName: contentData?.fileName || 'document',
        fileSize: contentData?.fileLength || 0,
        mimeType: contentData?.mimetype || 'application/octet-stream',
        pageCount: contentData?.pageCount || null,
        hasCaption: !!contentData?.caption,
        pendingDownload: true
      }
    } else if (isStickerMessage) {
      dbMessageType = 'sticker'
      initialStatus = 'pending'
      mediaMetadata = {
        width: contentData?.width || 512,
        height: contentData?.height || 512,
        fileSize: contentData?.fileLength || 0,
        isAnimated: contentData?.isAnimated || false,
        pendingDownload: true
      }
    } else {
      dbMessageType = 'text'
      messageContent = messageText
    }
    
    const { data: savedMessage, error: saveMessageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction: direction,
        sender_type: senderType,
        sender_id: null,
        content: messageContent,
        message_type: dbMessageType,
        media_url: null,
        media_mime_type: null,
        whatsapp_message_id: messageId,
        status: initialStatus,
        error_message: null,
        metadata: mediaMetadata,
        quoted_message_id: quotedMessageDbId,
        created_at: messageTimestamp
      })
      .select('id')
      .single()
    
    if (saveMessageError) {
      console.log(`❌ Error saving message: ${saveMessageError.message}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Error saving message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`✅ Message saved: ${savedMessage.id} (${dbMessageType})`)
    
    // ═══════════════════════════════════════════════════════════════════
    // 🚀 PROCESS MEDIA (QUEUE or BACKGROUND)
    // ═══════════════════════════════════════════════════════════════════
    if (isMediaMessage && instanceToken) {
      const detectedMediaType = isAudioMessage ? 'audio' 
        : isImageMessage ? 'image' 
        : isVideoMessage ? 'video' 
        : isDocumentMessage ? 'document' 
        : 'sticker'
      
      const mediaQueueData = {
        messageDbId: savedMessage.id,
        whatsappMessageId: messageId,
        mediaType: detectedMediaType,
        companyId,
        whatsappConnectionId,
        instanceToken,
        mediaMetadata,
        contentData
      }
      
      // Use Redis queue if available, otherwise fallback to EdgeRuntime.waitUntil
      if (redis) {
        console.log(`📤 [QUEUE] Enqueuing ${detectedMediaType} to Redis queue`)
        try {
          await redis.rpush('queue:media', JSON.stringify({
            data: mediaQueueData,
            attempts: 0,
            enqueuedAt: new Date().toISOString()
          }))
          console.log(`✅ [QUEUE] Media enqueued successfully`)
        } catch (queueError) {
          console.log(`⚠️ [QUEUE] Redis error, falling back to waitUntil:`, queueError)
          EdgeRuntime.waitUntil(
            processMediaInBackground({
              messageId,
              messageDbId: savedMessage.id,
              mediaType: detectedMediaType,
              companyId,
              whatsappConnectionId,
              instanceToken,
              mediaMetadata,
              contentData
            })
          )
        }
      } else {
        console.log(`🚀 Scheduling background processing for ${detectedMediaType} (no Redis)`)
        EdgeRuntime.waitUntil(
          processMediaInBackground({
            messageId,
            messageDbId: savedMessage.id,
            mediaType: detectedMediaType,
            companyId,
            whatsappConnectionId,
            instanceToken,
            mediaMetadata,
            contentData
          })
        )
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🤖 PROCESS AI AGENT (QUEUE or BACKGROUND)
    // ═══════════════════════════════════════════════════════════════════
    // Process AI agent for text, audio and image messages (not stickers, documents, videos)
    const aiSupportedTypes = ['text', 'audio', 'image'];
    if (!isFromMe && aiSupportedTypes.includes(dbMessageType)) {
      const aiQueueData = {
        connectionId: whatsappConnectionId,
        conversationId,
        messageContent: messageContent || '',
        contactName,
        contactPhone: phoneNumber,
        companyId,
        instanceToken,
        msgType: dbMessageType,
        msgMediaUrl: undefined
      }
      
      // Use Redis queue if available, otherwise fallback to EdgeRuntime.waitUntil
      if (redis) {
        console.log(`📤 [QUEUE] Enqueuing AI agent task to Redis queue`)
        try {
          await redis.rpush('queue:ai-agent', JSON.stringify({
            data: aiQueueData,
            attempts: 0,
            enqueuedAt: new Date().toISOString()
          }))
          console.log(`✅ [QUEUE] AI agent task enqueued successfully`)
        } catch (queueError) {
          console.log(`⚠️ [QUEUE] Redis error, falling back to waitUntil:`, queueError)
          EdgeRuntime.waitUntil(
            processAIAgentResponse(aiQueueData)
          )
        }
      } else {
        console.log(`🤖 Checking AI agent for this connection... (type: ${dbMessageType}, no Redis)`)
        EdgeRuntime.waitUntil(
          processAIAgentResponse(aiQueueData)
        )
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎉 RETURN IMMEDIATELY
    // ═══════════════════════════════════════════════════════════════════
    return new Response(
      JSON.stringify({
        success: true,
        message_id: savedMessage.id,
        conversation_id: conversationId,
        contact_id: contactId,
        type: dbMessageType,
        async_processing: isMediaMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
