import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

  if (action === 'cleanup_deleted_companies') {
      // HARD DELETE all inactive companies and their data
      const { data: inactiveCompanies } = await supabase
        .from('companies')
        .select('id')
        .eq('active', false);

      let deletedCount = 0;
      
      if (inactiveCompanies) {
        for (const company of inactiveCompanies) {
          // Get all users from this company
          const { data: users } = await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', company.id);

          // Delete each user from auth
          if (users) {
            for (const user of users) {
              try {
                await supabase.auth.admin.deleteUser(user.id);
              } catch (e) {
                console.error('Error deleting auth user:', user.id, e);
              }
            }
          }

          // Delete company (cascade will handle profiles, roles, etc.)
          const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', company.id);

          if (!error) {
            deletedCount++;
          } else {
            console.error('Error deleting company:', company.id, error);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, deletedCompanies: deletedCount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cleanup_banned_users') {
      // Delete all banned users from auth.users that don't have a valid company
      // This cleans up orphaned banned users
      let deletedCount = 0;
      
      // Get list of banned user IDs that we should clean up
      // We'll look for profiles that belong to inactive companies or have no company
      const { data: orphanedProfiles } = await supabase
        .from('profiles')
        .select('id, company_id, companies!inner(active)')
        .eq('companies.active', false);

      if (orphanedProfiles) {
        for (const profile of orphanedProfiles) {
          try {
            console.log('Deleting orphaned user:', profile.id);
            await supabase.auth.admin.deleteUser(profile.id);
            deletedCount++;
          } catch (e) {
            console.error('Error deleting user:', profile.id, e);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, deletedUsers: deletedCount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_user_by_email') {
      const { email } = params;
      
      console.log('Deleting user by email:', email);

      // Find the user in auth.users
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        return new Response(
          JSON.stringify({ error: listError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userToDelete = users?.find(u => u.email === email);
      
      if (!userToDelete) {
        return new Response(
          JSON.stringify({ error: 'Usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Clean up FK references BEFORE deleting
      // Delete developer_permission_requests where user is approver or target
      await supabase
        .from('developer_permission_requests')
        .delete()
        .eq('approver_id', userToDelete.id);
      
      await supabase
        .from('developer_permission_requests')
        .delete()
        .eq('target_user_id', userToDelete.id);

      // Delete user_roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToDelete.id);

      // Delete profile
      await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      // Delete from auth.users
      const { error } = await supabase.auth.admin.deleteUser(userToDelete.id);

      if (error) {
        console.error('Error deleting user:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAction('delete_user', undefined, userToDelete.id, { email });

      return new Response(
        JSON.stringify({ success: true, deleted_user_id: userToDelete.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_company') {
      const { company_id } = params;

      console.log('Deleting company:', company_id);

      // 1. Get all users from this company
      const { data: companyUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', company_id);

      // 2. Delete all users from auth.users
      if (companyUsers && companyUsers.length > 0) {
        for (const user of companyUsers) {
          try {
            console.log('Deleting auth user:', user.id);
            const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);
            if (authDeleteError) {
              console.error('Error deleting auth user:', user.id, authDeleteError);
            }
          } catch (e) {
            console.error('Error deleting auth user:', user.id, e);
          }
        }
      }

      // 3. HARD DELETE company (cascade will handle related records)
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company_id);

      if (error) {
        console.error('Error deleting company:', error);
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

      console.log('Deleting user:', user_id);

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

      // HARD DELETE user from auth.users (cascade deletes profile and roles)
      const { error } = await supabase.auth.admin.deleteUser(user_id);

      if (error) {
        console.error('Error deleting user:', error);
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

    if (action === 'update_company') {
      const { company_id, updates, permission_request_id } = params;

      console.log('Updating company:', company_id, updates);

      // Verify permission was approved (if request_id provided)
      if (permission_request_id) {
        const { data: permRequest, error: permError } = await supabase
          .from('developer_permission_requests')
          .select('status')
          .eq('id', permission_request_id)
          .single();

        if (permError || permRequest?.status !== 'approved') {
          return new Response(
            JSON.stringify({ error: 'Permissão não aprovada' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark permission as used
        await supabase
          .from('developer_permission_requests')
          .update({ status: 'used' })
          .eq('id', permission_request_id);
      }

      const { error } = await supabase
        .from('companies')
        .update({
          name: updates.name,
          plan: updates.plan,
          active: updates.active,
          trial_ends_at: updates.trial_ends_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', company_id);

      if (error) {
        console.error('Update company error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAction('edit_company', company_id, undefined, { updates });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_user') {
      const { user_id, company_id, updates, permission_request_id } = params;

      console.log('Updating user:', user_id, updates);

      // Verify permission was approved (if request_id provided)
      if (permission_request_id) {
        const { data: permRequest, error: permError } = await supabase
          .from('developer_permission_requests')
          .select('status')
          .eq('id', permission_request_id)
          .single();

        if (permError || permRequest?.status !== 'approved') {
          return new Response(
            JSON.stringify({ error: 'Permissão não aprovada' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark permission as used
        await supabase
          .from('developer_permission_requests')
          .update({ status: 'used' })
          .eq('id', permission_request_id);
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: updates.full_name,
          active: updates.active,
          updated_at: new Date().toISOString()
        })
        .eq('id', user_id);

      if (profileError) {
        console.error('Update profile error:', profileError);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update role if provided
      if (updates.role) {
        // First check if role exists
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user_id)
          .single();

        if (existingRole) {
          await supabase
            .from('user_roles')
            .update({ role: updates.role })
            .eq('user_id', user_id);
        } else {
          await supabase
            .from('user_roles')
            .insert([{ user_id, role: updates.role }]);
        }
      }

      await logAction('edit_user', company_id, user_id, { updates });

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
