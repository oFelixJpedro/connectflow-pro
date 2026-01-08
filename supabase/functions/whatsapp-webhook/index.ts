import { createClient } from "npm:@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";

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

// ═══════════════════════════════════════════════════════════════════
// COPY MEDIA TO PUBLIC BUCKET FOR PERMANENT URLs
// ═══════════════════════════════════════════════════════════════════
async function copyMediaToPublicBucket(
  supabase: any,
  privateUrl: string,
  agentId: string,
  mediaKey: string,
  mimeType?: string
): Promise<string | null> {
  try {
    console.log(`📋 [WEBHOOK] Copiando mídia para bucket público: ${mediaKey}`);
    
    // If URL is already from whatsapp-media (public), return as is
    if (privateUrl.includes('/whatsapp-media/') && !privateUrl.includes('token=')) {
      console.log(`✅ [WEBHOOK] Mídia já está no bucket público`);
      return privateUrl;
    }
    
    // Download from private bucket using signed URL
    const response = await fetch(privateUrl);
    if (!response.ok) {
      console.error(`❌ [WEBHOOK] Erro ao baixar mídia: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const contentType = mimeType || response.headers.get('content-type') || 'application/octet-stream';
    
    // Generate unique path in public bucket
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
      'application/pdf': 'pdf', 'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    const ext = extMap[contentType] || contentType.split('/')[1] || 'bin';
    const uniquePath = `ai-agent/${agentId}/${mediaKey}-${Date.now()}.${ext}`;
    
    // Upload to public bucket
    const { error } = await supabase.storage
      .from('whatsapp-media')
      .upload(uniquePath, new Uint8Array(arrayBuffer), {
        contentType,
        upsert: true
      });
    
    if (error) {
      console.error(`❌ [WEBHOOK] Erro ao fazer upload para bucket público:`, error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uniquePath);
    
    console.log(`✅ [WEBHOOK] Mídia copiada para bucket público: ${publicUrl}`);
    return publicUrl;
  } catch (e) {
    console.error(`❌ [WEBHOOK] Erro ao copiar mídia:`, e);
    return null;
  }
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
  
  const startTime = Date.now();
  console.log(`🚀 [BACKGROUND] Iniciando processamento IMEDIATO de ${mediaType} para mensagem ${messageDbId}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Retry interno: 2 tentativas de download
  let downloadResult = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`📥 [BACKGROUND] Download attempt ${attempt}/2 for ${mediaType}`);
    downloadResult = await downloadMediaFromUazapi(messageId, UAZAPI_BASE_URL, instanceToken);
    
    if (downloadResult) {
      console.log(`✅ [BACKGROUND] Download succeeded on attempt ${attempt} (${Date.now() - startTime}ms)`);
      break;
    }
    
    if (attempt < 2) {
      console.log(`⚠️ [BACKGROUND] Attempt ${attempt} failed, retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  if (!downloadResult) {
    console.log(`❌ [BACKGROUND] Falha no download de ${mediaType} após 2 tentativas (${Date.now() - startTime}ms)`);
    await supabase
      .from('messages')
      .update({
        status: 'failed',
        error_message: 'Download failed from UAZAPI after 2 attempts',
        metadata: { ...mediaMetadata, error: 'Download failed', processedAt: new Date().toISOString() }
      })
      .eq('id', messageDbId);
    // Re-throw to trigger Redis fallback
    throw new Error('Download failed from UAZAPI after 2 attempts');
  }
  
  try {
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
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ [BACKGROUND] Upload complete: ${publicUrl} (${totalTime}ms total)`);
    
    // Update message with media URL
    const displayMimeType = mediaType === 'document' 
      ? getDisplayMimeType(contentData?.fileName, contentData?.mimetype || 'application/octet-stream')
      : actualMimeType;
    
    const { error: updateError } = await supabase
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
          processedAsync: true,
          processingTimeMs: totalTime
        }
      })
      .eq('id', messageDbId);
    
    if (updateError) {
      console.error(`⚠️ [BACKGROUND] Erro ao atualizar mensagem (mídia processada):`, updateError);
    } else {
      console.log(`🎉 [BACKGROUND] ${mediaType} processado com sucesso em ${totalTime}ms!`);
    }
    
  } catch (error) {
    console.error(`❌ [BACKGROUND] Erro ao processar ${mediaType}:`, error);
    // Re-throw to trigger Redis fallback in the caller
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTO IMEDIATO DE BATCH DE AI (quando debounce completou)
// ═══════════════════════════════════════════════════════════════════════════════
async function processAIBatchImmediate(batchData: any, batchKey: string, redisClient: Redis, lockAlreadyHeld: boolean = false) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { connectionId, conversationId, messages, contactName, contactPhone, companyId, instanceToken } = batchData;
  const lockKey = `lock:${batchKey}`;
  
  console.log(`🚀 [IMMEDIATE-BATCH] Attempting to process batch for conversation ${conversationId} (${messages.length} messages)`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔒 ACQUIRE LOCK TO PREVENT DUPLICATE PROCESSING (skip if already held)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (!lockAlreadyHeld) {
    try {
      // Try to acquire atomic lock (returns 1 if set, 0 if already exists)
      const lockAcquired = await redisClient.setnx(lockKey, Date.now().toString());
      
      if (!lockAcquired) {
        console.log(`🔒 [IMMEDIATE-BATCH] Lock already exists for ${batchKey}, skipping (another process is handling it)`);
        return;
      }
      
      // Set TTL on lock to prevent deadlocks (2 minutes max)
      await redisClient.expire(lockKey, 300); // 5 minutes for slow OpenAI + media processing
      console.log(`✅ [IMMEDIATE-BATCH] Lock acquired for ${batchKey}`);
    } catch (lockError) {
      console.error(`⚠️ [IMMEDIATE-BATCH] Error acquiring lock:`, lockError);
      // Continue anyway - better to risk duplicate than miss processing
    }
  } else {
    console.log(`✅ [IMMEDIATE-BATCH] Using pre-acquired lock for ${batchKey}`);
  }
  
  try {
    // Delete batch from Redis first to prevent duplicate processing
    await redisClient.del(batchKey);
    
    // Get agent config for this connection
    const { data: agentConnection } = await supabase
      .from('ai_agent_connections')
      .select(`
        ai_agents (
          id, status, message_batch_seconds, split_response_enabled, split_message_delay_seconds,
          voice_name, audio_enabled, audio_respond_with_audio, audio_always_respond_audio,
          speech_speed, audio_temperature, language_code
        )
      `)
      .eq('connection_id', connectionId)
      .maybeSingle();
    
    if (!agentConnection?.ai_agents) {
      console.log(`⚠️ [IMMEDIATE-BATCH] No agent found for connection ${connectionId}`);
      return;
    }
    
    const agentConfig = agentConnection.ai_agents as any;
    
    if (agentConfig.status !== 'active') {
      console.log(`⚠️ [IMMEDIATE-BATCH] Agent is not active (${agentConfig.status})`);
      return;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🛑 CHECK CONVERSATION-LEVEL DEACTIVATION BEFORE PROCESSING
    // ═══════════════════════════════════════════════════════════════════════════════
    const { data: conversationState } = await supabase
      .from('ai_conversation_states')
      .select('status, paused_until')
      .eq('conversation_id', conversationId)
      .single();
    
    if (conversationState) {
      const now = new Date();
      const pausedUntil = conversationState.paused_until ? new Date(conversationState.paused_until) : null;
      
      // Check if permanently deactivated
      if (conversationState.status === 'deactivated_permanently') {
        console.log(`🛑 [IMMEDIATE-BATCH] Conversation ${conversationId} is permanently deactivated - ABORTING`);
        return;
      }
      
      // Check if paused and still within pause period
      if (conversationState.status === 'paused' && pausedUntil && pausedUntil > now) {
        console.log(`⏸️ [IMMEDIATE-BATCH] Conversation ${conversationId} is paused until ${pausedUntil.toISOString()} - ABORTING`);
        return;
      }
    }
    
    // Call AI agent process function with batch of messages
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
        messages,
        contactName,
        contactPhone,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      if (result.skip) {
        console.log(`🤖 [IMMEDIATE-BATCH] Skipping: ${result.reason}`);
      } else {
        console.log(`❌ [IMMEDIATE-BATCH] Error: ${result.error}`);
      }
      return;
    }
    
    const aiResponse = result.response;
    const voiceName = result.voiceName;
    const shouldGenerateAudio = result.shouldGenerateAudio === true;
    const speechSpeed = result.speechSpeed || 1.0;
    const audioTemperature = result.audioTemperature || 0.7;
    const languageCode = result.languageCode || 'pt-BR';
    const splitResponseEnabled = agentConfig.split_response_enabled ?? true;
    const splitDelaySeconds = agentConfig.split_message_delay_seconds ?? 2.0;
    
    console.log(`✅ [IMMEDIATE-BATCH] Response generated`);
    console.log(`🔊 [IMMEDIATE-BATCH] Audio: shouldGenerate=${shouldGenerateAudio}, voiceName=${voiceName}`);
    
    // Get contact phone for sending
    const { data: conversation } = await supabase
      .from('conversations')
      .select(`contacts!inner (phone_number)`)
      .eq('id', conversationId)
      .single();
    
    const contactData = conversation?.contacts as any;
    if (!contactData?.phone_number) {
      console.log('❌ [IMMEDIATE-BATCH] Contact not found');
      return;
    }
    
    const phoneNumber = contactData.phone_number;
    
    // Split response if enabled and not audio
    const responseParts = splitResponseEnabled && !shouldGenerateAudio 
      ? splitResponse(aiResponse)
      : [aiResponse];
    
    console.log(`📤 [IMMEDIATE-BATCH] Sending ${responseParts.length} message(s) to ${phoneNumber}`);
    
    // Generate unique response ID for split tracking
    const responseId = `response:${conversationId}:${Date.now()}`;
    
    // Send each part with delay between them
    for (let i = 0; i < responseParts.length; i++) {
      const part = responseParts[i];
      const partKey = `${responseId}:part:${i}`;
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // 🛑 RE-CHECK DEACTIVATION BEFORE EACH MESSAGE SEND
      // ═══════════════════════════════════════════════════════════════════════════════
      const { data: currentState } = await supabase
        .from('ai_conversation_states')
        .select('status')
        .eq('conversation_id', conversationId)
        .single();
      
      if (currentState?.status === 'deactivated_permanently') {
        console.log(`🛑 [IMMEDIATE-BATCH] Conversation was deactivated during processing - ABORTING remaining sends`);
        break;
      }
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // 🔒 SPLIT TRACKING - Prevent duplicate sending of same part
      // ═══════════════════════════════════════════════════════════════════════════════
      try {
        const partAlreadySent = await redisClient.get(partKey);
        if (partAlreadySent) {
          console.log(`🔒 [SPLIT-TRACK] Part ${i + 1}/${responseParts.length} already sent, skipping`);
          continue;
        }
      } catch (trackError) {
        console.log('⚠️ [SPLIT-TRACK] Redis error checking part:', trackError);
        // Continue anyway - better to risk duplicate than miss sending
      }
      
      // Add delay between messages (not before the first one)
      if (i > 0 && splitDelaySeconds > 0) {
        await new Promise(resolve => setTimeout(resolve, splitDelaySeconds * 1000));
      }
      
      let whatsappMessageId: string | null = null;
      let messageType: 'text' | 'audio' = 'text';
      let mediaUrl: string | null = null;
      
      // Generate audio only for first message if enabled
      if (shouldGenerateAudio && voiceName && i === 0) {
        console.log(`🎵 [IMMEDIATE-BATCH] Generating audio with voice: ${voiceName}`);
        
        const ttsUrl = `${supabaseUrl}/functions/v1/ai-agent-tts`;
        
        const ttsResponse = await fetch(ttsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            text: aiResponse,
            voiceName,
            speed: speechSpeed,
            temperature: audioTemperature,
            languageCode,
          }),
        });
        
        if (ttsResponse.ok) {
          const ttsResult = await ttsResponse.json();
          const audioUrl = ttsResult.audioUrl;
          
          if (audioUrl) {
            const sendMediaUrl = `${UAZAPI_BASE_URL}/send/media`;
            
            const sendResponse = await fetch(sendMediaUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'token': instanceToken,
              },
              body: JSON.stringify({
                number: phoneNumber,
                type: 'ptt',
                file: audioUrl,
                text: '',
              }),
            });
            
            if (sendResponse.ok) {
              const sendResult = await sendResponse.json();
              whatsappMessageId = sendResult.key?.id || sendResult.messageId || null;
              messageType = 'audio';
              mediaUrl = audioUrl;
              console.log(`✅ [IMMEDIATE-BATCH] Audio sent: ${whatsappMessageId}`);
            }
          }
        }
      }
      
      // Send text if not audio or audio failed
      if (messageType === 'text') {
        const sendTextUrl = `${UAZAPI_BASE_URL}/send/text`;
        
        const sendResponse = await fetch(sendTextUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: part,
          }),
        });
        
        if (sendResponse.ok) {
          const sendResult = await sendResponse.json();
          whatsappMessageId = sendResult.key?.id || sendResult.messageId || null;
          console.log(`✅ [IMMEDIATE-BATCH] Text sent (part ${i + 1}/${responseParts.length}): ${whatsappMessageId}`);
        }
      }
      
      // Save to database ALWAYS (even without whatsappMessageId)
      const messageInsertResult = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          direction: 'outbound',
          sender_type: 'bot',
          sender_id: null,
          content: messageType === 'audio' ? aiResponse : part,
          message_type: messageType,
          media_url: mediaUrl,
          whatsapp_message_id: whatsappMessageId || `pending-${Date.now()}-${i}`,
          status: whatsappMessageId ? 'sent' : 'pending',
          metadata: {
            aiGenerated: true,
            batchProcessed: true,
            partIndex: i + 1,
            totalParts: responseParts.length,
            immediateProcessing: true,
            pendingWhatsAppId: !whatsappMessageId,
          },
        });
      
      if (messageInsertResult.error) {
        console.error(`❌ [IMMEDIATE-BATCH] Error saving message to DB:`, messageInsertResult.error);
      } else {
        console.log(`💾 [IMMEDIATE-BATCH] Message saved to DB (whatsappId: ${whatsappMessageId || 'pending'})`);
      }
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // ✅ MARK PART AS SENT in Redis to prevent duplicate sends
      // ═══════════════════════════════════════════════════════════════════════════════
      if (whatsappMessageId) {
        try {
          await redisClient.setex(partKey, 300, 'sent'); // TTL 5 minutes
          console.log(`✅ [SPLIT-TRACK] Part ${i + 1}/${responseParts.length} marked as sent`);
        } catch (trackError) {
          console.log('⚠️ [SPLIT-TRACK] Redis error marking part as sent:', trackError);
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 📦 PROCESSAR MÍDIAS (mediasToSend)
    // ═══════════════════════════════════════════════════════════════════════════════
    const mediasToSend = result.mediasToSend as Array<{ type: string; key: string; url?: string; content?: string; fileName?: string }> | undefined;
    
    if (mediasToSend && mediasToSend.length > 0) {
      console.log(`📦 [IMMEDIATE-BATCH] Sending ${mediasToSend.length} media(s)...`);
      
      for (const media of mediasToSend) {
        // Add delay between media messages
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        let whatsappMediaId: string | null = null;
        
        try {
          if (media.type === 'text' && media.content) {
            // Send as text message
            const sendTextUrl = `${UAZAPI_BASE_URL}/send/text`;
            const textResponse = await fetch(sendTextUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instanceToken },
              body: JSON.stringify({ number: phoneNumber, text: media.content }),
            });
            
            if (textResponse.ok) {
              const textResult = await textResponse.json();
              whatsappMediaId = textResult.key?.id || textResult.messageId || null;
              console.log(`✅ [IMMEDIATE-BATCH] Text media sent: ${whatsappMediaId}`);
            }
            
            // Save to database
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              direction: 'outbound',
              sender_type: 'bot',
              content: media.content,
              message_type: 'text',
              whatsapp_message_id: whatsappMediaId,
              status: 'sent',
              metadata: { aiGenerated: true, mediaKey: media.key }
            });
            
          } else if (media.type === 'link' && media.content) {
            // Send link as text message
            const sendTextUrl = `${UAZAPI_BASE_URL}/send/text`;
            const linkResponse = await fetch(sendTextUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instanceToken },
              body: JSON.stringify({ number: phoneNumber, text: media.content }),
            });
            
            if (linkResponse.ok) {
              const linkResult = await linkResponse.json();
              whatsappMediaId = linkResult.key?.id || linkResult.messageId || null;
              console.log(`✅ [IMMEDIATE-BATCH] Link sent: ${whatsappMediaId}`);
            }
            
            // Save to database
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              direction: 'outbound',
              sender_type: 'bot',
              content: media.content,
              message_type: 'text',
              whatsapp_message_id: whatsappMediaId,
              status: 'sent',
              metadata: { aiGenerated: true, mediaKey: media.key, isLink: true }
            });
            
          } else if (media.url) {
            // Send media file (video, image, audio, document)
            const sendMediaUrl = `${UAZAPI_BASE_URL}/send/media`;
            
            // Map media type to UAZAPI type
            let uazapiType = media.type;
            if (media.type === 'audio') uazapiType = 'ptt'; // Voice note (push-to-talk)
            
            // Generate signed URL if it's from private bucket and not already signed
            let mediaFileUrl = media.url;
            let permanentUrl = media.url; // URL permanente para salvar no banco
            
            if (mediaFileUrl && mediaFileUrl.includes('/ai-agent-media/') && !mediaFileUrl.includes('token=')) {
              try {
                const urlParts = mediaFileUrl.split('/ai-agent-media/');
                if (urlParts.length > 1) {
                  const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
                  console.log(`🔑 [WEBHOOK] Gerando signed URL temporária para copiar: ${storagePath}`);
                  
                  // Generate temporary signed URL for download (5 min is enough)
                  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from('ai-agent-media')
                    .createSignedUrl(storagePath, 300);
                  
                  if (signedUrlData?.signedUrl) {
                    // Use signed URL to send to WhatsApp (immediate)
                    mediaFileUrl = signedUrlData.signedUrl;
                    
                    // Copy to public bucket for permanent URL in database
                    const agentId = result.agentId || agentConfig.id || 'unknown';
                    const publicUrl = await copyMediaToPublicBucket(
                      supabase,
                      signedUrlData.signedUrl,
                      agentId,
                      media.key
                    );
                    
                    if (publicUrl) {
                      permanentUrl = publicUrl;
                      console.log(`✅ [WEBHOOK] URL permanente gerada: ${publicUrl.substring(0, 60)}...`);
                    } else {
                      // Fallback: use signed URL with longer TTL
                      const { data: fallbackUrl } = await supabase.storage
                        .from('ai-agent-media')
                        .createSignedUrl(storagePath, 86400); // 24h fallback
                      if (fallbackUrl?.signedUrl) {
                        permanentUrl = fallbackUrl.signedUrl;
                        console.log(`⚠️ [WEBHOOK] Usando signed URL de 24h como fallback`);
                      }
                    }
                  } else if (signedUrlError) {
                    console.log(`⚠️ [WEBHOOK] Erro ao gerar signed URL: ${signedUrlError.message}`);
                  }
                }
              } catch (signedUrlErr) {
                console.log(`⚠️ [WEBHOOK] Erro ao processar mídia:`, signedUrlErr);
              }
            }
            
            // Build payload with caption/text support
            const mediaPayload = {
              number: phoneNumber,
              type: uazapiType,
              file: mediaFileUrl,
              filename: media.fileName || undefined,
              text: media.content || undefined, // Caption/legenda para a mídia
            };
            
            console.log(`📤 [IMMEDIATE-BATCH] Sending media to UAZAPI:`, JSON.stringify({
              type: uazapiType,
              file: mediaFileUrl ? mediaFileUrl.substring(0, 80) + '...' : 'N/A',
              filename: media.fileName,
              hasCaption: !!media.content
            }));
            
            const mediaResponse = await fetch(sendMediaUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': instanceToken },
              body: JSON.stringify(mediaPayload),
            });
            
            if (mediaResponse.ok) {
              const mediaResult = await mediaResponse.json();
              whatsappMediaId = mediaResult.key?.id || mediaResult.messageId || null;
              console.log(`✅ [IMMEDIATE-BATCH] Media (${media.type}→${uazapiType}) sent: ${whatsappMediaId}`);
            } else {
              const errorText = await mediaResponse.text();
              console.log(`❌ [IMMEDIATE-BATCH] Failed to send media (${uazapiType}):`, errorText);
            }
            
            // Save to database with PERMANENT URL
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              direction: 'outbound',
              sender_type: 'bot',
              content: media.fileName || '',
              message_type: media.type as any,
              media_url: permanentUrl, // ← URL permanente!
              whatsapp_message_id: whatsappMediaId,
              status: whatsappMediaId ? 'sent' : 'failed',
              metadata: { 
                aiGenerated: true, 
                mediaKey: media.key,
                fileName: media.fileName
              }
            });
          }
        } catch (mediaError) {
          console.error(`❌ [IMMEDIATE-BATCH] Error sending media ${media.key}:`, mediaError);
        }
      }
    }
    
    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    
    console.log(`🎉 [IMMEDIATE-BATCH] Batch processed successfully!`);
    
  } catch (error) {
    console.error(`❌ [IMMEDIATE-BATCH] Error:`, error);
    // Re-enqueue on failure
    try {
      await redisClient.setex(batchKey, 300, JSON.stringify(batchData));
    } catch (e) {
      console.error(`❌ [IMMEDIATE-BATCH] Failed to re-enqueue batch`);
    }
  } finally {
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔓 RELEASE LOCK
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      await redisClient.del(lockKey);
      console.log(`🔓 [IMMEDIATE-BATCH] Lock released for ${batchKey}`);
    } catch (unlockError) {
      console.error(`⚠️ [IMMEDIATE-BATCH] Error releasing lock:`, unlockError);
    }
  }
}

