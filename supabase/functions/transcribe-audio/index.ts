import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { transcribeAudio } from "../_shared/media-cache.ts";

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

    // Use the shared transcribeAudio function with caching support
    const transcription = await transcribeAudio(
      audioUrl,
      GEMINI_API_KEY,
      supabase,
      companyId
    );
    
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
