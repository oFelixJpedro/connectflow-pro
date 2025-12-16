import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ActionType = 'assign' | 'transfer' | 'release' | 'close' | 'reopen' | 'move_department' | 'mark_unread' | 'clear_unread_mark'

interface RequestBody {
  action: ActionType
  conversationId: string
  userId?: string
  departmentId?: string
}

serve(async (req) => {
  const timestamp = new Date().toISOString()
  
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║          📋 CONVERSATION MANAGEMENT                              ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log(`⏰ Timestamp: ${timestamp}`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1️⃣ AUTENTICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 1️⃣  AUTENTICAÇÃO                                                │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Token de autorização não fornecido')
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // Client para verificar usuário autenticado
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    
    // Client com service role para operações
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      console.log('❌ Usuário não autenticado:', userError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Usuário autenticado:', user.id)
    
    // Buscar perfil e empresa do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id, full_name')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.log('❌ Perfil não encontrado:', profileError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil não encontrado', code: 'PROFILE_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const userId = profile.id
    const companyId = profile.company_id
    console.log('✅ Empresa:', companyId)
    
    // ═══════════════════════════════════════════════════════════════════
    // 2️⃣ PARSE REQUEST BODY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 2️⃣  PARSE REQUEST                                               │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const body: RequestBody = await req.json()
    const { action, conversationId, userId: targetUserId, departmentId } = body
    
    console.log('📋 Request:')
    console.log('   - action:', action)
    console.log('   - conversationId:', conversationId)
    console.log('   - targetUserId:', targetUserId || '(não informado)')
    console.log('   - departmentId:', departmentId || '(não informado)')
    
    // Validar action
    const validActions: ActionType[] = ['assign', 'transfer', 'release', 'close', 'reopen', 'move_department', 'mark_unread', 'clear_unread_mark']
    if (!validActions.includes(action)) {
      console.log('❌ Ação inválida:', action)
      return new Response(
        JSON.stringify({ success: false, error: `Ação inválida: ${action}`, code: 'INVALID_ACTION' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!conversationId) {
      console.log('❌ conversationId não informado')
      return new Response(
        JSON.stringify({ success: false, error: 'conversationId é obrigatório', code: 'MISSING_CONVERSATION_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 3️⃣ BUSCAR CONVERSA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 3️⃣  BUSCAR CONVERSA                                             │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        contacts!inner(id, name, phone_number),
        whatsapp_connections(id, name, company_id),
        profiles:assigned_user_id(id, full_name),
        departments(id, name)
      `)
      .eq('id', conversationId)
      .single()
    
    if (convError || !conversation) {
      console.log('❌ Conversa não encontrada:', convError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Conversa não encontrada', code: 'CONVERSATION_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Conversa encontrada:', conversation.id)
    console.log('   - status:', conversation.status)
    console.log('   - assigned_user_id:', conversation.assigned_user_id || '(não atribuída)')
    
    // Validar que conversa pertence à empresa do usuário
    if (conversation.company_id !== companyId) {
      console.log('❌ Conversa não pertence à empresa do usuário')
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para acessar esta conversa', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 4️⃣ EXECUTAR AÇÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log(`│ 4️⃣  EXECUTAR AÇÃO: ${action.toUpperCase().padEnd(44)}│`)
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    let updateData: Record<string, unknown> = {}
    
    switch (action) {
      // ───────────────────────────────────────────────────────────────────
      // ACTION: ASSIGN
      // ───────────────────────────────────────────────────────────────────
      case 'assign': {
        // Validar que conversa não está fechada
        if (conversation.status === 'closed') {
          console.log('❌ Conversa está fechada')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa está fechada e não pode ser modificada', code: 'CONVERSATION_CLOSED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Usar userId fornecido ou usuário logado
        const assignToUserId = targetUserId || userId
        
        // Se userId fornecido, validar que pertence à mesma empresa
        if (targetUserId) {
          const { data: targetProfile, error: targetError } = await supabase
            .from('profiles')
            .select('id, company_id')
            .eq('id', targetUserId)
            .single()
          
          if (targetError || !targetProfile || targetProfile.company_id !== companyId) {
            console.log('❌ Usuário alvo não encontrado ou não pertence à empresa')
            return new Response(
              JSON.stringify({ success: false, error: 'Usuário não encontrado ou sem permissão', code: 'INVALID_USER' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
        
        updateData = {
          assigned_user_id: assignToUserId,
          assigned_at: new Date().toISOString(),
          // Se status é 'open', mudar para 'in_progress'
          ...(conversation.status === 'open' ? { status: 'in_progress' } : {})
        }
        
        console.log('📝 Atribuindo conversa para:', assignToUserId)
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: TRANSFER
      // ───────────────────────────────────────────────────────────────────
      case 'transfer': {
        if (conversation.status === 'closed') {
          console.log('❌ Conversa está fechada')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa está fechada e não pode ser modificada', code: 'CONVERSATION_CLOSED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (!targetUserId) {
          console.log('❌ userId não informado para transfer')
          return new Response(
            JSON.stringify({ success: false, error: 'userId é obrigatório para transferir conversa', code: 'MISSING_USER_ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (targetUserId === conversation.assigned_user_id) {
          console.log('❌ Conversa já está atribuída a este usuário')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa já está atribuída a este usuário', code: 'SAME_USER' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Validar que targetUserId pertence à mesma empresa
        const { data: targetProfile, error: targetError } = await supabase
          .from('profiles')
          .select('id, company_id')
          .eq('id', targetUserId)
          .single()
        
        if (targetError || !targetProfile || targetProfile.company_id !== companyId) {
          console.log('❌ Usuário alvo não encontrado ou não pertence à empresa')
          return new Response(
            JSON.stringify({ success: false, error: 'Usuário não encontrado ou sem permissão', code: 'INVALID_USER' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Buscar metadata existente para preservar dados
        const existingMetadata = (conversation.metadata as Record<string, unknown>) || {}
        
        updateData = {
          assigned_user_id: targetUserId,
          assigned_at: new Date().toISOString(),
          // Marcar como não lida para chamar atenção do destinatário
          metadata: {
            ...existingMetadata,
            markedAsUnread: true,
            markedAsUnreadAt: new Date().toISOString(),
            transferredFrom: conversation.assigned_user_id,
            transferredBy: userId
          },
          // Mover para o topo da fila atualizando last_message_at
          last_message_at: new Date().toISOString()
        }
        
        console.log('📝 Transferindo conversa para:', targetUserId, '(com marcação de não lida)')
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: RELEASE
      // ───────────────────────────────────────────────────────────────────
      case 'release': {
        if (conversation.status === 'closed') {
          console.log('❌ Conversa está fechada')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa está fechada e não pode ser modificada', code: 'CONVERSATION_CLOSED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        updateData = {
          assigned_user_id: null,
          assigned_at: null,
          // Se status é 'in_progress', mudar para 'open'
          ...(conversation.status === 'in_progress' ? { status: 'open' } : {})
        }
        
        console.log('📝 Liberando conversa')
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: CLOSE
      // ───────────────────────────────────────────────────────────────────
      case 'close': {
        if (conversation.status === 'closed') {
          console.log('❌ Conversa já está fechada')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa já está fechada', code: 'ALREADY_CLOSED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        updateData = {
          status: 'closed',
          closed_at: new Date().toISOString(),
          assigned_user_id: null,
          assigned_at: null
        }
        
        console.log('📝 Fechando conversa e desatribuindo atendente')
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: REOPEN
      // ───────────────────────────────────────────────────────────────────
      case 'reopen': {
        if (conversation.status !== 'closed') {
          console.log('❌ Conversa não está fechada')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa não está fechada', code: 'NOT_CLOSED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        updateData = {
          status: 'in_progress',
          closed_at: null,
          assigned_user_id: userId,
          assigned_at: new Date().toISOString()
        }
        
        console.log('📝 Reabrindo conversa e atribuindo para:', userId)
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: MOVE_DEPARTMENT
      // ───────────────────────────────────────────────────────────────────
      case 'move_department': {
        if (conversation.status === 'closed') {
          console.log('❌ Conversa está fechada')
          return new Response(
            JSON.stringify({ success: false, error: 'Conversa está fechada e não pode ser modificada', code: 'CONVERSATION_CLOSED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (!departmentId) {
          console.log('❌ departmentId não informado')
          return new Response(
            JSON.stringify({ success: false, error: 'departmentId é obrigatório para mover departamento', code: 'MISSING_DEPARTMENT_ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Validar que departamento existe e pertence à mesma conexão da conversa
        const { data: department, error: deptError } = await supabase
          .from('departments')
          .select('id, whatsapp_connection_id')
          .eq('id', departmentId)
          .single()
        
        if (deptError || !department) {
          console.log('❌ Departamento não encontrado')
          return new Response(
            JSON.stringify({ success: false, error: 'Departamento não encontrado', code: 'DEPARTMENT_NOT_FOUND' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (department.whatsapp_connection_id !== conversation.whatsapp_connection_id) {
          console.log('❌ Departamento não pertence à mesma conexão')
          return new Response(
            JSON.stringify({ success: false, error: 'Departamento não pertence à mesma conexão WhatsApp', code: 'INVALID_DEPARTMENT' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        updateData = {
          department_id: departmentId
        }
        
        console.log('📝 Movendo para departamento:', departmentId)
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: MARK_UNREAD
      // ───────────────────────────────────────────────────────────────────
      case 'mark_unread': {
        // Merge existing metadata with markedAsUnread flag
        const existingMetadata = (conversation.metadata as Record<string, unknown>) || {}
        
        updateData = {
          metadata: {
            ...existingMetadata,
            markedAsUnread: true,
            markedAsUnreadAt: new Date().toISOString()
          },
          // Update last_message_at to move conversation to top of list
          last_message_at: new Date().toISOString()
        }
        
        console.log('📝 Marcando conversa como não lida')
        break
      }
      
      // ───────────────────────────────────────────────────────────────────
      // ACTION: CLEAR_UNREAD_MARK
      // ───────────────────────────────────────────────────────────────────
      case 'clear_unread_mark': {
        // Remove markedAsUnread from metadata
        const existingMetadata = (conversation.metadata as Record<string, unknown>) || {}
        const { markedAsUnread, markedAsUnreadAt, ...restMetadata } = existingMetadata
        
        updateData = {
          metadata: restMetadata
        }
        
        console.log('📝 Removendo marcação de não lida')
        break
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 5️⃣ ATUALIZAR CONVERSA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 5️⃣  ATUALIZAR CONVERSA                                          │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    updateData.updated_at = new Date().toISOString()
    
    console.log('📝 Dados de atualização:', JSON.stringify(updateData, null, 2))
    
    const { data: updatedConversation, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select(`
        *,
        contacts(id, name, phone_number, avatar_url),
        whatsapp_connections(id, name),
        profiles:assigned_user_id(id, full_name, avatar_url),
        departments(id, name, color)
      `)
      .single()
    
    if (updateError) {
      console.log('❌ Erro ao atualizar conversa:', updateError.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar conversa', code: 'UPDATE_ERROR', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Conversa atualizada com sucesso!')
    
    // ═══════════════════════════════════════════════════════════════════
    // 5.5 REGISTRAR HISTÓRICO DA CONVERSA
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n┌─────────────────────────────────────────────────────────────────┐')
    console.log('│ 📜 REGISTRAR HISTÓRICO                                          │')
    console.log('└─────────────────────────────────────────────────────────────────┘')
    
    let historyEventType: string | null = null
    let historyEventData: Record<string, unknown> = {}
    
    // Buscar nome do usuário alvo se necessário
    const getTargetUserName = async (targetId: string): Promise<string> => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', targetId)
        .single()
      return data?.full_name || 'Usuário'
    }
    
    // Buscar nome do departamento se necessário
    const getDepartmentName = async (deptId: string): Promise<string> => {
      const { data } = await supabase
        .from('departments')
        .select('name')
        .eq('id', deptId)
        .single()
      return data?.name || 'Departamento'
    }
    
    switch (action) {
      case 'assign': {
        const assignToId = targetUserId || userId
        const assignToName = assignToId === userId ? profile.full_name : await getTargetUserName(assignToId)
        
        historyEventType = 'assigned'
        historyEventData = {
          to_user_id: assignToId,
          to_user_name: assignToName,
          assigned_by: userId,
          assigned_by_name: profile.full_name
        }
        break
      }
      
      case 'transfer': {
        const fromUserName = conversation.profiles?.full_name || 'Desconhecido'
        const toUserName = await getTargetUserName(targetUserId!)
        
        historyEventType = 'transferred'
        historyEventData = {
          from_user_id: conversation.assigned_user_id,
          from_user_name: fromUserName,
          to_user_id: targetUserId,
          to_user_name: toUserName
        }
        break
      }
      
      case 'release': {
        historyEventType = 'assigned'
        historyEventData = {
          to_user_id: null,
          to_user_name: 'Fila',
          from_user_id: conversation.assigned_user_id,
          from_user_name: conversation.profiles?.full_name || 'Desconhecido',
          released: true
        }
        break
      }
      
      case 'close': {
        historyEventType = 'closed'
        historyEventData = {
          previous_status: conversation.status
        }
        break
      }
      
      case 'reopen': {
        historyEventType = 'reopened'
        historyEventData = {
          assigned_to_user_id: userId,
          assigned_to_user_name: profile.full_name
        }
        break
      }
      
      case 'move_department': {
        const fromDeptName = conversation.departments?.name || 'Sem departamento'
        const toDeptName = await getDepartmentName(departmentId!)
        
        historyEventType = 'department_changed'
        historyEventData = {
          from_department_id: conversation.department_id,
          from_department_name: fromDeptName,
          to_department_id: departmentId,
          to_department_name: toDeptName
        }
        break
      }
      
      case 'mark_unread': {
        historyEventType = 'marked_as_unread'
        historyEventData = {}
        break
      }
      
      // clear_unread_mark doesn't need history logging (silent action)
    }
    
    if (historyEventType) {
      const { error: historyError } = await supabase
        .from('conversation_history')
        .insert({
          conversation_id: conversationId,
          event_type: historyEventType,
          event_data: historyEventData,
          performed_by: userId,
          performed_by_name: profile.full_name,
          is_automatic: false
        })
      
      if (historyError) {
        console.log('⚠️ Erro ao registrar histórico (não fatal):', historyError.message)
      } else {
        console.log('✅ Histórico registrado:', historyEventType)
      }
    }
    console.log('   - id:', updatedConversation.id)
    console.log('   - status:', updatedConversation.status)
    console.log('   - assigned_user_id:', updatedConversation.assigned_user_id || '(não atribuída)')
    console.log('   - department_id:', updatedConversation.department_id || '(sem departamento)')
    
    // ═══════════════════════════════════════════════════════════════════
    // 6️⃣ RETORNO DE SUCESSO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              🎉 AÇÃO EXECUTADA COM SUCESSO!                      ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    
    return new Response(
      JSON.stringify({
        success: true,
        conversation: updatedConversation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗')
    console.log('║              ❌ ERRO INESPERADO                                  ║')
    console.log('╚══════════════════════════════════════════════════════════════════╝')
    console.error('Error:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
