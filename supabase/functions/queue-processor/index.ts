import { createClient } from "npm:@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Redis client
const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!,
})

// Get base URL from secrets
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL')?.trim() || ''

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function extractPhoneNumber(jid: string): string {
  if (!jid) return ''
  return jid.split('@')[0]
}

function convertTimestamp(timestamp: number): string {
  if (!timestamp) return new Date().toISOString()
  return new Date(timestamp).toISOString()
}

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
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
  }
  
  if (extension && extensionMimeMap[extension]) {
    return extensionMimeMap[extension]
  }
  
  if (originalMimeType && originalMimeType.trim()) {
    return originalMimeType.split(';')[0].trim()
  }
  
  return 'application/octet-stream'
}

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
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/markdown': 'md',
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
    console.log(`📋 [QUEUE] Copiando mídia para bucket público: ${mediaKey}`);
    
    // If URL is already from whatsapp-media (public), return as is
    if (privateUrl.includes('/whatsapp-media/') && !privateUrl.includes('token=')) {
      console.log(`✅ [QUEUE] Mídia já está no bucket público`);
      return privateUrl;
    }
    
    // Download from private bucket using signed URL
    const response = await fetch(privateUrl);
    if (!response.ok) {
      console.error(`❌ [QUEUE] Erro ao baixar mídia: ${response.status}`);
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
      console.error(`❌ [QUEUE] Erro ao fazer upload para bucket público:`, error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uniquePath);
    
    console.log(`✅ [QUEUE] Mídia copiada para bucket público: ${publicUrl}`);
    return publicUrl;
  } catch (e) {
    console.error(`❌ [QUEUE] Erro ao copiar mídia:`, e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DOWNLOAD MEDIA FROM UAZAPI
// ═══════════════════════════════════════════════════════════════════
async function downloadMediaFromUazapi(
  messageId: string, 
  instanceToken: string
): Promise<{ buffer: Uint8Array; mimeType: string; fileSize: number } | null> {
  const downloadUrl = `${UAZAPI_BASE_URL}/message/download`
  
  console.log(`🔽 [QUEUE] Downloading media: ${messageId}`)
  
  if (!instanceToken) {
    console.log(`❌ [QUEUE] Empty token!`)
    return null
  }
  
  for (let attempt = 1; attempt <= 3; attempt++) {
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
        console.log(`❌ [QUEUE] Download failed (attempt ${attempt}): ${response.status}`)
        if (attempt === 3) return null
        await new Promise(r => setTimeout(r, 2000 * attempt))
        continue
      }
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.log(`❌ [QUEUE] Failed to parse response (attempt ${attempt})`)
        if (attempt === 3) return null
        await new Promise(r => setTimeout(r, 2000 * attempt))
        continue
      }
      
      let base64 = data.base64Data || data.base64 || data.data?.base64 || data.media?.base64
      const mimeType = data.mimetype || data.data?.mimetype || data.media?.mimetype || 'audio/ogg'
      const fileSize = data.fileSize || data.data?.fileSize || data.media?.fileSize || 0
      
      if (!base64) {
        console.log(`❌ [QUEUE] base64Data not found (attempt ${attempt})`)
        if (attempt === 3) return null
        await new Promise(r => setTimeout(r, 2000 * attempt))
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
      
      console.log(`✅ [QUEUE] Downloaded ${buffer.byteLength} bytes`)
      return { buffer, mimeType: mimeType.split(';')[0].trim(), fileSize: fileSize || buffer.byteLength }
      
    } catch (error) {
      console.error(`❌ [QUEUE] Attempt ${attempt} error:`, error)
      if (attempt === 3) return null
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  
  return null
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS MEDIA MESSAGE
// ═══════════════════════════════════════════════════════════════════
async function processMediaMessage(
  supabase: any,
  queueItem: any
): Promise<boolean> {
  const { messageDbId, whatsappMessageId, mediaType, companyId, whatsappConnectionId, instanceToken, mediaMetadata, contentData } = queueItem
  
  console.log(`🔄 [QUEUE] Processing ${mediaType} for message ${messageDbId}`)
  
  try {
    // Download media
    const downloadResult = await downloadMediaFromUazapi(whatsappMessageId, instanceToken)
    
    if (!downloadResult) {
      console.log(`❌ [QUEUE] Download failed for ${mediaType}`)
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          error_message: 'Download failed from UAZAPI after 3 attempts',
          metadata: { ...mediaMetadata, error: 'Download failed', processedAt: new Date().toISOString() }
        })
        .eq('id', messageDbId)
      return false
    }
    
    const { buffer, mimeType: downloadedMimeType, fileSize: downloadedSize } = downloadResult
    
    // Determine extension and storage path
    let extension: string
    let actualMimeType: string
    
    if (mediaType === 'sticker') {
      extension = 'webp'
      actualMimeType = 'image/webp'
    } else if (mediaType === 'document') {
      const fileName = contentData?.fileName || ''
      const originalMimeType = contentData?.mimetype || 'application/octet-stream'
      extension = getExtensionFromMimeType(originalMimeType, fileName)
      actualMimeType = getStorageSafeMimeType(getDisplayMimeType(fileName, originalMimeType))
    } else {
      actualMimeType = downloadedMimeType
      extension = getExtensionFromMimeType(actualMimeType)
    }
    
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const randomId = Math.random().toString(36).substring(2, 8)
    const fileName = `${mediaType}_${Date.now()}_${randomId}.${extension}`
    const storagePath = `${companyId}/${whatsappConnectionId}/${year}-${month}/${fileName}`
    
    console.log(`📤 [QUEUE] Uploading to: ${storagePath}`)
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, buffer, {
        contentType: actualMimeType,
        cacheControl: '31536000',
        upsert: false
      })
    
    if (uploadError) {
      console.log(`❌ [QUEUE] Upload error: ${uploadError.message}`)
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          error_message: `Upload failed: ${uploadError.message}`,
          metadata: { ...mediaMetadata, error: 'Upload failed', processedAt: new Date().toISOString() }
        })
        .eq('id', messageDbId)
      return false
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uploadData.path)
    
    console.log(`✅ [QUEUE] Upload complete: ${publicUrl}`)
    
    // Update message with media URL
    const displayMimeType = mediaType === 'document' 
      ? getDisplayMimeType(contentData?.fileName, contentData?.mimetype || 'application/octet-stream')
      : actualMimeType
    
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
          processedAt: new Date().toISOString(),
          processedByQueue: true
        }
      })
      .eq('id', messageDbId)
    
    console.log(`🎉 [QUEUE] ${mediaType} processed successfully!`)
    return true
    
  } catch (error) {
    console.error(`❌ [QUEUE] Error processing ${mediaType}:`, error)
    await supabase
      .from('messages')
      .update({
        status: 'failed',
        error_message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { ...mediaMetadata, error: 'Processing failed', processedAt: new Date().toISOString() }
      })
      .eq('id', messageDbId)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════
// SPLIT RESPONSE INTO HUMANIZED MESSAGES
// ═══════════════════════════════════════════════════════════════════
function splitResponse(text: string): string[] {
  // Validação para evitar crash se text for undefined/null
  if (!text || typeof text !== 'string') {
    console.warn('[splitResponse] Received invalid input:', typeof text, text);
    return [];
  }
  
  const parts: string[] = []
  
  // Split by sentences first
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentPart = ''
  
  for (const sentence of sentences) {
    // If this sentence contains a question mark, make it a separate message
    if (sentence.includes('?') && currentPart.length > 0) {
      parts.push(currentPart.trim())
      currentPart = sentence
    }
    // If adding this sentence would exceed ~300 chars, start new part
    else if ((currentPart + ' ' + sentence).length > 300 && currentPart.length > 0) {
      parts.push(currentPart.trim())
      currentPart = sentence
    }
    else {
      currentPart = currentPart ? currentPart + ' ' + sentence : sentence
    }
  }
  
  // Add remaining content
  if (currentPart.trim()) {
    parts.push(currentPart.trim())
  }
  
  return parts.length > 0 ? parts : [text]
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS AI AGENT BATCH
// ═══════════════════════════════════════════════════════════════════
async function processAIAgentBatch(
  supabase: any,
  batch: any,
  agentConfig: any
): Promise<boolean> {
  const { connectionId, conversationId, messages, contactName, contactPhone, companyId, instanceToken } = batch
  
  console.log(`🤖 [BATCH-AI] Processing batch for conversation ${conversationId} (${messages.length} messages)`)
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  try {
    // Call AI agent process function with batch of messages
    const aiProcessUrl = `${supabaseUrl}/functions/v1/ai-agent-process`
    
    const response = await fetch(aiProcessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        connectionId,
        conversationId,
        messages, // Send array of messages
        contactName,
        contactPhone,
      }),
    })
    
    const result = await response.json()
    
    if (!result.success) {
      if (result.skip) {
        console.log(`🤖 [BATCH-AI] Skipping: ${result.reason}`)
        return true // Not an error, just skipped
      } else {
        console.log(`❌ [BATCH-AI] Error: ${result.error}`)
        return false
      }
    }
    
    const aiResponse = result.response
    const voiceName = result.voiceName
    const shouldGenerateAudio = result.shouldGenerateAudio === true
    const speechSpeed = result.speechSpeed || 1.0
    const audioTemperature = result.audioTemperature || 0.7
    const languageCode = result.languageCode || 'pt-BR'
    const splitResponseEnabled = agentConfig?.split_response_enabled ?? true
    const splitDelaySeconds = agentConfig?.split_message_delay_seconds ?? 2.0
    
    console.log(`✅ [BATCH-AI] Response generated`)
    console.log(`🔊 [BATCH-AI] Audio: shouldGenerate=${shouldGenerateAudio}, voiceName=${voiceName}`)
    console.log(`📝 [BATCH-AI] Split: enabled=${splitResponseEnabled}, delay=${splitDelaySeconds}s`)
    
    // Get contact phone
    const { data: conversation } = await supabase
      .from('conversations')
      .select(`contacts!inner (phone_number)`)
      .eq('id', conversationId)
      .single()
    
    const contactData = conversation?.contacts as any
    if (!contactData?.phone_number) {
      console.log('❌ [BATCH-AI] Contact not found')
      return false
    }
    
    const phoneNumber = contactData.phone_number
    
    // Determine if we should split the response
    const responseParts = splitResponseEnabled && !shouldGenerateAudio 
      ? splitResponse(aiResponse)
      : [aiResponse]
    
    console.log(`📤 [BATCH-AI] Sending ${responseParts.length} message(s) to ${phoneNumber}`)
    
    // Send each part with delay between them
    for (let i = 0; i < responseParts.length; i++) {
      const part = responseParts[i]
      
      // Add delay between messages (not before the first one)
      if (i > 0 && splitDelaySeconds > 0) {
        console.log(`⏳ [BATCH-AI] Waiting ${splitDelaySeconds}s before next message...`)
        await new Promise(resolve => setTimeout(resolve, splitDelaySeconds * 1000))
      }
      
      let whatsappMessageId: string | null = null
      let messageType: 'text' | 'audio' = 'text'
      let mediaUrl: string | null = null
      
      // Generate audio only for first message if enabled
      if (shouldGenerateAudio && voiceName && i === 0) {
        console.log(`🎵 [BATCH-AI] Generating audio with voice: ${voiceName}`)
        
        const ttsUrl = `${supabaseUrl}/functions/v1/ai-agent-tts`
        
        const ttsResponse = await fetch(ttsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            text: aiResponse, // Full response for audio
            voiceName,
            speed: speechSpeed,
            temperature: audioTemperature,
            languageCode
          }),
        })
        
        if (ttsResponse.ok) {
          const ttsResult = await ttsResponse.json()
          const audioUrl = ttsResult.audioUrl
          
          if (audioUrl) {
            console.log(`✅ [BATCH-AI] Audio generated: ${audioUrl}`)
            
            const sendMediaUrl = `${UAZAPI_BASE_URL}/send/media`
            
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
            })
            
            if (sendResponse.ok) {
              const sendResult = await sendResponse.json()
              whatsappMessageId = sendResult.key?.id || sendResult.messageId || sendResult.id
              messageType = 'audio'
              mediaUrl = audioUrl
              console.log(`✅ [BATCH-AI] Audio sent! ID: ${whatsappMessageId}`)
            }
          }
        }
      }
      
      // Fallback to text
      if (!whatsappMessageId) {
        const sendUrl = `${UAZAPI_BASE_URL}/send/text`
        
        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: part
          }),
        })
        
        if (!sendResponse.ok) {
          const errorText = await sendResponse.text()
          console.log(`❌ [BATCH-AI] Send error: ${sendResponse.status} - ${errorText}`)
          continue // Try to send remaining parts
        }
        
        const sendResult = await sendResponse.json()
        whatsappMessageId = sendResult.key?.id || sendResult.messageId || sendResult.id
        messageType = 'text'
        console.log(`✅ [BATCH-AI] Text part ${i + 1}/${responseParts.length} sent! ID: ${whatsappMessageId}`)
      }
      
      // Save message to database
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          direction: 'outbound',
          sender_type: 'bot',
          sender_id: null,
          content: part,
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
            voiceName: voiceName || null,
            processedByQueue: true,
            batchSize: messages.length,
            partIndex: i,
            totalParts: responseParts.length
          }
        })
    }
    
    // Send medias from agent response ({{type:key}} tags)
    const mediasToSend = result.mediasToSend as Array<{ type: string; key: string; url?: string; content?: string; fileName?: string }> | undefined;
    if (mediasToSend && mediasToSend.length > 0) {
      console.log(`📦 [BATCH-AI] Sending ${mediasToSend.length} medias...`);
      
      for (const media of mediasToSend) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between medias
        
        if (media.type === 'text' || media.type === 'link') {
          // Send as text message
          const sendUrl = `${UAZAPI_BASE_URL}/send/text`;
          await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instanceToken },
            body: JSON.stringify({ number: phoneNumber, text: media.content || '' }),
          });
          console.log(`✅ [BATCH-AI] Text/Link sent: ${media.key}`);
        } else if (media.url) {
          // Send media via UAZAPI
          const sendMediaUrl = `${UAZAPI_BASE_URL}/send/media`;
          const mediaTypeMap: Record<string, string> = {
            image: 'image', video: 'video', audio: 'audio', document: 'document'
          };
          
          await fetch(sendMediaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instanceToken },
            body: JSON.stringify({
              number: phoneNumber,
              type: mediaTypeMap[media.type] || 'document',
              file: media.url
            }),
          });
          console.log(`✅ [BATCH-AI] Media sent: ${media.type} - ${media.key}`);
        }
      }
    }
    
    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
    
    console.log(`🎉 [BATCH-AI] Processing complete! (${responseParts.length} messages sent)`)
    return true
    
  } catch (error) {
    console.error(`❌ [BATCH-AI] Error:`, error)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROCESS AI AGENT (Legacy - single message)
// ═══════════════════════════════════════════════════════════════════
async function processAIAgent(
  supabase: any,
  queueItem: any
): Promise<boolean> {
  const { connectionId, conversationId, messageContent, contactName, contactPhone, companyId, instanceToken, msgType, msgMediaUrl } = queueItem
  
  console.log(`🤖 [QUEUE-AI] Processing AI agent for conversation ${conversationId}`)
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  try {
    // Call AI agent process function
    const aiProcessUrl = `${supabaseUrl}/functions/v1/ai-agent-process`
    
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
        messageType: msgType || 'text',
        mediaUrl: msgMediaUrl
      }),
    })
    
    const result = await response.json()
    
    if (!result.success) {
      if (result.skip) {
        console.log(`🤖 [QUEUE-AI] Skipping: ${result.reason}`)
        return true // Not an error, just skipped
      } else {
        console.log(`❌ [QUEUE-AI] Error: ${result.error}`)
        return false
      }
    }
    
    const aiResponse = result.response
    const delaySeconds = result.delaySeconds || 0
    const voiceName = result.voiceName
    const shouldGenerateAudio = result.shouldGenerateAudio === true
    const speechSpeed = result.speechSpeed || 1.0
    const audioTemperature = result.audioTemperature || 0.7
    const languageCode = result.languageCode || 'pt-BR'
    
    console.log(`✅ [QUEUE-AI] Response generated, waiting ${delaySeconds}s...`)
    console.log(`🔊 [QUEUE-AI] Audio: shouldGenerate=${shouldGenerateAudio}, voiceName=${voiceName}`)
    
    if (delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
    }
    
    // Get contact phone
    const { data: conversation } = await supabase
      .from('conversations')
      .select(`contacts!inner (phone_number)`)
      .eq('id', conversationId)
      .single()
    
    const contactData = conversation?.contacts as any
    if (!contactData?.phone_number) {
      console.log('❌ [QUEUE-AI] Contact not found')
      return false
    }
    
    const phoneNumber = contactData.phone_number
    
    let whatsappMessageId: string | null = null
    let messageType: 'text' | 'audio' = 'text'
    let mediaUrl: string | null = null
    
    // Generate audio only if shouldGenerateAudio is true and voiceName is configured
    if (shouldGenerateAudio && voiceName) {
      console.log(`🎵 [QUEUE-AI] Generating audio with voice: ${voiceName}`)
      
      const ttsUrl = `${supabaseUrl}/functions/v1/ai-agent-tts`
      
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
          languageCode
        }),
      })
      
      if (ttsResponse.ok) {
        const ttsResult = await ttsResponse.json()
        const audioUrl = ttsResult.audioUrl
        
        if (audioUrl) {
          console.log(`✅ [QUEUE-AI] Audio generated: ${audioUrl}`)
          
          const sendMediaUrl = `${UAZAPI_BASE_URL}/send/media`
          
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
          })
          
          if (sendResponse.ok) {
            const sendResult = await sendResponse.json()
            whatsappMessageId = sendResult.key?.id || sendResult.messageId || sendResult.id
            messageType = 'audio'
            mediaUrl = audioUrl
            console.log(`✅ [QUEUE-AI] Audio sent! ID: ${whatsappMessageId}`)
          }
        }
      }
    }
    
    // Fallback to text
    if (!whatsappMessageId) {
      const sendUrl = `${UAZAPI_BASE_URL}/send/text`
      
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
      })
      
      if (!sendResponse.ok) {
        const errorText = await sendResponse.text()
        console.log(`❌ [QUEUE-AI] Send error: ${sendResponse.status} - ${errorText}`)
        return false
      }
      
      const sendResult = await sendResponse.json()
      whatsappMessageId = sendResult.key?.id || sendResult.messageId || sendResult.id
      messageType = 'text'
      console.log(`✅ [QUEUE-AI] Text sent! ID: ${whatsappMessageId}`)
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
          voiceName: voiceName || null,
          processedByQueue: true
        }
      })
    
    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
    
    console.log(`🎉 [QUEUE-AI] Processing complete! (${messageType})`)
    return true
    
  } catch (error) {
    console.error(`❌ [QUEUE-AI] Error:`, error)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  console.log(`🔄 [QUEUE-PROCESSOR] Starting batch processing...`)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const stats = {
    mediaProcessed: 0,
    mediaFailed: 0,
    aiProcessed: 0,
    aiFailed: 0,
    batchesProcessed: 0,
    insightsProcessed: 0,
    insightsFailed: 0,
    startTime: Date.now()
  }
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // PROCESS AI AGENT BATCHES (check for ready batches)
    // ═══════════════════════════════════════════════════════════════
    console.log(`📥 [QUEUE] Scanning for ready AI batches...`)
    
    // Get all batch keys using scan
    const batchKeys: string[] = []
    let cursor = 0
    do {
      const result = await redis.scan(cursor, { match: 'ai-batch:*', count: 100 })
      cursor = result[0]
      batchKeys.push(...(result[1] as string[]))
    } while (cursor !== 0)
    
    console.log(`📥 [QUEUE] Found ${batchKeys.length} AI batch(es)`)
    
    for (const batchKey of batchKeys) {
      try {
        const batchRaw = await redis.get(batchKey)
        if (!batchRaw) continue
        
        const batch = typeof batchRaw === 'string' ? JSON.parse(batchRaw) : batchRaw
        
        // Get agent config for this connection to get batch delay
        const { data: agentConnection } = await supabase
          .from('ai_agent_connections')
          .select(`
            ai_agents (
              id,
              message_batch_seconds,
              split_response_enabled,
              split_message_delay_seconds
            )
          `)
          .eq('connection_id', batch.connectionId)
          .maybeSingle()
        
        const agentConfig = agentConnection?.ai_agents as any
        const batchSeconds = agentConfig?.message_batch_seconds ?? 75
        
        // Check if debounce time has passed
        const lastUpdated = new Date(batch.lastUpdated).getTime()
        const now = Date.now()
        const elapsed = (now - lastUpdated) / 1000
        
        console.log(`⏱️ [BATCH] ${batchKey}: elapsed=${elapsed.toFixed(1)}s, threshold=${batchSeconds}s, messages=${batch.messages.length}`)
        
        if (elapsed >= batchSeconds) {
          console.log(`✅ [BATCH] Ready to process: ${batchKey}`)
          
          const success = await processAIAgentBatch(supabase, batch, agentConfig)
          
          // Always delete the batch key after processing (success or fail)
          await redis.del(batchKey)
          
          if (success) {
            stats.batchesProcessed++
            stats.aiProcessed++
          } else {
            stats.aiFailed++
          }
        } else {
          console.log(`⏳ [BATCH] Not ready yet: ${batchKey} (${(batchSeconds - elapsed).toFixed(1)}s remaining)`)
        }
      } catch (err) {
        console.error(`❌ [BATCH] Error processing batch ${batchKey}:`, err)
        // Delete problematic batch to prevent infinite errors
        await redis.del(batchKey)
        stats.aiFailed++
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PROCESS LEGACY AI QUEUE (direct queue items without batching)
    // ═══════════════════════════════════════════════════════════════
    const aiQueueKey = 'queue:ai-agent'
    const aiItems = await redis.lrange(aiQueueKey, 0, 4)
    
    console.log(`📥 [QUEUE] Found ${aiItems.length} legacy AI agent items`)
    
    for (const rawItem of aiItems) {
      try {
        const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem
        
        const success = await processAIAgent(supabase, item.data)
        
        if (success) {
          await redis.lrem(aiQueueKey, 1, rawItem)
          stats.aiProcessed++
        } else {
          // Move to retry queue with incremented attempts
          const newAttempts = (item.attempts || 0) + 1
          if (newAttempts >= 3) {
            // Move to DLQ
            await redis.rpush('queue:dlq', JSON.stringify({
              ...item,
              attempts: newAttempts,
              failedAt: new Date().toISOString(),
              type: 'ai-agent'
            }))
            await redis.lrem(aiQueueKey, 1, rawItem)
            console.log(`💀 [QUEUE] AI item moved to DLQ after ${newAttempts} attempts`)
          } else {
            // Update attempts and keep in queue (will be retried next run)
            await redis.lrem(aiQueueKey, 1, rawItem)
            await redis.rpush(aiQueueKey, JSON.stringify({ ...item, attempts: newAttempts }))
          }
          stats.aiFailed++
        }
      } catch (err) {
        console.error(`❌ [QUEUE] Error processing AI item:`, err)
        stats.aiFailed++
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PROCESS MEDIA QUEUE - up to 10 items
    // ═══════════════════════════════════════════════════════════════
    const mediaQueueKey = 'queue:media'
    const mediaItems = await redis.lrange(mediaQueueKey, 0, 9)
    
    console.log(`📥 [QUEUE] Found ${mediaItems.length} media items`)
    
    for (const rawItem of mediaItems) {
      try {
        const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem
        
        const success = await processMediaMessage(supabase, item.data)
        
        if (success) {
          await redis.lrem(mediaQueueKey, 1, rawItem)
          stats.mediaProcessed++
        } else {
          const newAttempts = (item.attempts || 0) + 1
          if (newAttempts >= 3) {
            await redis.rpush('queue:dlq', JSON.stringify({
              ...item,
              attempts: newAttempts,
              failedAt: new Date().toISOString(),
              type: 'media'
            }))
            await redis.lrem(mediaQueueKey, 1, rawItem)
            console.log(`💀 [QUEUE] Media item moved to DLQ after ${newAttempts} attempts`)
          } else {
            await redis.lrem(mediaQueueKey, 1, rawItem)
            await redis.rpush(mediaQueueKey, JSON.stringify({ ...item, attempts: newAttempts }))
          }
          stats.mediaFailed++
        }
      } catch (err) {
        console.error(`❌ [QUEUE] Error processing media item:`, err)
        stats.mediaFailed++
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PROCESS INSIGHTS JOBS - 1 job at a time (heavy processing)
    // ═══════════════════════════════════════════════════════════════
    const insightsQueueKey = 'queue:insights'
    const insightsItems = await redis.lrange(insightsQueueKey, 0, 0) // 1 at a time
    
    console.log(`📥 [QUEUE] Found ${insightsItems.length} insights job(s)`)
    
    for (const rawItem of insightsItems) {
      try {
        const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem
        const { jobId, companyId, filters } = item
        
        console.log(`📊 [INSIGHTS] Processing job ${jobId}`)
        
        // Update status to processing
        await supabase
          .from('insights_jobs')
          .update({ 
            status: 'processing', 
            started_at: new Date().toISOString(),
            current_step: 'Iniciando análise...'
          })
          .eq('id', jobId)
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'processing',
          progress: 5,
          currentStep: 'Iniciando análise...'
        }), { ex: 86400 })
        
        // Get evaluations and criteria from filters
        const { evaluations, criteriaScores, filterDescription, conversationIds } = filters
        
        if (!evaluations || evaluations.length === 0) {
          throw new Error('No evaluations provided')
        }
        
        // Update progress - preparing data
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'processing',
          progress: 15,
          currentStep: `Preparando ${evaluations.length} avaliações...`
        }), { ex: 86400 })
        
        // Fetch media for conversations
        const { data: messagesWithMedia } = await supabase
          .from('messages')
          .select('conversation_id, media_url, media_mime_type, message_type')
          .eq('direction', 'outbound')
          .in('conversation_id', conversationIds || evaluations.map((e: any) => e.conversation_id))
          .not('media_url', 'is', null)
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'processing',
          progress: 25,
          currentStep: 'Buscando dados de contatos...'
        }), { ex: 86400 })
        
        // Get contact names
        const convIds = conversationIds || evaluations.map((e: any) => e.conversation_id)
        const { data: conversationsData } = await supabase
          .from('conversations')
          .select('id, contact:contacts(name)')
          .in('id', convIds)
        
        const contactNames: Record<string, string> = {}
        conversationsData?.forEach((c: any) => {
          const contact = c.contact as any
          if (contact?.name) {
            contactNames[c.id] = contact.name
          }
        })
        
        // Helper to determine media type
        const getMediaType = (mimeType: string, messageType: string): 'image' | 'video' | 'audio' | 'document' => {
          if (messageType === 'image' || mimeType?.startsWith('image/')) return 'image'
          if (messageType === 'video' || mimeType?.startsWith('video/')) return 'video'
          if (messageType === 'audio' || messageType === 'ptt' || mimeType?.startsWith('audio/')) return 'audio'
          return 'document'
        }
        
        // Group media by conversation
        const mediaByConversation: Record<string, any[]> = {}
        messagesWithMedia?.forEach((msg: any) => {
          if (!mediaByConversation[msg.conversation_id]) {
            mediaByConversation[msg.conversation_id] = []
          }
          mediaByConversation[msg.conversation_id].push({
            url: msg.media_url!,
            mimeType: msg.media_mime_type || 'application/octet-stream',
            type: getMediaType(msg.media_mime_type || '', msg.message_type || ''),
          })
        })
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'processing',
          progress: 35,
          currentStep: 'Preparando dados para análise de IA...'
        }), { ex: 86400 })
        
        // Build conversationsWithMedia array
        const conversationsWithMedia = evaluations.slice(0, 100).map((e: any) => ({
          conversationId: e.conversation_id,
          contactName: contactNames[e.conversation_id],
          evaluation: {
            conversation_id: e.conversation_id,
            overall_score: e.overall_score,
            communication_score: e.communication_score,
            objectivity_score: e.objectivity_score,
            humanization_score: e.humanization_score,
            objection_handling_score: e.objection_handling_score,
            closing_score: e.closing_score,
            response_time_score: e.response_time_score,
            strengths: e.strengths,
            improvements: e.improvements,
            ai_summary: e.ai_summary,
            lead_qualification: e.lead_qualification,
          },
          medias: (mediaByConversation[e.conversation_id] || []).slice(0, 10),
        }))
        
        const totalMedias = conversationsWithMedia.reduce((sum: number, c: any) => sum + c.medias.length, 0)
        console.log(`📊 [INSIGHTS] Sending ${conversationsWithMedia.length} conversations with ${totalMedias} medias to AI`)
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'processing',
          progress: 50,
          currentStep: 'Chamando IA para análise...'
        }), { ex: 86400 })
        
        // Call generate-filtered-insights
        const { data: result, error: insightsError } = await supabase.functions.invoke('generate-filtered-insights', {
          body: {
            conversationsWithMedia,
            criteriaScores,
            filterDescription,
          },
        })
        
        if (insightsError) {
          throw new Error(`AI Error: ${insightsError.message}`)
        }
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'processing',
          progress: 90,
          currentStep: 'Finalizando análise...'
        }), { ex: 86400 })
        
        // Prepare final result
        const finalResult = {
          strengths: result?.strengths || [],
          weaknesses: result?.weaknesses || [],
          positivePatterns: result?.positivePatterns || [],
          negativePatterns: result?.negativePatterns || [],
          insights: result?.insights || [],
          criticalIssues: result?.criticalIssues || [],
          finalRecommendation: result?.finalRecommendation || '',
          mediaStats: result?.mediaStats,
        }
        
        // Update job as completed
        await supabase
          .from('insights_jobs')
          .update({
            status: 'completed',
            result: finalResult,
            completed_at: new Date().toISOString(),
            progress: 100,
            current_step: 'Concluído'
          })
          .eq('id', jobId)
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'completed',
          progress: 100,
          currentStep: 'Concluído'
        }), { ex: 86400 })
        
        // Remove from queue
        await redis.lrem(insightsQueueKey, 1, rawItem)
        
        stats.insightsProcessed++
        console.log(`✅ [INSIGHTS] Job ${jobId} completed successfully`)
        
      } catch (err) {
        console.error(`❌ [INSIGHTS] Error processing job:`, err)
        
        const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem
        const { jobId } = item
        
        // Update job as failed
        await supabase
          .from('insights_jobs')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
            completed_at: new Date().toISOString(),
            current_step: 'Erro'
          })
          .eq('id', jobId)
        
        await redis.set(`job:status:${jobId}`, JSON.stringify({
          status: 'failed',
          progress: 0,
          currentStep: 'Erro no processamento'
        }), { ex: 86400 })
        
        // Remove from queue
        await redis.lrem(insightsQueueKey, 1, rawItem)
        
        stats.insightsFailed++
      }
    }
    
    // Update stats in Redis
    await redis.hincrby('queue:stats', 'media_processed', stats.mediaProcessed)
    await redis.hincrby('queue:stats', 'media_failed', stats.mediaFailed)
    await redis.hincrby('queue:stats', 'ai_processed', stats.aiProcessed)
    await redis.hincrby('queue:stats', 'ai_failed', stats.aiFailed)
    await redis.hincrby('queue:stats', 'batches_processed', stats.batchesProcessed)
    await redis.hincrby('queue:stats', 'insights_processed', stats.insightsProcessed)
    await redis.hincrby('queue:stats', 'insights_failed', stats.insightsFailed)
    await redis.set('queue:stats:last_run', new Date().toISOString())
    
    const duration = Date.now() - stats.startTime
    
    console.log(`✅ [QUEUE-PROCESSOR] Completed in ${duration}ms`)
    console.log(`   Media: ${stats.mediaProcessed} processed, ${stats.mediaFailed} failed`)
    console.log(`   AI: ${stats.aiProcessed} processed, ${stats.aiFailed} failed`)
    console.log(`   Batches: ${stats.batchesProcessed} processed`)
    console.log(`   Insights: ${stats.insightsProcessed} processed, ${stats.insightsFailed} failed`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        stats: {
          ...stats,
          durationMs: duration
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error(`❌ [QUEUE-PROCESSOR] Fatal error:`, error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
