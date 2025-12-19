import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
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

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    // Normalize mime type for Gemini
    let mimeType = contentType.split(';')[0].trim();
    if (mimeType === 'audio/mpeg') {
      mimeType = 'audio/mp3';
    }

    console.log('Audio content type:', mimeType);
    console.log('Audio size:', audioBuffer.byteLength, 'bytes');

    // Convert audio to base64
    const base64Audio = arrayBufferToBase64(audioBuffer);
    console.log('Base64 audio length:', base64Audio.length);

    // Call Gemini API for transcription
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { 
                text: "Transcreva este áudio em português brasileiro. Retorne APENAS a transcrição do que foi dito, sem explicações, comentários ou formatação adicional. Se o áudio estiver vazio ou inaudível, retorne uma string vazia." 
              },
              { 
                inline_data: { 
                  mime_type: mimeType, 
                  data: base64Audio 
                } 
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8000
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response:', JSON.stringify(geminiData, null, 2));

    // Extract transcription from Gemini response
    const transcription = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    
    console.log('Transcription result:', transcription);

    return new Response(JSON.stringify({ 
      text: transcription,
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
