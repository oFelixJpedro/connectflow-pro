import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionRequest {
  action: 'create' | 'validate' | 'heartbeat' | 'invalidate' | 'list';
  session_token?: string;
  device_info?: Record<string, unknown>;
  is_support_session?: boolean; // New: flag for developer support sessions
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to get user info
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SessionRequest = await req.json();
    const { action, session_token, device_info, is_support_session } = body;

    // Get user's company_id from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const user_agent = req.headers.get('user-agent') || 'unknown';

    switch (action) {
      case 'create': {
        console.log(`[session-manager] Creating session for user ${user.id}, is_support_session: ${is_support_session}`);
        
        // Support sessions do NOT invalidate other sessions
        if (!is_support_session) {
          // 1. Get all active non-support sessions for user (to broadcast invalidation)
          const { data: activeSessions } = await supabaseAdmin
            .from('user_sessions')
            .select('id, session_token')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .eq('is_support_session', false); // Only get non-support sessions

          // 2. Invalidate all existing active non-support sessions
          if (activeSessions && activeSessions.length > 0) {
            console.log(`[session-manager] Invalidating ${activeSessions.length} existing non-support sessions`);
            
            await supabaseAdmin
              .from('user_sessions')
              .update({
                is_active: false,
                invalidated_at: new Date().toISOString(),
                invalidated_reason: 'new_login'
              })
              .eq('user_id', user.id)
              .eq('is_active', true)
              .eq('is_support_session', false); // Only invalidate non-support sessions

            // 3. Broadcast invalidation event via Realtime
            for (const session of activeSessions) {
              console.log(`[session-manager] Broadcasting invalidation for session ${session.id}`);
            }
          }
        } else {
          console.log(`[session-manager] Support session - NOT invalidating user sessions`);
        }

        // 4. Generate new session token
        const newSessionToken = crypto.randomUUID();

        // 5. Insert new session with is_support_session flag
        const { data: newSession, error: insertError } = await supabaseAdmin
          .from('user_sessions')
          .insert({
            user_id: user.id,
            company_id: profile.company_id,
            session_token: newSessionToken,
            device_info: device_info || {},
            ip_address,
            user_agent,
            is_active: true,
            is_support_session: is_support_session || false
          })
          .select()
          .single();

        if (insertError) {
          console.error('[session-manager] Error creating session:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[session-manager] Session created: ${newSession.id}, is_support: ${is_support_session || false}`);

        return new Response(
          JSON.stringify({
            success: true,
            session_token: newSessionToken,
            session_id: newSession.id,
            is_support_session: is_support_session || false,
            invalidated_sessions: is_support_session ? 0 : (await supabaseAdmin
              .from('user_sessions')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_active', false)
              .eq('invalidated_reason', 'new_login')
            ).data?.length || 0
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate': {
        if (!session_token) {
          return new Response(
            JSON.stringify({ error: 'Session token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: session, error: sessionError } = await supabaseAdmin
          .from('user_sessions')
          .select('*')
          .eq('session_token', session_token)
          .eq('user_id', user.id)
          .single();

        if (sessionError || !session) {
          return new Response(
            JSON.stringify({ valid: false, reason: 'Session not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!session.is_active) {
          return new Response(
            JSON.stringify({ 
              valid: false, 
              reason: session.invalidated_reason || 'Session invalidated',
              invalidated_at: session.invalidated_at
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ valid: true, session }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'heartbeat': {
        if (!session_token) {
          return new Response(
            JSON.stringify({ error: 'Session token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: session, error: updateError } = await supabaseAdmin
          .from('user_sessions')
          .update({ last_active_at: new Date().toISOString() })
          .eq('session_token', session_token)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .select()
          .single();

        if (updateError || !session) {
          return new Response(
            JSON.stringify({ success: false, valid: false, reason: 'Session not found or inactive' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, valid: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'invalidate': {
        if (!session_token) {
          return new Response(
            JSON.stringify({ error: 'Session token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_sessions')
          .update({
            is_active: false,
            invalidated_at: new Date().toISOString(),
            invalidated_reason: 'user_logout'
          })
          .eq('session_token', session_token)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[session-manager] Error invalidating session:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to invalidate session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        const { data: sessions, error: listError } = await supabaseAdmin
          .from('user_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (listError) {
          return new Response(
            JSON.stringify({ error: 'Failed to list sessions' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sessions }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[session-manager] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});