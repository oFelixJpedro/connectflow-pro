import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client for checking current user permissions
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for deleting users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify current user is authenticated
    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      console.error('User not authenticated:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Current user:', currentUser.id);

    // Get current user's profile and role
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', currentUser.id)
      .single();

    if (profileError || !currentProfile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin or owner
    const { data: currentRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single();

    if (roleError || !currentRole) {
      console.error('Role not found:', roleError);
      return new Response(
        JSON.stringify({ error: 'Permissão não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['owner', 'admin'].includes(currentRole.role)) {
      console.error('User is not admin or owner:', currentRole.role);
      return new Response(
        JSON.stringify({ error: 'Sem permissão para deletar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: DeleteUserRequest = await req.json();
    const { userId } = body;

    console.log('Deleting user:', userId);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user belongs to same company
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, full_name, email')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      console.error('Target profile not found:', targetError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetProfile.company_id !== currentProfile.company_id) {
      console.error('User does not belong to same company');
      return new Response(
        JSON.stringify({ error: 'Usuário não pertence à sua empresa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot delete yourself
    if (userId === currentUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode deletar a si mesmo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check target user's role
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    // Admin cannot delete owner or other admins
    if (currentRole.role === 'admin') {
      if (targetRole?.role === 'owner' || targetRole?.role === 'admin') {
        return new Response(
          JSON.stringify({ error: 'Admin não pode deletar proprietário ou outros administradores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Permission checks passed. Starting deletion...');

    // 1. Unassign all conversations from this user
    const { error: unassignError } = await supabaseAdmin
      .from('conversations')
      .update({ assigned_user_id: null, assigned_at: null })
      .eq('assigned_user_id', userId);

    if (unassignError) {
      console.error('Error unassigning conversations:', unassignError);
    } else {
      console.log('Conversations unassigned');
    }

    // 2. Delete connection_users assignments
    const { error: connUsersError } = await supabaseAdmin
      .from('connection_users')
      .delete()
      .eq('user_id', userId);

    if (connUsersError) {
      console.error('Error deleting connection_users:', connUsersError);
    } else {
      console.log('Connection users deleted');
    }

    // 3. Delete department_users assignments
    const { error: deptUsersError } = await supabaseAdmin
      .from('department_users')
      .delete()
      .eq('user_id', userId);

    if (deptUsersError) {
      console.error('Error deleting department_users:', deptUsersError);
    } else {
      console.log('Department users deleted');
    }

    // 4. Delete conversation_followers
    const { error: followersError } = await supabaseAdmin
      .from('conversation_followers')
      .delete()
      .eq('user_id', userId);

    if (followersError) {
      console.error('Error deleting conversation_followers:', followersError);
    } else {
      console.log('Conversation followers deleted');
    }

    // 5. Delete internal_chat_participants
    const { error: chatParticipantsError } = await supabaseAdmin
      .from('internal_chat_participants')
      .delete()
      .eq('user_id', userId);

    if (chatParticipantsError) {
      console.error('Error deleting internal_chat_participants:', chatParticipantsError);
    } else {
      console.log('Internal chat participants deleted');
    }

    // 6. Delete internal_chat_read_states
    const { error: readStatesError } = await supabaseAdmin
      .from('internal_chat_read_states')
      .delete()
      .eq('user_id', userId);

    if (readStatesError) {
      console.error('Error deleting internal_chat_read_states:', readStatesError);
    } else {
      console.log('Internal chat read states deleted');
    }

    // 7. Delete user_roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Error deleting user_roles:', rolesError);
    } else {
      console.log('User roles deleted');
    }

    // 8. Delete profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar perfil do usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('Profile deleted');

    // 9. Delete from auth.users (CRITICAL - this was missing!)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      // Profile already deleted, log but don't fail
      console.warn('Auth user deletion failed but profile was deleted. Orphan auth user may exist.');
    } else {
      console.log('Auth user deleted');
    }

    console.log('User deletion complete:', {
      userId,
      email: targetProfile.email,
      name: targetProfile.full_name
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário deletado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado ao deletar usuário' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
