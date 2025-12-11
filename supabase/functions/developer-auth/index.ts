import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert Uint8Array to hex string
function toHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password against stored hash (salt:hash format)
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, originalHash] = storedHash.split(':');
  
  if (!saltHex || !originalHash) {
    return false;
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltHex);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = toHex(hashArray);
  
  return hashHex === originalHash;
}

// Hash password for setup
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltHex);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = toHex(hashArray);
  
  return `${saltHex}:${hashHex}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, password } = await req.json();
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'login') {
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: 'Email e senha são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch developer by email
      const { data: developer, error: fetchError } = await supabase
        .from('developer_auth')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (fetchError || !developer) {
        console.log('Developer not found:', email);
        return new Response(
          JSON.stringify({ error: 'Credenciais inválidas' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify password
      const passwordValid = await verifyPassword(password, developer.password_hash);
      
      if (!passwordValid) {
        console.log('Invalid password for developer:', email);
        return new Response(
          JSON.stringify({ error: 'Credenciais inválidas' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last login
      await supabase
        .from('developer_auth')
        .update({ last_login: new Date().toISOString() })
        .eq('id', developer.id);

      // Log the login action
      await supabase
        .from('developer_audit_logs')
        .insert({
          developer_id: developer.id,
          action_type: 'login',
          ip_address: clientIP,
          user_agent: userAgent,
          details: { email: developer.email }
        });

      // Generate a simple JWT-like token (in production, use proper JWT)
      const tokenPayload = {
        developer_id: developer.id,
        email: developer.email,
        is_developer: true,
        exp: Date.now() + (60 * 60 * 1000) // 1 hour expiration
      };
      
      const token = btoa(JSON.stringify(tokenPayload));

      return new Response(
        JSON.stringify({
          success: true,
          token,
          developer: {
            id: developer.id,
            email: developer.email
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Token não fornecido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      
      try {
        const payload = JSON.parse(atob(token));
        
        if (!payload.is_developer || payload.exp < Date.now()) {
          return new Response(
            JSON.stringify({ error: 'Token inválido ou expirado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify developer still exists
        const { data: developer } = await supabase
          .from('developer_auth')
          .select('id, email')
          .eq('id', payload.developer_id)
          .single();

        if (!developer) {
          return new Response(
            JSON.stringify({ error: 'Desenvolvedor não encontrado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ valid: true, developer }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ error: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'setup_password') {
      // This action is for initial setup only - should be removed after first use
      const setupKey = Deno.env.get('DEVELOPER_SETUP_KEY');
      const { setup_key, new_password } = await req.json();
      
      if (!setupKey || setup_key !== setupKey) {
        return new Response(
          JSON.stringify({ error: 'Chave de setup inválida' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hash = await hashPassword(new_password);
      
      await supabase
        .from('developer_auth')
        .update({ password_hash: hash })
        .eq('email', email);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Developer auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
