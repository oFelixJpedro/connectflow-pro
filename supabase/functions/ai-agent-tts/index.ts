import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Language names for Style Control
const LANGUAGE_NAMES: Record<string, string> = {
  'pt-BR': 'Brazilian Portuguese',
  'en-US': 'American English',
  'es-ES': 'Spanish from Spain',
};

// Get style control prefix based on speed and language
function getStylePrefix(speed: number, languageCode: string): string {
  const langName = LANGUAGE_NAMES[languageCode] || 'Brazilian Portuguese';
  
  if (speed <= 0.85) {
    return `[speak slowly and calmly in ${langName}] `;
  }
  if (speed >= 1.1) {
    return `[speak quickly and energetically in ${langName}] `;
  }
  // Normal speed - still include language for consistency
  return `[speak naturally in ${langName}] `;
}

// Convert L16 PCM to WAV format (browser-compatible)
function convertL16ToWav(pcmData: Uint8Array, sampleRate: number = 24000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  
  const wav = new Uint8Array(headerSize + dataSize);
  const view = new DataView(wav.buffer);
  
  // RIFF header
  wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, 36 + dataSize, true); // File size - 8
  wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  
  // fmt chunk
  wav.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  wav.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, dataSize, true);
  wav.set(pcmData, 44);
  
  return wav;
}

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
    const { text, voiceName, speed = 1.0, temperature = 0.7, languageCode = 'pt-BR' } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'text é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Apply style prefix via Style Control (includes speed + language)
    const stylePrefix = getStylePrefix(speed, languageCode);
    const textWithStyle = stylePrefix + text;

    console.log(`Generating TTS for voice: ${voiceName} at speed: ${speed}, temperature: ${temperature}, language: ${languageCode}`);
    console.log(`Text length: ${text.length} chars, with style prefix: ${textWithStyle.length} chars`);

    // Generate audio using Gemini TTS API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
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
                  text: textWithStyle
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            temperature: temperature,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: geminiVoice
                }
              },
              languageCode: languageCode
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

    if (!audioData) {
      console.error('No audio data in response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Nenhum áudio gerado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 audio (L16/PCM format from Gemini)
    const binaryString = atob(audioData);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    // Convert L16 PCM to WAV (browser-compatible)
    const wavBytes = convertL16ToWav(pcmBytes, 24000);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const audioKey = `tts-audio/${timestamp}_${randomId}.wav`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('ai-agent-media')
      .upload(audioKey, wavBytes, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (uploadError) {
      console.error('Failed to upload audio:', uploadError);
      // Return base64 WAV directly if upload fails
      const wavBase64 = btoa(String.fromCharCode(...wavBytes));
      return new Response(
        JSON.stringify({ 
          audioBase64: wavBase64, 
          mimeType: 'audio/wav'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signed URL for the uploaded file (1 hour expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('ai-agent-media')
      .createSignedUrl(audioKey, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Failed to get signed URL:', signedUrlError);
      // Return base64 WAV directly if can't get signed URL
      const wavBase64 = btoa(String.fromCharCode(...wavBytes));
      return new Response(
        JSON.stringify({ 
          audioBase64: wavBase64, 
          mimeType: 'audio/wav'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ TTS audio generated successfully: ${audioKey}`);

    return new Response(
      JSON.stringify({ 
        audioUrl: signedUrlData.signedUrl,
        audioKey: audioKey
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-agent-tts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
