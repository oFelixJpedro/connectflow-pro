import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { audioUrl } = await req.json();
    
    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    console.log('Transcribing audio from URL:', audioUrl);

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    // Determine file extension from content type
    let extension = 'ogg';
    if (contentType.includes('mp3') || contentType.includes('mpeg')) {
      extension = 'mp3';
    } else if (contentType.includes('wav')) {
      extension = 'wav';
    } else if (contentType.includes('webm')) {
      extension = 'webm';
    } else if (contentType.includes('m4a') || contentType.includes('mp4')) {
      extension = 'm4a';
    }

    console.log('Audio content type:', contentType, 'Extension:', extension);
    console.log('Audio size:', audioBlob.size, 'bytes');

    // Create FormData for OpenAI API
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${extension}`);
    formData.append('model', 'gpt-4o-transcribe');
    formData.append('language', 'pt'); // Portuguese as default, can be made dynamic

    // Call OpenAI Whisper API
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('OpenAI API error:', transcriptionResponse.status, errorText);
      throw new Error(`OpenAI API error: ${transcriptionResponse.status} - ${errorText}`);
    }

    const result = await transcriptionResponse.json();
    console.log('Transcription result:', result);

    return new Response(JSON.stringify({ 
      text: result.text,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
