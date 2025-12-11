import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

    const { action, ...params } = await req.json();
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Log action
    const logAction = async (actionType: string, companyId?: string, userId?: string, details?: object) => {
      await supabase.from('developer_audit_logs').insert({
        developer_id: developerId,
        action_type: actionType,
        target_company_id: companyId,
        target_user_id: userId,
        details: details || {},
        ip_address: clientIP,
        user_agent: userAgent
      });
    };

    if (action === 'create_company') {
      const { 
        company_name, 
        slug, 
        plan, 
        trial_ends_at,
        owner_name,
        owner_email,
        owner_password,
        force_password_change 
      } = params;

      // 1. Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: company_name,
          slug: slug,
          plan: plan,
          trial_ends_at: trial_ends_at,
          active: true
        }])
        .select()
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
        return new Response(
          JSON.stringify({ error: companyError.message, code: companyError.code }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Create auth user using admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: owner_email,
        password: owner_password,
        email_confirm: true
      });

      if (authError) {
        // Rollback company
        await supabase.from('companies').delete().eq('id', company.id);
        console.error('Auth user creation error:', authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          company_id: company.id,
          email: owner_email,
          full_name: owner_name,
          needs_password_change: force_password_change,
          active: true
        }]);

      if (profileError) {
        // Rollback
        await supabase.auth.admin.deleteUser(authData.user.id);
        await supabase.from('companies').delete().eq('id', company.id);
        console.error('Profile creation error:', profileError);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: authData.user.id,
          role: 'owner'
        }]);

      if (roleError) {
        // Rollback
        await supabase.from('profiles').delete().eq('id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        await supabase.from('companies').delete().eq('id', company.id);
        console.error('Role creation error:', roleError);
        return new Response(
          JSON.stringify({ error: roleError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAction('create_company', company.id, authData.user.id, {
        company_name,
        slug,
        plan,
        owner_email
      });

      return new Response(
        JSON.stringify({ success: true, company_id: company.id, user_id: authData.user.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reset_password') {
      const { user_id } = params;
      const defaultPassword = 'padrao123';

      // Update password via admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user_id,
        { password: defaultPassword }
      );

      if (updateError) {
        console.error('Password reset error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set needs_password_change flag
      await supabase
        .from('profiles')
        .update({ needs_password_change: true })
        .eq('id', user_id);

      await logAction('reset_password', undefined, user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_company') {
      const { company_id } = params;

      // Soft delete - set active to false
      const { error } = await supabase
        .from('companies')
        .update({ active: false })
        .eq('id', company_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAction('delete_company', company_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_user') {
      const { user_id, company_id } = params;

      // Check if user is owner
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user_id)
        .single();

      if (userRole?.role === 'owner') {
        // Count owners in company
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', company_id);
        
        const profileIds = profiles?.map(p => p.id) || [];
        
        const { count } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'owner')
          .in('user_id', profileIds);

        if ((count || 0) <= 1) {
          return new Response(
            JSON.stringify({ error: 'Não é possível excluir o último proprietário da empresa' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Delete user via admin API
      const { error } = await supabase.auth.admin.deleteUser(user_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAction('delete_user', company_id, user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_permission_request') {
      const { request_type, target_company_id, target_user_id, approver_id } = params;

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      const { data: request, error } = await supabase
        .from('developer_permission_requests')
        .insert([{
          request_type,
          target_company_id,
          target_user_id,
          requester_id: developerId,
          approver_id,
          status: 'pending',
          expires_at: expiresAt
        }])
        .select()
        .single();

      if (error) {
        console.error('Permission request error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, request_id: request.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cancel_permission_request') {
      const { request_id } = params;

      const { error } = await supabase
        .from('developer_permission_requests')
        .update({ status: 'cancelled' })
        .eq('id', request_id)
        .eq('requester_id', developerId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
    console.error('Developer actions error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});