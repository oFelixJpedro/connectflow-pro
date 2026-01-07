import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PREVIEW_TEXT = "Olá! Eu sou a assistente virtual. Como posso ajudar você hoje?";

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voiceName, speed = 1.0, languageCode = 'pt-BR', temperature = 0.7 } = await req.json();

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

    // Normalize speed for cache key (0.7, 1.0, or 1.2)
    const normalizedSpeed = speed <= 0.85 ? 0.7 : speed >= 1.1 ? 1.2 : 1.0;
    
    // Check if cached preview exists (include speed, language, and temperature in cache key)
    const cacheKey = `voice-previews/${voiceName.toLowerCase()}_${normalizedSpeed}_${languageCode}_temp${temperature}.wav`;
    const { data: existingFile } = await supabase.storage
      .from('ai-agent-media')
      .createSignedUrl(cacheKey, 3600); // 1 hour signed URL

    if (existingFile?.signedUrl) {
      console.log(`Cache hit for voice: ${voiceName} at speed: ${normalizedSpeed}, temp: ${temperature}`);
      return new Response(
        JSON.stringify({ audioUrl: existingFile.signedUrl, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply style prefix via Style Control (includes speed + language)
    const stylePrefix = getStylePrefix(speed, languageCode);
    const textWithStyle = stylePrefix + PREVIEW_TEXT;

    console.log(`Generating voice preview for: ${voiceName} at speed: ${speed}, language: ${languageCode}, temperature: ${temperature} (prefix: "${stylePrefix}")`);

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
            temperature: temperature,
            responseModalities: ["AUDIO"],
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

    // Upload to storage for caching as WAV
    const { error: uploadError } = await supabase.storage
      .from('ai-agent-media')
      .upload(cacheKey, wavBytes, {
        contentType: 'audio/wav',
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
      // Return base64 WAV directly if can't get signed URL
      const wavBase64 = btoa(String.fromCharCode(...wavBytes));
      return new Response(
        JSON.stringify({ 
          audioBase64: wavBase64, 
          mimeType: 'audio/wav',
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
