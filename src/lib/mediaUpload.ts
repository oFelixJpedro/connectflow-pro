import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  success: boolean;
  url?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Upload media directly to Supabase Storage
 * Returns the public URL immediately for optimistic UI updates
 */
export async function uploadMediaToStorage(
  file: File,
  companyId: string,
  conversationId: string
): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${companyId}/${conversationId}/${timestamp}_${sanitizedFileName}`;

    console.log('📤 Uploading media to Storage:', storagePath);

    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('❌ Storage upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    console.log('✅ Media uploaded:', urlData.publicUrl);

    return {
      success: true,
      url: urlData.publicUrl,
      storagePath,
    };
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Create a pending message in the database for optimistic UI
 */
export async function createPendingMessage(params: {
  conversationId: string;
  connectionId: string;
  contactId: string;
  messageType: 'image' | 'video' | 'audio' | 'document';
  mediaUrl: string;
  content?: string;
  metadata: Record<string, unknown>;
  quotedMessageId?: string;
  userId: string;
}): Promise<any> {
  // Use raw insert to bypass type checking issues
  const insertData = {
    conversation_id: params.conversationId,
    connection_id: params.connectionId,
    contact_id: params.contactId,
    message_type: params.messageType,
    content: params.content || '',
    media_url: params.mediaUrl,
    direction: 'outbound',
    sender_type: 'user',
    sender_id: params.userId,
    status: 'pending',
    quoted_message_id: params.quotedMessageId || null,
    metadata: params.metadata,
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating pending message:', error);
    throw error;
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', params.conversationId);

  return data;
}

/**
 * Convert database message to frontend Message type
 */
export function dbMessageToFrontend(dbMessage: any): any {
  return {
    id: dbMessage.id,
    conversationId: dbMessage.conversation_id,
    connectionId: dbMessage.connection_id,
    contactId: dbMessage.contact_id,
    content: dbMessage.content,
    messageType: dbMessage.message_type,
    mediaUrl: dbMessage.media_url,
    direction: dbMessage.direction,
    senderType: dbMessage.sender_type,
    senderId: dbMessage.sender_id,
    status: dbMessage.status,
    whatsappMessageId: dbMessage.whatsapp_message_id,
    quotedMessageId: dbMessage.quoted_message_id,
    metadata: dbMessage.metadata,
    isDeleted: dbMessage.is_deleted,
    isInternalNote: dbMessage.is_internal_note,
    createdAt: dbMessage.created_at,
    updatedAt: dbMessage.updated_at,
  };
}