// Helper to split response into humanized messages
function splitResponse(text: string): string[] {
  // Validação para evitar crash se text for undefined/null
  if (!text || typeof text !== 'string') {
    console.warn('[splitResponse] Received invalid input:', typeof text, text);
    return [];
  }
  
  const parts: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentPart = '';
  
  for (const sentence of sentences) {
    if (sentence.includes('?') && currentPart.length > 0) {
      parts.push(currentPart.trim());
      currentPart = sentence;
    } else if ((currentPart + ' ' + sentence).length > 300 && currentPart.length > 0) {
      parts.push(currentPart.trim());
      currentPart = sentence;
    } else {
      currentPart = currentPart ? currentPart + ' ' + sentence : sentence;
    }
  }
  
  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }
  
  return parts.length > 0 ? parts : [text];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTO ASSÍNCRONO DE AGENTE DE IA (Background Task - Legacy)
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
    const voiceName = result.voiceName;
    const speechSpeed = result.speechSpeed || 1.0;
    const audioTemperature = result.audioTemperature || 0.7;
    const languageCode = result.languageCode || 'pt-BR';
    
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

Deno.serve(async (req: Request) => {
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
    
    // ═══════════════════════════════════════════════════════════════════
    // 🚫 IMMEDIATELY BLOCK ALL GROUP MESSAGES
    // Groups are no longer supported - reject before any processing
    // ═══════════════════════════════════════════════════════════════════
    const isGroupMessage = payload.message?.isGroup === true
    if (isGroupMessage) {
      console.log(`🚫 [BLOCKED] Mensagem de grupo rejeitada - grupos não suportados`)
      return new Response(
        JSON.stringify({ success: true, message: 'Group messages not supported' }),
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
    
    // NOTE: Group messages are blocked at the top of this function
    // The receive_group_messages check has been removed as groups are no longer supported
    
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
      
      // Auto-add to CRM if enabled (use default board)
      const { data: boardData } = await supabase
        .from('kanban_boards')
        .select('id, auto_add_new_contacts')
        .eq('whatsapp_connection_id', whatsappConnectionId)
        .eq('is_default', true)
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
    // 6️⃣ PROCESS CONVERSATION - WITH CONNECTION MIGRATION (PREVENT DUPLICATES)
    // ═══════════════════════════════════════════════════════════════════
    const isFromMe = payload.message?.fromMe === true
    const messageTimestamp = convertTimestamp(payload.message?.messageTimestamp)
    
    // FIRST: Try to find ANY open conversation for this contact (regardless of connection)
    // This prevents duplicates when contact messages different connections
    const { data: anyOpenConversation } = await supabase
      .from('conversations')
      .select('id, unread_count, status, whatsapp_connection_id, assigned_user_id, department_id, tags, priority')
      .eq('contact_id', contactId)
      .eq('company_id', companyId)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    let conversationId: string
    
    if (anyOpenConversation) {
      // Found an open conversation - check if it's on a different connection
      const needsMigration = anyOpenConversation.whatsapp_connection_id !== whatsappConnectionId
      
      if (needsMigration) {
        // MIGRATE to new connection
        const previousConnectionId = anyOpenConversation.whatsapp_connection_id
        console.log(`🔄 [PREVENT-DUP] Migrando conversa ${anyOpenConversation.id} de conexão ${previousConnectionId} para ${whatsappConnectionId}`)
        
        // Get previous connection name for history
        const { data: prevConnection } = await supabase
          .from('whatsapp_connections')
          .select('name')
          .eq('id', previousConnectionId)
          .maybeSingle()
        
        const newUnreadCount = isFromMe ? anyOpenConversation.unread_count : (anyOpenConversation.unread_count || 0) + 1
        
        // Update conversation to new connection
        await supabase
          .from('conversations')
          .update({
            whatsapp_connection_id: whatsappConnectionId,
            department_id: defaultDepartmentId,
            last_message_at: messageTimestamp,
            unread_count: newUnreadCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', anyOpenConversation.id)
        
        // Log connection change in history
        await supabase
          .from('conversation_history')
          .insert({
            conversation_id: anyOpenConversation.id,
            event_type: 'connection_changed',
            event_data: {
              previous_connection_id: previousConnectionId,
              previous_connection_name: prevConnection?.name || 'Número anterior',
              new_connection_id: whatsappConnectionId,
              new_connection_name: connection.name || 'Novo número',
              reason: 'client_initiated',
              message: 'Cliente enviou mensagem por outro número'
            },
            performed_by: null,
            performed_by_name: 'Sistema',
            is_automatic: true
          })
        
        console.log(`✅ [PREVENT-DUP] Conversa migrada com sucesso`)
      } else {
        // Same connection - just update
        const newUnreadCount = isFromMe ? anyOpenConversation.unread_count : (anyOpenConversation.unread_count || 0) + 1
        
        await supabase
          .from('conversations')
          .update({
            last_message_at: messageTimestamp,
            unread_count: newUnreadCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', anyOpenConversation.id)
      }
      
      conversationId = anyOpenConversation.id
    } else {
      // No open conversation - check for a CLOSED conversation to reopen
      const { data: closedConversation } = await supabase
        .from('conversations')
        .select('id, status, metadata, whatsapp_connection_id')
        .eq('contact_id', contactId)
        .eq('company_id', companyId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (closedConversation) {
        // Check if contact is blocked - if so, don't reopen
        const { data: contactData } = await supabase
          .from('contacts')
          .select('is_blocked')
          .eq('id', contactId)
          .single()
        
        if (contactData?.is_blocked) {
          console.log(`🚫 [BLOCKED] Contato bloqueado - não reabrindo conversa ${closedConversation.id}`)
          // Still save the message but don't reopen
          conversationId = closedConversation.id
        } else {
          // REOPEN the closed conversation
          const wasOnDifferentConnection = closedConversation.whatsapp_connection_id !== whatsappConnectionId
          console.log(`🔄 Reabrindo conversa fechada: ${closedConversation.id}${wasOnDifferentConnection ? ' (e migrando conexão)' : ''}`)
          
          const existingMetadata = (closedConversation.metadata as Record<string, unknown>) || {}
          
          // Get previous connection name if migrating
          let prevConnectionName = null
          if (wasOnDifferentConnection) {
            const { data: prevConn } = await supabase
              .from('whatsapp_connections')
              .select('name')
              .eq('id', closedConversation.whatsapp_connection_id)
              .maybeSingle()
            prevConnectionName = prevConn?.name
          }
          
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
              whatsapp_connection_id: whatsappConnectionId,
              department_id: defaultDepartmentId,
              metadata: {
                ...existingMetadata,
                autoReopened: true,
                reopenedAt: new Date().toISOString(),
                reopenedByClient: true
              }
            })
            .eq('id', closedConversation.id)
          
          // Log reopening
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
          
          // Log connection change if it happened
          if (wasOnDifferentConnection) {
            await supabase
              .from('conversation_history')
              .insert({
                conversation_id: closedConversation.id,
                event_type: 'connection_changed',
                event_data: {
                  previous_connection_id: closedConversation.whatsapp_connection_id,
                  previous_connection_name: prevConnectionName || 'Número anterior',
                  new_connection_id: whatsappConnectionId,
                  new_connection_name: connection.name || 'Novo número',
                  reason: 'client_initiated',
                  message: 'Cliente reenviou mensagem por outro número'
                },
                performed_by: null,
                performed_by_name: 'Sistema',
                is_automatic: true
              })
          }
          
          conversationId = closedConversation.id
        }
      } else {
        // Check if contact is blocked before creating new conversation
        const { data: contactData } = await supabase
          .from('contacts')
          .select('is_blocked')
          .eq('id', contactId)
          .single()
        
        if (contactData?.is_blocked) {
          console.log(`🚫 [BLOCKED] Contato bloqueado - não criando nova conversa`)
          // Return success but don't create conversation
          return new Response(
            JSON.stringify({ success: true, message: 'Contact is blocked - message ignored' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // No conversation exists at all - create new one
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
            channel: 'whatsapp',
            is_group: isGroupMessage
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
      
      // SEMPRE processar imediatamente via EdgeRuntime.waitUntil para melhor UX
      // Redis é usado apenas como fallback para retry em caso de falha
      console.log(`🚀 [IMMEDIATE] Processing ${detectedMediaType} immediately via waitUntil`)
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
        }).catch(async (error) => {
          console.error(`❌ [IMMEDIATE] Background processing failed for ${detectedMediaType}:`, error)
          // Fallback: enqueue to Redis for retry if available
          if (redis) {
            try {
              console.log(`📤 [FALLBACK] Enqueueing ${detectedMediaType} to Redis for retry`)
              await redis.rpush('queue:media', JSON.stringify({
                data: mediaQueueData,
                attempts: 1, // Already attempted once
                enqueuedAt: new Date().toISOString(),
                error: error?.message || 'Unknown error'
              }))
              console.log(`✅ [FALLBACK] Media enqueued for retry`)
            } catch (queueError) {
              console.error(`❌ [FALLBACK] Redis enqueue also failed:`, queueError)
            }
          }
        })
      )
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 📊 COMMERCIAL PIXEL - Analyze message in real-time (fire-and-forget)
    // ═══════════════════════════════════════════════════════════════════
    // BLOQUEADO PARA GRUPOS - grupos geram muitas mensagens, custo elevado
    if (isGroupMessage) {
      console.log('⏭️ [PIXEL] Skipped - group message (cost control)');
    } else {
      // Smart filter to reduce unnecessary API calls (~40-50% reduction)
      const shouldCallCommercialPixel = (
        content: string | null,
        msgType: string,
        dir: string
      ): boolean => {
        // Always analyze media with commercial potential
        if (['image', 'video', 'document', 'audio'].includes(msgType)) return true;
        
        // Skip messages without content
        if (!content || content.trim().length === 0) return false;
        
        // Skip very short messages (< 10 chars) - typically "ok", "sim", etc
        if (content.trim().length < 10) return false;
        
        // Skip emoji-only messages
        if (/^[\p{Emoji}\s]+$/u.test(content.trim())) return false;
        
        // Skip trivial monosyllabic responses
        const trivialResponses = [
          'ok', 'sim', 'não', 'nao', 'ta', 'tá', 'blz', 'vlw', 
          'oi', 'olá', 'ola', 'obg', 'obrigado', 'obrigada',
          'bom', 'boa', 'certo', 'beleza', 'pode', 'legal',
          'hmm', 'hum', 'kkk', 'kkkk', 'rs', 'rsrs', 'haha',
          'top', 'show', 'massa', 'nice', 'valeu', 'tmj'
        ];
        if (trivialResponses.includes(content.toLowerCase().trim())) return false;
        
        return true;
      };
      
      const shouldTriggerPixel = shouldCallCommercialPixel(messageContent, dbMessageType, direction);
      
      if (shouldTriggerPixel) {
        try {
          EdgeRuntime.waitUntil(
            fetch(`${supabaseUrl}/functions/v1/commercial-pixel`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                conversation_id: conversationId,
                company_id: companyId,
                message_content: messageContent || '',
                message_type: dbMessageType,
                direction: direction,
                contact_name: contactName
              }),
            }).catch(e => console.log('⚠️ [PIXEL] Error calling commercial-pixel:', e))
          );
          console.log('📊 [PIXEL] Commercial pixel triggered for message');
        } catch (pixelError) {
          console.log('⚠️ [PIXEL] Failed to trigger commercial pixel:', pixelError);
        }
      } else {
        console.log('⏭️ [PIXEL] Skipped - trivial message:', (messageContent || '').substring(0, 30));
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🤖 PROCESS AI AGENT (BATCH SYSTEM)
    // ═══════════════════════════════════════════════════════════════════
    // BLOQUEADO PARA GRUPOS - grupos geram muitas mensagens, custo elevado de IA
    // Process AI agent for text, audio and image messages (not stickers, documents, videos)
    const aiSupportedTypes = ['text', 'audio', 'image', 'video', 'document'];
    if (isGroupMessage) {
      console.log('⏭️ [AI-AGENT] Skipped - group message (cost control)');
    } else if (!isFromMe && aiSupportedTypes.includes(dbMessageType)) {
      const messageData = {
        content: messageContent || '',
        type: dbMessageType,
        mediaUrl: undefined as string | undefined,
        timestamp: new Date().toISOString()
      }
      
      // Use Redis batching if available
      if (redis) {
        const batchKey = `ai-batch:${conversationId}`
        console.log(`📤 [BATCH] Checking batch for conversation ${conversationId}`)
        
        try {
          const existingBatchRaw = await redis.get(batchKey)
          
          if (existingBatchRaw) {
            // Add message to existing batch
            const existingBatch = typeof existingBatchRaw === 'string' 
              ? JSON.parse(existingBatchRaw) 
              : existingBatchRaw
            
            existingBatch.messages.push(messageData)
            existingBatch.lastUpdated = new Date().toISOString()
            
            await redis.setex(batchKey, 300, JSON.stringify(existingBatch)) // TTL 5 min
            console.log(`✅ [BATCH] Message added to existing batch (${existingBatch.messages.length} msgs)`)
          } else {
            // Create new batch
            const newBatch = {
              connectionId: whatsappConnectionId,
              conversationId,
              contactName,
              contactPhone: phoneNumber,
              companyId,
              instanceToken,
              messages: [messageData],
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            }
            
            await redis.setex(batchKey, 300, JSON.stringify(newBatch))
            console.log(`✅ [BATCH] New batch created for conversation`)
          }
          
          // ═══════════════════════════════════════════════════════════════
          // ⏰ SCHEDULE SELF-BATCH PROCESSING TIMER
          // ═══════════════════════════════════════════════════════════════
          // Get agent config to know the debounce time for THIS batch
          const { data: selfAgentConn } = await supabase
            .from('ai_agent_connections')
            .select('ai_agents(message_batch_seconds, status)')
            .eq('connection_id', whatsappConnectionId)
            .maybeSingle()
          
          if (selfAgentConn?.ai_agents) {
            const selfAgentConfig = selfAgentConn.ai_agents as any
            if (selfAgentConfig.status === 'active') {
              const selfBatchSeconds = selfAgentConfig.message_batch_seconds ?? 75
              const timerDelay = (selfBatchSeconds + 5) * 1000 // +5s safety margin
              
              console.log(`⏰ [TIMER] Scheduling self-batch processing in ${selfBatchSeconds + 5}s for ${batchKey}`)
              
              // Schedule timer to process THIS batch after debounce expires
              EdgeRuntime.waitUntil(
                (async () => {
                  // Wait for debounce + safety margin
                  await new Promise(resolve => setTimeout(resolve, timerDelay))
                  
                  console.log(`⏰ [TIMER] Timer fired for ${batchKey}, attempting to process...`)
                  
                  // Try to acquire lock atomically
                  const lockKey = `lock:${batchKey}`
                  try {
                    const lockAcquired = await redis.setnx(lockKey, Date.now().toString())
                    
                    if (!lockAcquired) {
                      console.log(`🔒 [TIMER] Lock exists for ${batchKey}, batch already being processed`)
                      return
                    }
                    
                    // Set TTL on lock
                    await redis.expire(lockKey, 300) // 5 minutes for slow OpenAI + media processing
                    
                    // Check if batch still exists (might have been processed by other means)
                    const currentBatchRaw = await redis.get(batchKey)
                    if (!currentBatchRaw) {
                      console.log(`✅ [TIMER] Batch ${batchKey} no longer exists, already processed`)
                      await redis.del(lockKey)
                      return
                    }
                    
                    const currentBatch = typeof currentBatchRaw === 'string'
                      ? JSON.parse(currentBatchRaw)
                      : currentBatchRaw
                    
                    console.log(`🚀 [TIMER] Processing self-batch ${batchKey} (${currentBatch.messages?.length || 0} messages)`)
                    
                    // Process using existing function (pass lockAlreadyHeld=true)
                    // Function will handle batch deletion and lock cleanup in finally block
                    await processAIBatchImmediate(currentBatch, batchKey, redis, true)
                    
                  } catch (timerError) {
                    console.error(`⚠️ [TIMER] Error processing self-batch:`, timerError)
                    // Clean up lock on error (only if we acquired it)
                    try {
                      await redis.del(lockKey)
                    } catch (e) {}
                  }
                })()
              )
            }
          }

          // ═══════════════════════════════════════════════════════════════
          // 🚀 CHECK FOR MATURE BATCHES AND PROCESS IMMEDIATELY
          // ═══════════════════════════════════════════════════════════════
          // Scan for OTHER batches that have completed their debounce time
          // This eliminates the pg_cron wait time (up to 60s)
          const allBatchKeys = await redis.keys('ai-batch:*')
          console.log(`🔍 [BATCH] Found ${allBatchKeys.length} batches to check for maturity`)
          
          for (const otherBatchKey of allBatchKeys) {
            // Skip the current batch (just updated, not ready yet)
            if (otherBatchKey === batchKey) continue
            
            try {
              const otherBatchRaw = await redis.get(otherBatchKey)
              if (!otherBatchRaw) continue
              
              const otherBatch = typeof otherBatchRaw === 'string'
                ? JSON.parse(otherBatchRaw)
                : otherBatchRaw
              
              // Get agent config to know the debounce time
              const { data: agentConn } = await supabase
                .from('ai_agent_connections')
                .select('ai_agents(message_batch_seconds, status)')
                .eq('connection_id', otherBatch.connectionId)
                .maybeSingle()
              
              if (!agentConn?.ai_agents) continue
              
              const agentConfig = agentConn.ai_agents as any
              if (agentConfig.status !== 'active') continue
              
              const batchSeconds = agentConfig.message_batch_seconds ?? 75
              const lastUpdated = new Date(otherBatch.lastUpdated).getTime()
              const elapsed = (Date.now() - lastUpdated) / 1000
              
              if (elapsed >= batchSeconds) {
                console.log(`🚀 [BATCH] Batch ${otherBatchKey} is mature (${elapsed.toFixed(1)}s >= ${batchSeconds}s), processing immediately!`)
                
                // Process this mature batch in background
                EdgeRuntime.waitUntil(
                  processAIBatchImmediate(otherBatch, otherBatchKey, redis)
                )
              } else {
                console.log(`⏳ [BATCH] Batch ${otherBatchKey} not ready yet (${elapsed.toFixed(1)}s < ${batchSeconds}s)`)
              }
            } catch (batchCheckError) {
              console.log(`⚠️ [BATCH] Error checking batch ${otherBatchKey}:`, batchCheckError)
            }
          }
          
        } catch (batchError) {
          console.log(`⚠️ [BATCH] Redis error, falling back to direct queue:`, batchError)
          // Fallback to direct queue
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
          await redis.rpush('queue:ai-agent', JSON.stringify({
            data: aiQueueData,
            attempts: 0,
            enqueuedAt: new Date().toISOString()
          }))
        }
      } else {
        console.log(`🤖 Checking AI agent for this connection... (type: ${dbMessageType}, no Redis)`)
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
