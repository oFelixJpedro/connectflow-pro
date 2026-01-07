import { createClient } from "npm:@supabase/supabase-js@2";
import { transcribeAudio } from "../_shared/media-cache.ts";
import { logAIUsage } from "../_shared/usage-tracker.ts";
import { checkCredits, consumeCredits } from "../_shared/supabase-credits.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { audioUrl, companyId } = await req.json();
    
    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    console.log('Transcribing audio from URL:', audioUrl);
    console.log('Company ID for cache:', companyId || 'not provided (cache disabled)');

    // Create Supabase client for caching if companyId is provided
    let supabase = null;
    if (companyId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('Supabase client created for caching');
      } else {
        console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured, cache disabled');
      }
    }

    // 💰 Check credits before transcription
    if (supabase && companyId) {
      const creditCheck = await checkCredits(supabase, companyId, 'standard_text', 500);
      if (!creditCheck.hasCredits) {
        return new Response(JSON.stringify({ 
          error: creditCheck.errorMessage,
          code: 'INSUFFICIENT_CREDITS',
          creditType: 'standard_text',
          currentBalance: creditCheck.currentBalance,
          success: false 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Use the shared transcribeAudio function with caching support
    const startTime = Date.now();
    const transcription = await transcribeAudio(
      audioUrl,
      GEMINI_API_KEY,
      supabase,
      companyId
    );
    
    // Log AI usage - estimate tokens based on transcription result
    // Audio tokens: ~25 tokens per second of audio, but we estimate from transcription length
    // Typical audio: 150 words/minute = 2.5 words/second = ~3.5 tokens/second
    // Output: transcription text, ~1 token per 4 chars
    if (supabase && companyId && transcription) {
      // Estimate input tokens: audio content is typically ~25 tokens/second
      // We estimate audio duration from transcription (150 words/min speaking rate)
      const wordCount = transcription.split(/\s+/).length;
      const estimatedDurationSeconds = (wordCount / 150) * 60; // 150 words per minute
      const estimatedAudioTokens = Math.ceil(estimatedDurationSeconds * 25); // ~25 tokens/second for audio
      const outputTokens = Math.ceil((transcription?.length || 0) / 4);
      
      await logAIUsage(
        supabase, companyId, 'transcribe-audio',
        'gemini-2.0-flash', // Actually uses flash for transcription
        estimatedAudioTokens,
        outputTokens,
        Date.now() - startTime,
        { 
          audio_url: audioUrl.substring(0, 100),
          word_count: wordCount,
          estimated_duration_seconds: Math.round(estimatedDurationSeconds)
        },
        true // isAudioInput - audio transcription always uses audio pricing
      );
      
      // 💰 Consume credits after successful transcription
      const totalTokens = estimatedAudioTokens + outputTokens;
      await consumeCredits(
        supabase,
        companyId,
        'standard_text',
        totalTokens,
        'transcribe-audio',
        estimatedAudioTokens,
        outputTokens
      );
      console.log('💰 Créditos consumidos:', totalTokens);
    }
    
    console.log('Transcription result:', transcription ? `${transcription.substring(0, 100)}...` : '(empty)');

    return new Response(JSON.stringify({ 
      text: transcription || '',
      success: true,
      cached: supabase && companyId ? 'enabled' : 'disabled'
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
