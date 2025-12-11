import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify developer token (simple base64 JSON, not JWT)
// Token format: btoa(JSON.stringify({ developer_id, email, is_developer, exp }))
async function verifyDeveloperToken(token: string, supabase: any): Promise<{ valid: boolean; developerId?: string; reason?: string }> {
  try {
    console.log('🔐 Verificando token...');
    console.log('   Token length:', token?.length);
    
    // Token is simple base64(JSON) - decode directly (no signature)
    let payload;
    try {
      payload = JSON.parse(atob(token));
      console.log('   Payload parsed:', JSON.stringify(payload, null, 2));
    } catch (parseErr) {
      console.log('❌ Erro ao parsear token base64:', parseErr);
      return { valid: false, reason: 'Token mal formatado' };
    }
    
    // Check is_developer flag (not "type")
    if (!payload.is_developer) {
      console.log('❌ Token não é de developer (is_developer =', payload.is_developer, ')');
      return { valid: false, reason: 'Token não é de desenvolvedor' };
    }
    
    // Check developer_id (with underscore, not camelCase)
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
    console.log('│ 2️⃣  VERIFICANDO AUTHORIZATION HEADER                           │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    const authHeader = req.headers.get('Authorization');
    console.log('   Authorization header:', authHeader ? `"${authHeader.substring(0, 50)}..."` : '❌ AUSENTE');
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ Header não começa com "Bearer "');
      return new Response(
        JSON.stringify({ error: 'Token não fornecido', detail: 'Authorization header ausente ou mal formatado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    console.log('   Token extraído:', token ? `${token.substring(0, 30)}... (${token.length} chars)` : '❌ VAZIO');
    
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 3️⃣  VALIDANDO TOKEN DO DEVELOPER                               │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    
    const { valid, developerId, reason } = await verifyDeveloperToken(token, supabase);
    
    if (!valid) {
      console.log('❌ Token inválido. Razão:', reason);
      return new Response(
        JSON.stringify({ error: 'Token inválido', detail: reason }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Developer autenticado:', developerId);

    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 4️⃣  PROCESSANDO REQUEST BODY                                   │');
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
