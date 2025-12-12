import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COOKIE_NAME = 'developer_token';

// Get allowed origins from environment or use default
const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get('origin');
  return origin || '*';
};

const getCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
});

// Parse cookies from header
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split('; ').map(cookie => {
      const [key, ...values] = cookie.split('=');
      return [key, values.join('=')];
    })
  );
}

// Validate developer token from cookie or auth header
function validateDeveloperToken(req: Request): { valid: boolean; developerId?: string; error?: string } {
  // Try cookie first
  const cookies = parseCookies(req.headers.get('cookie'));
  let token = cookies[COOKIE_NAME];
  
  // Fallback to Authorization header for backwards compatibility
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }
  }

  if (!token) {
    return { valid: false, error: 'Token não fornecido' };
  }

  try {
    const payload = JSON.parse(atob(token));
    if (!payload.is_developer || payload.exp < Date.now()) {
      return { valid: false, error: 'Token inválido ou expirado' };
    }
    return { valid: true, developerId: payload.developer_id };
  } catch {
    return { valid: false, error: 'Token inválido' };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate developer token
    const auth = validateDeveloperToken(req);
    if (!auth.valid || !auth.developerId) {
      return new Response(
        JSON.stringify({ error: auth.error || 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const developerId = auth.developerId;

    // Receber redirect_url do frontend
    const { action, target_user_id, redirect_url } = await req.json();
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'impersonate') {
      console.log('Impersonation request for user:', target_user_id);
      console.log('Redirect URL from frontend:', redirect_url);

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
        console.error('Permission not found:', permError);
        return new Response(
          JSON.stringify({ error: 'Permissão não encontrada ou expirada. Solicite novamente.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Permission found:', permissionRequest.id);

      // Get user profile (WITHOUT join to user_roles - no direct FK)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, company_id, avatar_url, active')
        .eq('id', target_user_id)
        .single();

      if (profileError || !profile) {
        console.error('User profile not found:', profileError);
        return new Response(
          JSON.stringify({ error: 'Usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user role separately (no FK relationship with profiles)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', target_user_id)
        .single();

      const userRole = roleData?.role || 'agent';

      console.log('User profile found:', profile.email, 'Role:', userRole);

      // Mark permission as used
      await supabase
        .from('developer_permission_requests')
        .update({ status: 'used' })
        .eq('id', permissionRequest.id);

      // Usar URL dinâmica do frontend (com fallback)
      const fallbackUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/dashboard`;
      const finalRedirectUrl = redirect_url || fallbackUrl;
      
      console.log('Generating magic link for:', profile.email, 'redirect:', finalRedirectUrl);

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: profile.email,
        options: {
          redirectTo: finalRedirectUrl
        }
      });

      if (linkError || !linkData) {
        console.error('Error generating magic link:', linkError);
        return new Response(
          JSON.stringify({ error: 'Erro ao gerar link de acesso: ' + (linkError?.message || 'Erro desconhecido') }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the action
      await supabase.from('developer_audit_logs').insert({
        developer_id: developerId,
        action_type: 'access_user',
        target_company_id: profile.company_id,
        target_user_id: target_user_id,
        details: { 
          email: profile.email, 
          full_name: profile.full_name,
          redirect_url: finalRedirectUrl,
          role: userRole 
        },
        ip_address: clientIP,
        user_agent: userAgent
      });

      console.log('Magic link generated successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          magic_link: linkData.properties?.action_link,
          user: {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            company_id: profile.company_id,
            role: userRole
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
