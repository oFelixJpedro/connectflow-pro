import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify developer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    let developerId: string;
    
    try {
      const payload = JSON.parse(atob(token));
      if (!payload.is_developer || payload.exp < Date.now()) {
        return new Response(
          JSON.stringify({ error: 'Token inválido ou expirado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      developerId = payload.developer_id;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, target_user_id } = await req.json();
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'impersonate') {
      // Check for approved permission request
      const { data: permissionRequest, error: permError } = await supabase
        .from('developer_permission_requests')
        .select('*')
        .eq('requester_id', developerId)
        .eq('target_user_id', target_user_id)
        .eq('request_type', 'access_user')
        .eq('status', 'approved')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (permError || !permissionRequest) {
        return new Response(
          JSON.stringify({ error: 'Permissão não encontrada ou expirada. Solicite novamente.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .eq('id', target_user_id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'Usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark permission as used
      await supabase
        .from('developer_permission_requests')
        .update({ status: 'used' })
        .eq('id', permissionRequest.id);

      // Generate impersonation token (30 min expiry)
      const impersonationPayload = {
        user_id: target_user_id,
        company_id: profile.company_id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.user_roles?.[0]?.role || 'agent',
        impersonated_by: developerId,
        is_impersonation: true,
        exp: Date.now() + (30 * 60 * 1000) // 30 minutes
      };

      const impersonationToken = btoa(JSON.stringify(impersonationPayload));

      // Log the action
      await supabase.from('developer_audit_logs').insert({
        developer_id: developerId,
        action_type: 'access_user',
        target_company_id: profile.company_id,
        target_user_id: target_user_id,
        details: { email: profile.email, full_name: profile.full_name },
        ip_address: clientIP,
        user_agent: userAgent
      });

      // Create a real Supabase session for the user
      // Using signInWithPassword would require the user's password
      // Instead, we'll use a custom approach with the impersonation token
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          impersonation_token: impersonationToken,
          user: {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            company_id: profile.company_id,
            role: profile.user_roles?.[0]?.role || 'agent'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Impersonate error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});