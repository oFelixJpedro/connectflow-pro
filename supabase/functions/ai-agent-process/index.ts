import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              🤖 AI AGENT PROCESS                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      connectionId, 
      conversationId, 
      messageContent, 
      contactName,
      contactPhone,
      messageType 
    } = await req.json();

    console.log('📥 Input:', { connectionId, conversationId, messageType, contactName });

    if (!connectionId || !conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId and conversationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1️⃣ Find AI agent linked to this connection
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 1️⃣  BUSCAR AGENTE DE IA                                         │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const { data: agentConnection, error: agentConnError } = await supabase
      .from('ai_agent_connections')
      .select(`
        agent_id,
        ai_agents (
          id,
          name,
          status,
          agent_type,
          script_content,
          rules_content,
          faq_content,
          company_info,
          activation_triggers,
          require_activation_trigger,
          delay_seconds,
          voice_name,
          paused_until
        )
      `)
      .eq('connection_id', connectionId)
      .maybeSingle();

    if (agentConnError) {
      console.log('❌ Erro ao buscar agente:', agentConnError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error finding agent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agentConnection?.ai_agents) {
      console.log('ℹ️ Nenhum agente vinculado a esta conexão');
      return new Response(
        JSON.stringify({ success: false, skip: true, reason: 'No agent linked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agent = agentConnection.ai_agents as any;
    console.log('✅ Agente encontrado:', agent.name, '| Status:', agent.status);

    // 2️⃣ Check if agent is active
    if (agent.status !== 'active') {
      console.log('ℹ️ Agente não está ativo');
      return new Response(
        JSON.stringify({ success: false, skip: true, reason: 'Agent not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if paused
    if (agent.paused_until) {
      const pausedUntil = new Date(agent.paused_until);
      if (pausedUntil > new Date()) {
        console.log('ℹ️ Agente pausado até:', pausedUntil.toISOString());
        return new Response(
          JSON.stringify({ success: false, skip: true, reason: 'Agent paused' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3️⃣ Check activation triggers
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 2️⃣  VERIFICAR TRIGGERS DE ATIVAÇÃO                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const triggers = agent.activation_triggers || [];
    const requireTrigger = agent.require_activation_trigger === true;

    console.log('📋 Triggers:', triggers);
    console.log('📋 Require trigger:', requireTrigger);

    if (requireTrigger && triggers.length > 0) {
      const messageNormalized = (messageContent || '').toLowerCase().trim();
      const triggered = triggers.some((trigger: string) => 
        messageNormalized.includes(trigger.toLowerCase().trim())
      );

      if (!triggered) {
        console.log('ℹ️ Mensagem não contém trigger de ativação');
        return new Response(
          JSON.stringify({ success: false, skip: true, reason: 'No trigger matched' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✅ Trigger de ativação encontrado!');
    }

    // 4️⃣ Check/Create conversation state
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 3️⃣  GERENCIAR ESTADO DA CONVERSA                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let { data: convState } = await supabase
      .from('ai_conversation_states')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!convState) {
      // Create new conversation state
      const { data: newState, error: createError } = await supabase
        .from('ai_conversation_states')
        .insert({
          conversation_id: conversationId,
          agent_id: agent.id,
          status: 'active',
          activated_at: new Date().toISOString(),
          messages_processed: 0
        })
        .select()
        .single();

      if (createError) {
        console.log('❌ Erro ao criar estado:', createError.message);
      } else {
        convState = newState;
        console.log('✅ Estado da conversa criado');
      }
    } else {
      // Check if conversation state allows AI response
      if (convState.status === 'deactivated_permanently') {
        console.log('ℹ️ IA desativada permanentemente nesta conversa');
        return new Response(
          JSON.stringify({ success: false, skip: true, reason: 'AI deactivated permanently' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (convState.status === 'paused' && convState.paused_until) {
        const pausedUntil = new Date(convState.paused_until);
        if (pausedUntil > new Date()) {
          console.log('ℹ️ IA pausada até:', pausedUntil.toISOString());
          return new Response(
            JSON.stringify({ success: false, skip: true, reason: 'AI paused for conversation' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Activate if was inactive
      if (convState.status !== 'active') {
        await supabase
          .from('ai_conversation_states')
          .update({ 
            status: 'active', 
            agent_id: agent.id,
            activated_at: new Date().toISOString() 
          })
          .eq('id', convState.id);
      }
    }

    // 5️⃣ Build AI prompt and generate response
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 4️⃣  GERAR RESPOSTA COM IA                                       │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const AI_API_KEY = Deno.env.get('AI_AGENTS_OPENAI_API_KEY');
    if (!AI_API_KEY) {
      console.log('❌ AI_AGENTS_OPENAI_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation history for context
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('content, direction, message_type, created_at')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);

    const conversationHistory = (recentMessages || [])
      .reverse()
      .filter(m => m.message_type === 'text' && m.content)
      .map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content
      }));

    // Build system prompt
    const companyInfo = agent.company_info || {};
    let systemPrompt = `Você é ${agent.name}, um assistente virtual de atendimento ao cliente.

`;

    if (agent.script_content) {
      systemPrompt += `## ROTEIRO DE ATENDIMENTO
${agent.script_content}

`;
    }

    if (agent.rules_content) {
      systemPrompt += `## REGRAS DE COMPORTAMENTO
${agent.rules_content}

`;
    }

    if (agent.faq_content) {
      systemPrompt += `## PERGUNTAS FREQUENTES (FAQ)
${agent.faq_content}

`;
    }

    if (Object.keys(companyInfo).length > 0) {
      systemPrompt += `## INFORMAÇÕES DA EMPRESA
`;
      for (const [key, value] of Object.entries(companyInfo)) {
        if (value) systemPrompt += `- ${key}: ${value}\n`;
      }
      systemPrompt += '\n';
    }

    systemPrompt += `## CONTEXTO
- Cliente: ${contactName || 'Cliente'}
- Telefone: ${contactPhone || 'N/A'}
- Canal: WhatsApp

## INSTRUÇÕES
1. Responda de forma natural e amigável
2. Seja objetivo e direto
3. Use emojis moderadamente para criar conexão
4. Se não souber responder algo específico, direcione para um atendente humano
5. Nunca invente informações - use apenas o que está no roteiro, regras e FAQ
6. Mantenha o tom profissional mas acolhedor`;

    console.log('📝 System prompt criado (' + systemPrompt.length + ' chars)');
    console.log('📝 Histórico:', conversationHistory.length, 'mensagens');

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: messageContent || '[Mensagem sem texto]' }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.log('❌ OpenAI error:', openaiResponse.status, errorText);
      
      // Log the error
      await supabase.from('ai_agent_logs').insert({
        agent_id: agent.id,
        conversation_id: conversationId,
        action_type: 'response_error',
        input_text: messageContent,
        error_message: `OpenAI API error: ${openaiResponse.status}`,
        metadata: { errorDetails: errorText }
      });

      return new Response(
        JSON.stringify({ success: false, error: 'AI API error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await openaiResponse.json();
    const aiResponse = aiData.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.log('❌ Nenhuma resposta gerada');
      return new Response(
        JSON.stringify({ success: false, error: 'No response generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Resposta gerada:', aiResponse.substring(0, 100) + '...');

    // 6️⃣ Update conversation state
    await supabase
      .from('ai_conversation_states')
      .update({
        last_response_at: new Date().toISOString(),
        messages_processed: (convState?.messages_processed || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId);

    // 7️⃣ Log the interaction
    await supabase.from('ai_agent_logs').insert({
      agent_id: agent.id,
      conversation_id: conversationId,
      action_type: 'response_generated',
      input_text: messageContent,
      output_text: aiResponse,
      tokens_used: aiData.usage?.total_tokens || 0,
      processing_time_ms: 0,
      metadata: {
        model: 'gpt-4o-mini',
        contactName,
        triggered: requireTrigger
      }
    });

    // 8️⃣ Return response with delay info
    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        agentId: agent.id,
        agentName: agent.name,
        delaySeconds: agent.delay_seconds || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ AI Agent Process error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
