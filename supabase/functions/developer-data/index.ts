import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify developer JWT token
async function verifyDeveloperToken(token: string, supabase: any): Promise<{ valid: boolean; developerId?: string }> {
  try {
    const [headerB64, payloadB64] = token.split('.');
    if (!headerB64 || !payloadB64) return { valid: false };
    
    const payload = JSON.parse(atob(payloadB64));
    
    if (payload.type !== 'developer' || !payload.developerId) {
      return { valid: false };
    }
    
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false };
    }
    
    // Verify developer exists
    const { data: developer } = await supabase
      .from('developer_auth')
      .select('id')
      .eq('id', payload.developerId)
      .single();
    
    if (!developer) return { valid: false };
    
    return { valid: true, developerId: payload.developerId };
  } catch {
    return { valid: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify developer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { valid, developerId } = await verifyDeveloperToken(token, supabase);
    
    if (!valid) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, company_id } = await req.json();

    if (action === 'list_companies') {
      // Fetch all companies with user counts
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, slug, plan, active, created_at, trial_ends_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

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

      return new Response(
        JSON.stringify({ companies: companiesWithCounts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_users') {
      if (!company_id) {
        return new Response(
          JSON.stringify({ error: 'company_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch users for company
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, active, needs_password_change, created_at, last_seen_at')
        .eq('company_id', company_id)
        .order('created_at', { ascending: true });

      if (error) throw error;

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

      return new Response(
        JSON.stringify({ users: usersWithRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Developer data error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
