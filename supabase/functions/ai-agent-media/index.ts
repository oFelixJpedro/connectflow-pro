import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log('📂 AI Agent Media:', action, params.agentId || params.mediaId);

    switch (action) {
      case 'upload': {
        const { agentId, mediaType, mediaKey, fileBase64, fileName, mimeType } = params;

        if (!agentId || !mediaType || !mediaKey || !fileBase64) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate media key format (alphanumeric, hyphens, underscores)
        if (!/^[a-zA-Z0-9_-]+$/.test(mediaKey)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Media key must contain only letters, numbers, hyphens, and underscores' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if key already exists for this agent
        const { data: existing } = await supabase
          .from('ai_agent_media')
          .select('id')
          .eq('agent_id', agentId)
          .eq('media_key', mediaKey)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, error: 'Media key already exists for this agent' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decode base64 and upload to storage
        const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Get extension from mime type
        const extMap: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'video/webm': 'webm',
          'video/quicktime': 'mov',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/ogg': 'ogg',
          'audio/opus': 'opus',
          'audio/webm': 'webm',
          'audio/wav': 'wav',
          'audio/mp4': 'm4a',
          'application/pdf': 'pdf',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'application/vnd.ms-excel': 'xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        };

        const ext = extMap[mimeType] || fileName?.split('.').pop() || 'bin';
        const storagePath = `${agentId}/${mediaKey}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ai-agent-media')
          .upload(storagePath, bytes, {
            contentType: mimeType,
            upsert: true
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return new Response(
            JSON.stringify({ success: false, error: 'Upload failed: ' + uploadError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: { publicUrl } } = supabase.storage
          .from('ai-agent-media')
          .getPublicUrl(uploadData.path);

        // Insert record into ai_agent_media
        const { data: media, error: insertError } = await supabase
          .from('ai_agent_media')
          .insert({
            agent_id: agentId,
            media_type: mediaType,
            media_key: mediaKey,
            media_url: publicUrl,
            file_name: fileName,
            file_size: bytes.length,
            mime_type: mimeType,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          // Try to cleanup uploaded file
          await supabase.storage.from('ai-agent-media').remove([storagePath]);
          return new Response(
            JSON.stringify({ success: false, error: 'Database insert failed: ' + insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Media uploaded:', mediaKey, publicUrl);
        return new Response(
          JSON.stringify({ success: true, media }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_text':
      case 'create_link': {
        const { agentId, mediaType, mediaKey, mediaContent } = params;

        if (!agentId || !mediaType || !mediaKey || !mediaContent) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate media key format
        if (!/^[a-zA-Z0-9_-]+$/.test(mediaKey)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Media key must contain only letters, numbers, hyphens, and underscores' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if key already exists
        const { data: existing } = await supabase
          .from('ai_agent_media')
          .select('id')
          .eq('agent_id', agentId)
          .eq('media_key', mediaKey)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, error: 'Media key already exists for this agent' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: media, error: insertError } = await supabase
          .from('ai_agent_media')
          .insert({
            agent_id: agentId,
            media_type: mediaType,
            media_key: mediaKey,
            media_content: mediaContent,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Insert failed: ' + insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Text/Link created:', mediaKey);
        return new Response(
          JSON.stringify({ success: true, media }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        const { agentId } = params;

        if (!agentId) {
          return new Response(
            JSON.stringify({ success: false, error: 'agentId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: medias, error: listError } = await supabase
          .from('ai_agent_media')
          .select('*')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false });

        if (listError) {
          console.error('List error:', listError);
          return new Response(
            JSON.stringify({ success: false, error: 'List failed: ' + listError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate signed URLs for media items with storage URLs (private bucket)
        const mediasWithSignedUrls = await Promise.all(
          (medias || []).map(async (media) => {
            if (media.media_url && media.media_url.includes('/ai-agent-media/')) {
              try {
                // Extract storage path from URL
                const urlParts = media.media_url.split('/ai-agent-media/');
                if (urlParts.length > 1) {
                  const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
                  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from('ai-agent-media')
                    .createSignedUrl(storagePath, 3600); // 1 hour validity
                  
                  if (signedUrlData?.signedUrl) {
                    console.log('✅ Signed URL generated for:', media.media_key);
                    return { ...media, media_url: signedUrlData.signedUrl };
                  } else if (signedUrlError) {
                    console.log('⚠️ Signed URL error:', signedUrlError.message);
                  }
                }
              } catch (e) {
                console.log('⚠️ Error generating signed URL for', media.media_key, e);
              }
            }
            return media;
          })
        );

        return new Response(
          JSON.stringify({ success: true, medias: mediasWithSignedUrls }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { mediaId } = params;

        if (!mediaId) {
          return new Response(
            JSON.stringify({ success: false, error: 'mediaId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get media info first
        const { data: media, error: fetchError } = await supabase
          .from('ai_agent_media')
          .select('*')
          .eq('id', mediaId)
          .single();

        if (fetchError || !media) {
          return new Response(
            JSON.stringify({ success: false, error: 'Media not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete from storage if it has a URL
        if (media.media_url) {
          const urlPath = media.media_url.split('/ai-agent-media/')[1];
          if (urlPath) {
            await supabase.storage.from('ai-agent-media').remove([urlPath]);
          }
        }

        // Delete from database
        const { error: deleteError } = await supabase
          .from('ai_agent_media')
          .delete()
          .eq('id', mediaId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Delete failed: ' + deleteError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Media deleted:', media.media_key);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
