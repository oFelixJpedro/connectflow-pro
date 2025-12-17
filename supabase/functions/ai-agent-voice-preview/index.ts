import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PREVIEW_TEXT = "Olá! Eu sou a assistente virtual. Como posso ajudar você hoje?";

// Map voice names to Gemini voice IDs
const VOICE_MAP: Record<string, string> = {
  'Zephyr': 'Zephyr',
  'Kore': 'Kore',
  'Orus': 'Orus',
  'Autonoe': 'Autonoe',
  'Umbriel': 'Umbriel',
  'Erinome': 'Erinome',
  'Laomedeia': 'Laomedeia',
  'Schedar': 'Schedar',
  'Achird': 'Achird',
  'Sadachbia': 'Sadachbia',
  'Puck': 'Puck',
  'Fenrir': 'Fenrir',
  'Aoede': 'Aoede',
  'Enceladus': 'Enceladus',
  'Algieba': 'Algieba',
  'Algenib': 'Algenib',
  'Achernar': 'Achernar',
  'Gacrux': 'Gacrux',
  'Zubenelgenubi': 'Zubenelgenubi',
  'Sadaltager': 'Sadaltager',
  'Charon': 'Charon',
  'Leda': 'Leda',
  'Callirrhoe': 'Callirrhoe',
  'Iapetus': 'Iapetus',
  'Despina': 'Despina',
  'Rasalgethi': 'Rasalgethi',
  'Alnilam': 'Alnilam',
  'Pulcherrima': 'Pulcherrima',
  'Vindemiatrix': 'Vindemiatrix',
  'Sulafat': 'Sulafat',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceName } = await req.json();

    if (!voiceName) {
      return new Response(
        JSON.stringify({ error: 'voiceName é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiVoice = VOICE_MAP[voiceName] || 'Kore';
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if cached preview exists
    const cacheKey = `voice-previews/${voiceName.toLowerCase()}.mp3`;
    const { data: existingFile } = await supabase.storage
      .from('ai-agent-media')
      .createSignedUrl(cacheKey, 3600); // 1 hour signed URL

    if (existingFile?.signedUrl) {
      console.log(`Cache hit for voice: ${voiceName}`);
      return new Response(
        JSON.stringify({ audioUrl: existingFile.signedUrl, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating voice preview for: ${voiceName} with Gemini voice: ${geminiVoice}`);

    // Generate audio using Gemini TTS API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: PREVIEW_TEXT
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: geminiVoice
                }
              }
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini TTS error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar áudio', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract audio data from Gemini response
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/mp3';

    if (!audioData) {
      console.error('No audio data in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Nenhum áudio gerado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 audio
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage for caching
    const { error: uploadError } = await supabase.storage
      .from('ai-agent-media')
      .upload(cacheKey, bytes, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.warn('Failed to cache audio:', uploadError);
    }

    // Get signed URL for the uploaded file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('ai-agent-media')
      .createSignedUrl(cacheKey, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      // Return base64 directly if can't get signed URL
      return new Response(
        JSON.stringify({ 
          audioBase64: audioData, 
          mimeType,
          cached: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ audioUrl: signedUrlData.signedUrl, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-agent-voice-preview:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
