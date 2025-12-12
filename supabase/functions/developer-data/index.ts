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

// Verify developer token from cookie ONLY (not Authorization header)
// The Authorization header contains the Supabase Auth JWT which is NOT the developer token
async function verifyDeveloperToken(req: Request, supabase: any): Promise<{ valid: boolean; developerId?: string; reason?: string }> {
  try {
    console.log('🔐 Verificando token...');
    
    // ONLY read from cookie - ignore Authorization header completely
    const cookieHeader = req.headers.get('cookie');
    console.log('🍪 Cookie header presente:', !!cookieHeader);
    
    if (!cookieHeader) {
      console.log('❌ Nenhum cookie foi enviado');
      return { valid: false, reason: 'Cookie não fornecido - faça login novamente' };
    }
    
    const cookies = parseCookies(cookieHeader);
    console.log('🔍 Cookies encontrados:', Object.keys(cookies).join(', '));
    
    const token = cookies[COOKIE_NAME];
    
    if (!token) {
      console.log('❌ Cookie developer_token não encontrado');
      return { valid: false, reason: 'Token não fornecido - faça login novamente' };
    }

    console.log('   Token length:', token.length);
    
    // Token is URL-safe base64(JSON) - decode with proper handling
    let payload;
    try {
      // Convert URL-safe base64 back to standard base64
      let base64 = token
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      // Add padding if needed
      while (base64.length % 4) {
        base64 += '=';
      }
      
      payload = JSON.parse(atob(base64));
      console.log('   Payload parsed successfully');
    } catch (parseErr) {
      console.log('❌ Erro ao parsear token base64:', parseErr);
      return { valid: false, reason: 'Token mal formatado' };
    }
    
    // Check is_developer flag
    if (!payload.is_developer) {
      console.log('❌ Token não é de developer (is_developer =', payload.is_developer, ')');
      return { valid: false, reason: 'Token não é de desenvolvedor' };
    }
    
    // Check developer_id
    if (!payload.developer_id) {
      console.log('❌ developer_id não encontrado no payload');
      return { valid: false, reason: 'developer_id ausente' };
    }
    
    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      console.log('❌ Token expirado. Exp:', new Date(payload.exp).toISOString(), 'Now:', new Date().toISOString());
      return { valid: false, reason: 'Token expirado' };
    }
    
    // Verify developer exists in database
    console.log('🔍 Buscando developer no banco:', payload.developer_id);
    const { data: developer, error: devError } = await supabase
      .from('developer_auth')
      .select('id, email')
      .eq('id', payload.developer_id)
      .single();
    
    if (devError) {
      console.log('❌ Erro ao buscar developer:', devError);
      return { valid: false, reason: 'Erro ao buscar developer' };
    }
    
    if (!developer) {
      console.log('❌ Developer não encontrado no banco');
      return { valid: false, reason: 'Developer não encontrado' };
    }
    
    console.log('✅ Token válido! Developer:', developer.email);
    return { valid: true, developerId: payload.developer_id };
  } catch (err) {
    console.log('❌ Erro geral na verificação:', err);
    return { valid: false, reason: 'Erro geral: ' + String(err) };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              📊 DEVELOPER-DATA FUNCTION CALLED                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📝 Method:', req.method);
  console.log('📍 URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight - retornando 200');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 1️⃣  INICIALIZANDO SUPABASE CLIENT                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Definido' : '❌ NÃO DEFINIDO');
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Definido (' + supabaseKey.substring(0, 20) + '...)' : '❌ NÃO DEFINIDO');
    
    const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '');

    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 2️⃣  VERIFICANDO AUTENTICAÇÃO (COOKIE OU HEADER)                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    const { valid, developerId, reason } = await verifyDeveloperToken(req, supabase);
    
    if (!valid) {
      console.log('❌ Token inválido. Razão:', reason);
      return new Response(
        JSON.stringify({ error: 'Token inválido', detail: reason }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Developer autenticado:', developerId);

    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 3️⃣  PROCESSANDO REQUEST BODY                                   │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    const body = await req.json();
    const { action, company_id } = body;
    console.log('   Action:', action);
    console.log('   Company ID:', company_id || 'N/A');

    if (action === 'list_companies') {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 5️⃣  BUSCANDO EMPRESAS                                          │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, slug, plan, active, created_at, trial_ends_at')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('❌ Erro ao buscar empresas:', error);
        throw error;
      }
      
      console.log('✅ Empresas encontradas:', companies?.length || 0);

      // Get user counts for each company
      const companiesWithCounts = await Promise.all(
        (companies || []).map(async (company: any) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);
          
          return {
            ...company,
            users_count: count || 0
          };
        })
      );
      
      console.log('✅ Retornando', companiesWithCounts.length, 'empresas com contagem de usuários');

      return new Response(
        JSON.stringify({ companies: companiesWithCounts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_company_details') {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 5️⃣  BUSCANDO DETALHES DA EMPRESA                               │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      if (!company_id) {
        return new Response(
          JSON.stringify({ error: 'company_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get counts in parallel
      const [
        { count: usersCount },
        { count: connectionsCount },
        { count: conversationsCount }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('company_id', company_id),
        supabase.from('whatsapp_connections').select('*', { count: 'exact', head: true }).eq('company_id', company_id),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('company_id', company_id)
      ]);

      // Get departments count through connections
      const { data: connections } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('company_id', company_id);

      let departmentsCount = 0;
      if (connections && connections.length > 0) {
        const connectionIds = connections.map((c: any) => c.id);
        const { count } = await supabase
          .from('departments')
          .select('*', { count: 'exact', head: true })
          .in('whatsapp_connection_id', connectionIds);
        departmentsCount = count || 0;
      }

      console.log('✅ Detalhes obtidos:', { usersCount, connectionsCount, departmentsCount, conversationsCount });

      return new Response(
        JSON.stringify({
          users_count: usersCount || 0,
          connections_count: connectionsCount || 0,
          departments_count: departmentsCount,
          conversations_count: conversationsCount || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_user_details') {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 5️⃣  BUSCANDO DETALHES DO USUÁRIO                               │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      const user_id = body.user_id;
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user departments
      const { data: departmentUsers } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', user_id);

      let departments: string[] = [];
      if (departmentUsers && departmentUsers.length > 0) {
        const deptIds = departmentUsers.map((du: any) => du.department_id);
        const { data: depts } = await supabase
          .from('departments')
          .select('name')
          .in('id', deptIds);
        
        departments = depts?.map((d: any) => d.name) || [];
      }

      console.log('✅ Departamentos do usuário:', departments);

      return new Response(
        JSON.stringify({ departments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_company_owner') {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 5️⃣  BUSCANDO PROPRIETÁRIO DA EMPRESA                           │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      if (!company_id) {
        return new Response(
          JSON.stringify({ error: 'company_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all users from the company
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', company_id);

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhum usuário encontrado na empresa' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find owner among users
      const profileIds = profiles.map((p: any) => p.id);
      const { data: ownerRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'owner')
        .in('user_id', profileIds)
        .single();

      let owner = null;
      if (ownerRole) {
        owner = profiles.find((p: any) => p.id === ownerRole.user_id);
      }

      // If no owner found, use first admin or first user
      if (!owner) {
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .in('user_id', profileIds)
          .limit(1)
          .single();
        
        if (adminRole) {
          owner = profiles.find((p: any) => p.id === adminRole.user_id);
        }
      }

      // Fallback to first user
      if (!owner && profiles.length > 0) {
        owner = profiles[0];
      }

      console.log('✅ Proprietário encontrado:', owner?.full_name);

      return new Response(
        JSON.stringify({ owner }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check_permission_status') {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 5️⃣  VERIFICANDO STATUS DA PERMISSÃO                            │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      const request_id = body.request_id;
      if (!request_id) {
        return new Response(
          JSON.stringify({ error: 'request_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: request, error: reqError } = await supabase
        .from('developer_permission_requests')
        .select('id, status, request_type, responded_at, expires_at')
        .eq('id', request_id)
        .eq('requester_id', developerId)
        .single();

      if (reqError) {
        console.log('❌ Erro ao buscar permissão:', reqError);
        return new Response(
          JSON.stringify({ error: 'Permissão não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if expired
      let currentStatus = request.status;
      if (request.expires_at && new Date(request.expires_at) < new Date()) {
        // Update status to expired if still pending
        if (request.status === 'pending') {
          await supabase
            .from('developer_permission_requests')
            .update({ status: 'expired' })
            .eq('id', request_id);
          currentStatus = 'expired';
        }
      }

      console.log('✅ Status da permissão:', currentStatus);

      // Return status directly for easier access
      return new Response(
        JSON.stringify({ status: currentStatus, permission: request }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_users') {
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 5️⃣  BUSCANDO USUÁRIOS DA EMPRESA                               │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      
      if (!company_id) {
        console.log('❌ company_id não fornecido');
        return new Response(
          JSON.stringify({ error: 'company_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, active, needs_password_change, created_at, last_seen_at')
        .eq('company_id', company_id)
        .order('created_at', { ascending: true });

      if (error) {
        console.log('❌ Erro ao buscar usuários:', error);
        throw error;
      }
      
      console.log('✅ Usuários encontrados:', users?.length || 0);

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        (users || []).map(async (user: any) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          return {
            ...user,
            role: roleData?.role || 'agent'
          };
        })
      );
      
      console.log('✅ Retornando', usersWithRoles.length, 'usuários com roles');

      return new Response(
        JSON.stringify({ users: usersWithRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('❌ Ação inválida:', action);
    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('💥 ERRO CRÍTICO:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
