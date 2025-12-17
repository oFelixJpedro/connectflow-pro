import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to transcribe audio
async function transcribeAudio(audioUrl: string, apiKey: string): Promise<string | null> {
  try {
    console.log('🎤 Transcrevendo áudio:', audioUrl.substring(0, 80) + '...');
    
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.log('❌ Falha ao baixar áudio:', audioResponse.status);
      return null;
    }
    
    const audioBlob = await audioResponse.blob();
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    
    let extension = 'ogg';
    if (contentType.includes('mp3')) extension = 'mp3';
    else if (contentType.includes('wav')) extension = 'wav';
    else if (contentType.includes('webm')) extension = 'webm';
    else if (contentType.includes('m4a')) extension = 'm4a';
    else if (contentType.includes('mpeg')) extension = 'mp3';
    
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${extension}`);
    formData.append('model', 'gpt-4o-transcribe');
    formData.append('language', 'pt');
    
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });
    
    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.log('❌ Erro na transcrição:', transcriptionResponse.status, errorText);
      return null;
    }
    
    const result = await transcriptionResponse.json();
    console.log('✅ Áudio transcrito:', result.text?.substring(0, 50) + '...');
    return result.text || null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error);
    return null;
  }
}

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
      messageType,
      mediaUrl
    } = await req.json();

    console.log('📥 Input:', { connectionId, conversationId, messageType, contactName, hasMediaUrl: !!mediaUrl });

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
          speech_speed,
          audio_temperature,
          language_code,
          paused_until,
          temperature
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

    // 3️⃣ Check conversation state
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 2️⃣  VERIFICAR ESTADO DA CONVERSA                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    let { data: convState } = await supabase
      .from('ai_conversation_states')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    const isConversationActive = convState?.status === 'active';
    console.log('📋 Estado atual:', convState?.status || 'nenhum');
    console.log('📋 Conversa ativa:', isConversationActive);

    if (isConversationActive) {
      console.log('✅ Conversa já ativada - pulando verificação de trigger');
      
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
    } else {
      // 4️⃣ Not active - check trigger
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ 3️⃣  VERIFICAR TRIGGERS DE ATIVAÇÃO (1ª MENSAGEM)               │');
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
          console.log('ℹ️ Primeira mensagem não contém trigger - aguardando ativação');
          return new Response(
            JSON.stringify({ success: false, skip: true, reason: 'Waiting for activation trigger' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('✅ Trigger de ativação encontrado! Ativando conversa...');
      }

      // 5️⃣ Create or update state to 'active'
      if (!convState) {
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
          console.log('✅ Estado da conversa criado (ativo)');
        }
      } else {
        await supabase
          .from('ai_conversation_states')
          .update({ 
            status: 'active', 
            agent_id: agent.id,
            activated_at: new Date().toISOString() 
          })
          .eq('id', convState.id);
        console.log('✅ Estado da conversa atualizado para ativo');
      }
    }

    // 6️⃣ Generate AI Response
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

    // Get conversation history for context (including all message types)
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('content, direction, message_type, created_at, metadata, media_url')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30);

    // Collect images for potential multimodal analysis
    const imageUrls: string[] = [];

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map(m => {
        const metadata = m.metadata as any;
        let messageText = '';
        
        if (m.message_type === 'text') {
          messageText = m.content || '';
        } else if (m.message_type === 'audio') {
          if (metadata?.transcription) {
            messageText = `[Áudio transcrito]: ${metadata.transcription}`;
          } else if (m.content) {
            messageText = m.content;
          } else {
            messageText = '[Mensagem de áudio]';
          }
        } else if (m.message_type === 'image') {
          // Collect image URLs for multimodal analysis
          if (m.media_url && m.direction === 'inbound') {
            imageUrls.push(m.media_url);
          }
          messageText = m.content 
            ? `[Imagem com legenda]: ${m.content}` 
            : '[Cliente enviou uma imagem]';
        } else if (m.message_type === 'video') {
          messageText = m.content 
            ? `[Vídeo com legenda]: ${m.content}` 
            : '[Cliente enviou um vídeo]';
        } else if (m.message_type === 'document') {
          const fileName = metadata?.fileName || metadata?.file_name || 'documento';
          messageText = m.content 
            ? `[Documento "${fileName}"]: ${m.content}` 
            : `[Cliente enviou documento: ${fileName}]`;
        } else if (m.message_type === 'sticker') {
          messageText = '[Cliente enviou um sticker]';
        } else {
          messageText = m.content || `[Mensagem do tipo ${m.message_type}]`;
        }
        
        return messageText ? {
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: messageText
        } : null;
      })
      .filter(Boolean);

    // Check if current message is image/audio that needs special processing
    const currentMessageIsImage = messageType === 'image';
    const currentMessageIsAudio = messageType === 'audio';
    
    // Get the actual mediaUrl if not provided (media may have been processed in background)
    let actualMediaUrl = mediaUrl;
    if ((currentMessageIsImage || currentMessageIsAudio) && !actualMediaUrl) {
      // Fetch the most recent message to get the media_url
      const { data: latestMsg } = await supabase
        .from('messages')
        .select('media_url, metadata')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .eq('message_type', messageType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestMsg?.media_url) {
        actualMediaUrl = latestMsg.media_url;
        console.log('📎 Media URL obtida do banco:', actualMediaUrl.substring(0, 50) + '...');
      }
    }

    // Process current message content
    let processedMessageContent = messageContent || '';
    
    // Handle audio transcription for current message
    if (currentMessageIsAudio && actualMediaUrl && !processedMessageContent) {
      console.log('🎤 Transcrevendo áudio do cliente...');
      const transcription = await transcribeAudio(actualMediaUrl, AI_API_KEY);
      if (transcription) {
        processedMessageContent = transcription;
        console.log('✅ Transcrição obtida:', transcription.substring(0, 50) + '...');
      } else {
        processedMessageContent = '[Cliente enviou um áudio que não pôde ser transcrito]';
      }
    }

    // Add current image to analysis list
    if (currentMessageIsImage && actualMediaUrl) {
      // Add current image if not already in the list
      if (!imageUrls.includes(actualMediaUrl)) {
        imageUrls.push(actualMediaUrl);
      }
    }

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
6. Mantenha o tom profissional mas acolhedor
7. Se o cliente enviar uma imagem, ANALISE o conteúdo visual e responda de forma contextualizada`;

    console.log('📝 System prompt criado (' + systemPrompt.length + ' chars)');
    console.log('📝 Histórico:', conversationHistory.length, 'mensagens');
    console.log('🖼️ Imagens para análise:', imageUrls.length);

    const agentTemperature = agent.temperature ?? 0.7;
    console.log('🌡️ Temperatura configurada:', agentTemperature);

    let aiResponse: string;
    let modelUsed: string;

    // Determine if we should use multimodal (image analysis)
    const shouldUseMultimodal = currentMessageIsImage && actualMediaUrl;

    if (shouldUseMultimodal) {
      // Use multimodal endpoint with gpt-5-nano for image analysis
      console.log('🖼️ Usando endpoint multimodal /v1/responses com gpt-5-nano');
      modelUsed = 'gpt-5-nano';
      
      const historyText = conversationHistory.map((m: any) => 
        `${m.role === 'user' ? '[CLIENTE]' : '[AGENTE]'}: ${m.content}`
      ).join('\n');
      
      const contentItems = [
        { 
          type: 'input_text', 
          text: `${systemPrompt}\n\nHistórico da conversa:\n${historyText}\n\nO cliente acabou de enviar esta imagem${processedMessageContent ? ` com a seguinte mensagem: "${processedMessageContent}"` : ''}. Analise a imagem e responda de forma adequada ao contexto.`
        },
        {
          type: 'input_image',
          image_url: actualMediaUrl
        }
      ];
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: [
            {
              type: 'message',
              role: 'user',
              content: contentItems
            }
          ],
          text: {
            format: { type: 'text' },
            verbosity: 'medium'
          },
          reasoning: {
            effort: 'medium',
            summary: 'auto'
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ OpenAI /v1/responses error:', response.status, errorText);
        
        await supabase.from('ai_agent_logs').insert({
          agent_id: agent.id,
          conversation_id: conversationId,
          action_type: 'response_error',
          input_text: processedMessageContent,
          error_message: `OpenAI /v1/responses error: ${response.status}`,
          metadata: { errorDetails: errorText, messageType, hasImage: true }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'AI API error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await response.json();
      console.log('📦 Resposta API (multimodal):', JSON.stringify(aiData, null, 2));
      aiResponse = aiData.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text?.trim() || '';
      
    } else {
      // Use /v1/responses endpoint (compatible with GPT-5 models)
      console.log('📝 Usando endpoint /v1/responses com gpt-5-mini');
      modelUsed = 'gpt-5-mini';
      
      // Build conversation context as single prompt
      const conversationContext = conversationHistory
        .filter(msg => msg !== null)
        .map(msg => `${msg!.role === 'assistant' ? '[ATENDENTE]' : '[CLIENTE]'}: ${msg!.content}`)
        .join('\n');
      
      const fullPrompt = `${systemPrompt}\n\nHistórico da conversa:\n${conversationContext}\n\n[CLIENTE]: ${processedMessageContent || '[Mensagem sem texto]'}\n\nGere a resposta do atendente:`;
      
      const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          input: fullPrompt,
          text: {
            format: { type: 'text' },
            verbosity: 'medium'
          },
          reasoning: {
            effort: 'medium',
            summary: 'auto'
          }
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.log('❌ OpenAI error:', openaiResponse.status, errorText);
        
        await supabase.from('ai_agent_logs').insert({
          agent_id: agent.id,
          conversation_id: conversationId,
          action_type: 'response_error',
          input_text: processedMessageContent,
          error_message: `OpenAI API error: ${openaiResponse.status}`,
          metadata: { errorDetails: errorText }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'AI API error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await openaiResponse.json();
      console.log('📦 Resposta API (texto):', JSON.stringify(aiData, null, 2));
      aiResponse = aiData.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text?.trim() || '';
    }

    if (!aiResponse) {
      console.log('❌ Nenhuma resposta gerada');
      return new Response(
        JSON.stringify({ success: false, error: 'No response generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Resposta gerada:', aiResponse.substring(0, 100) + '...');

    // 7️⃣ Update conversation state
    await supabase
      .from('ai_conversation_states')
      .update({
        last_response_at: new Date().toISOString(),
        messages_processed: (convState?.messages_processed || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId);

    // 8️⃣ Log the interaction
    await supabase.from('ai_agent_logs').insert({
      agent_id: agent.id,
      conversation_id: conversationId,
      action_type: 'response_generated',
      input_text: processedMessageContent || messageContent,
      output_text: aiResponse,
      tokens_used: 0,
      processing_time_ms: 0,
      metadata: {
        model: modelUsed,
        contactName,
        wasAlreadyActive: isConversationActive,
        messageType,
        hasImage: shouldUseMultimodal,
        wasTranscribed: currentMessageIsAudio
      }
    });

    // 9️⃣ Return response with delay info and audio config
    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        agentId: agent.id,
        agentName: agent.name,
        delaySeconds: agent.delay_seconds || 0,
        voiceName: agent.voice_name || null,
        speechSpeed: agent.speech_speed || 1.0,
        audioTemperature: agent.audio_temperature || 0.7,
        languageCode: agent.language_code || 'pt-BR'
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
