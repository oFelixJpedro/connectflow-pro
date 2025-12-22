import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RegisterRequest {
  email: string
  password: string
  fullName: string
  companyName: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, password, fullName, companyName }: RegisterRequest = await req.json()

    // Validate input
    if (!email || !password || !fullName || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter pelo menos 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Generate company slug
    const slug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36)

    // 1. Create company first with trial status (3 days)
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        slug: slug,
        plan: 'trial',
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days trial
        max_connections: 1,
        max_users: null, // unlimited during trial
        max_ai_agents: null, // unlimited during trial
      })
      .select()
      .single()

    if (companyError) {
      console.error('Company creation error:', companyError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar empresa. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for MVP
      user_metadata: {
        full_name: fullName,
        company_id: company.id
      }
    })

    if (authError) {
      // Rollback company creation
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      
      if (authError.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está registrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.error('Auth creation error:', authError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        company_id: company.id,
        email: email,
        full_name: fullName,
        max_conversations: 5,
        active: true
      })

    if (profileError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      
      console.error('Profile creation error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar perfil. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Assign owner role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'owner'
      })

    if (roleError) {
      // Rollback
      await supabaseAdmin.from('profiles').delete().eq('id', authData.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      
      console.error('Role assignment error:', roleError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atribuir permissões. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email
        },
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
