import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Get allowed origins from environment or use default
const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get('origin');
  // In production, you'd validate against a whitelist
  // For now, allow the requesting origin for proper cookie handling
  return origin || '*';
};

const getCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true', // Required for cookies
});

// Cookie configuration
const COOKIE_NAME = 'developer_token';
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds
const isProduction = Deno.env.get('ENVIRONMENT') !== 'development';

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

// Create secure cookie string for cross-origin
function createSecureCookie(name: string, value: string, maxAge: number): string {
  // For cross-origin cookies (frontend on Vercel, backend on Supabase):
  // - SameSite=None is REQUIRED for cross-origin
  // - Secure is REQUIRED when SameSite=None
  // - Path=/ makes it available on all routes
  // - HttpOnly prevents JavaScript access (XSS protection)
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=None; Secure; HttpOnly`;
}

// Create cookie deletion string for cross-origin
function createDeleteCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; SameSite=None; Secure; HttpOnly`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, email, password } = body;
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

      // Generate token - use URL-safe base64 for cookies
      const tokenPayload = {
        developer_id: developer.id,
        email: developer.email,
        is_developer: true,
        exp: Date.now() + (COOKIE_MAX_AGE * 1000)
      };
      
      // URL-safe base64 encoding (replace +/= with -_)
      const token = btoa(JSON.stringify(tokenPayload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Set httpOnly cookie
      const cookie = createSecureCookie(COOKIE_NAME, token, COOKIE_MAX_AGE);

      return new Response(
        JSON.stringify({
          success: true,
          developer: {
            id: developer.id,
            email: developer.email
          }
          // Token NOT returned in body - only in httpOnly cookie
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Set-Cookie': cookie
          } 
        }
      );
    }

    if (action === 'verify') {
      // Try to get token from cookie first, fallback to Authorization header
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
        return new Response(
          JSON.stringify({ valid: false, error: 'Token não fornecido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        // Convert URL-safe base64 back to standard base64
        let base64 = token
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        // Add padding if needed
        while (base64.length % 4) {
          base64 += '=';
        }
        
        const payload = JSON.parse(atob(base64));
        
        if (!payload.is_developer || payload.exp < Date.now()) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Token inválido ou expirado' }),
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
            JSON.stringify({ valid: false, error: 'Desenvolvedor não encontrado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ valid: true, developer }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'logout') {
      // Delete cookie by setting Max-Age=0
      const deleteCookie = createDeleteCookie(COOKIE_NAME);

      return new Response(
        JSON.stringify({ success: true, message: 'Logout realizado' }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Set-Cookie': deleteCookie
          } 
        }
      );
    }

    if (action === 'setup_password') {
      // This action is for initial setup only - should be removed after first use
      const setupKey = Deno.env.get('DEVELOPER_SETUP_KEY');
      const { setup_key, new_password } = body;
      
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
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
