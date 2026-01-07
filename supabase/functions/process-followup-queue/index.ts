import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueItem {
  id: string;
  company_id: string;
  contact_id: string;
  conversation_id: string | null;
  sequence_id: string;
  current_step_id: string | null;
  scheduled_at: string;
  status: string;
  reference_message_at: string | null;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_value: number;
  delay_unit: string;
  manual_content: string | null;
  ai_instruction: string | null;
  stop_if_replied: boolean;
  stop_if_opened: boolean;
}

interface Sequence {
  id: string;
  company_id: string;
  name: string;
  follow_up_type: string;
  ai_model_type: string;
  persona_prompt: string | null;
  rules_content: string | null;
  knowledge_base_content: string | null;
  status: string;
  operating_hours_enabled: boolean;
  operating_start_time: string;
  operating_end_time: string;
  operating_days: number[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[process-followup-queue] Starting queue processing...');

  try {
    const now = new Date().toISOString();

    // Fetch pending items that are due
    const { data: pendingItems, error: fetchError } = await supabase
      .from('follow_up_queue')
      .select(`
        *,
        sequence:follow_up_sequences(*),
        step:follow_up_sequence_steps(*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Error fetching queue: ${fetchError.message}`);
    }

    console.log(`[process-followup-queue] Found ${pendingItems?.length || 0} pending items`);

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No pending items to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let stopped = 0;

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await supabase
          .from('follow_up_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        const sequence = item.sequence as Sequence;
        const step = item.step as SequenceStep;

        if (!sequence || sequence.status !== 'active') {
          await markAsFailed(supabase, item.id, 'sequence_inactive', 'Sequência inativa');
          failed++;
          continue;
        }

        if (!step) {
          await markAsFailed(supabase, item.id, 'no_step', 'Etapa não encontrada');
          failed++;
          continue;
        }

        // Check operating hours
        if (sequence.operating_hours_enabled) {
          const isWithinHours = checkOperatingHours(
            sequence.operating_start_time,
            sequence.operating_end_time,
            sequence.operating_days
          );
          if (!isWithinHours) {
            // Reschedule to next operating hour
            const nextTime = getNextOperatingTime(
              sequence.operating_start_time,
              sequence.operating_days
            );
            await supabase
              .from('follow_up_queue')
              .update({ 
                status: 'pending', 
                scheduled_at: nextTime.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);
            continue;
          }
        }

        // Check if contact replied (stop condition)
        if (step.stop_if_replied) {
          const hasReplied = await checkContactReplied(supabase, item);
          if (hasReplied) {
            await supabase
              .from('follow_up_queue')
              .update({ 
                status: 'stopped_reply',
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);
            stopped++;
            continue;
          }
        }

        // Generate content based on type
        let content: string;
        let tokensUsed = 0;

        if (sequence.follow_up_type === 'manual') {
          content = step.manual_content || '';
        } else {
          // Call generate-followup-content for AI types
          const generateResult = await generateAIContent(
            supabase,
            supabaseUrl,
            supabaseServiceKey,
            item,
            sequence,
            step
          );
          
          if (!generateResult.success) {
            await markAsFailed(supabase, item.id, generateResult.errorCode || 'ai_error', generateResult.error || 'Erro ao gerar conteúdo');
            failed++;
            continue;
          }
          
          content = generateResult.content!;
          tokensUsed = generateResult.tokensUsed || 0;
        }

        if (!content || content.trim() === '') {
          await markAsFailed(supabase, item.id, 'empty_content', 'Conteúdo vazio');
          failed++;
          continue;
        }

        // Get conversation to send message
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id, connection_id, whatsapp_chat_id')
          .eq('contact_id', item.contact_id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();

        if (!conversation) {
          await markAsFailed(supabase, item.id, 'no_conversation', 'Conversa não encontrada');
          failed++;
          continue;
        }

        // Get connection details
        const { data: connection } = await supabase
          .from('whatsapp_connections')
          .select('instance_name, api_key')
          .eq('id', conversation.connection_id)
          .single();

        if (!connection) {
          await markAsFailed(supabase, item.id, 'no_connection', 'Conexão não encontrada');
          failed++;
          continue;
        }

        // Send WhatsApp message via UAZAPI
        const uazApiBaseUrl = Deno.env.get('UAZAPI_BASE_URL') || 'https://api.uazapi.com';
        const sendResult = await sendWhatsAppMessage(
          uazApiBaseUrl,
          connection.instance_name,
          connection.api_key,
          conversation.whatsapp_chat_id,
          content
        );

        if (!sendResult.success) {
          await markAsFailed(supabase, item.id, 'whatsapp_error', sendResult.error || 'Erro ao enviar mensagem');
          failed++;
          continue;
        }

        // Save sent message to database
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          content: content,
          sender_type: 'agent',
          message_type: 'text',
          whatsapp_message_id: sendResult.messageId,
          sent_by_ai: true,
          metadata: { followup_queue_id: item.id, sequence_id: sequence.id }
        });

        // Mark as sent
        await supabase
          .from('follow_up_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_content: content,
            tokens_used: tokensUsed,
            processing_time_ms: Date.now() - startTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Schedule next step if exists
        await scheduleNextStep(supabase, item, sequence, step);

        // Update contact state
        await supabase
          .from('follow_up_contact_state')
          .upsert({
            contact_id: item.contact_id,
            company_id: item.company_id,
            active_sequence_id: sequence.id,
            current_step_order: step.step_order,
            last_followup_sent_at: new Date().toISOString(),
            total_followups_sent: 1 // Will be incremented by trigger/RPC
          }, { onConflict: 'contact_id' });

        sent++;
        processed++;

      } catch (itemError: any) {
        console.error(`[process-followup-queue] Error processing item ${item.id}:`, itemError);
        await markAsFailed(supabase, item.id, 'processing_error', itemError.message);
        failed++;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[process-followup-queue] Completed: ${processed} processed, ${sent} sent, ${failed} failed, ${stopped} stopped in ${processingTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      sent,
      failed,
      stopped,
      processingTimeMs: processingTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[process-followup-queue] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function markAsFailed(supabase: any, queueId: string, code: string, reason: string) {
  await supabase
    .from('follow_up_queue')
    .update({
      status: 'failed',
      failure_code: code,
      failure_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', queueId);
}

function checkOperatingHours(startTime: string, endTime: string, days: number[]): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  
  if (!days.includes(currentDay)) return false;
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getNextOperatingTime(startTime: string, days: number[]): Date {
  const now = new Date();
  const [startH, startM] = startTime.split(':').map(Number);
  
  // Try today first
  const today = now.getDay();
  if (days.includes(today)) {
    const todayStart = new Date(now);
    todayStart.setHours(startH, startM, 0, 0);
    if (todayStart > now) return todayStart;
  }
  
  // Find next operating day
  for (let i = 1; i <= 7; i++) {
    const nextDay = (today + i) % 7;
    if (days.includes(nextDay)) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + i);
      nextDate.setHours(startH, startM, 0, 0);
      return nextDate;
    }
  }
  
  // Fallback to tomorrow at start time
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(startH, startM, 0, 0);
  return tomorrow;
}

async function checkContactReplied(supabase: any, item: QueueItem): Promise<boolean> {
  if (!item.reference_message_at) return false;
  
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', item.conversation_id)
    .eq('sender_type', 'contact')
    .gt('created_at', item.reference_message_at)
    .limit(1);
  
  return recentMessages && recentMessages.length > 0;
}

async function generateAIContent(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  item: QueueItem,
  sequence: Sequence,
  step: SequenceStep
): Promise<{ success: boolean; content?: string; tokensUsed?: number; error?: string; errorCode?: string }> {
  try {
    // Check credits first
    const creditType = sequence.ai_model_type === 'advanced' ? 'advanced_text' : 'standard_text';
    const { data: creditsData } = await supabase.rpc('check_ai_credits', {
      p_company_id: item.company_id,
      p_credit_type: creditType
    });
    
    const balance = creditsData?.balance || 0;
    if (balance < 1000) { // Minimum tokens needed
      return { success: false, error: 'Créditos de IA insuficientes', errorCode: 'no_credits' };
    }

    // Get conversation context
    const { data: messages } = await supabase
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('conversation_id', item.conversation_id)
      .order('created_at', { ascending: false })
      .limit(20);

    const conversationContext = messages?.reverse().map((m: any) => 
      `${m.sender_type === 'contact' ? 'Cliente' : 'Agente'}: ${m.content}`
    ).join('\n') || 'Sem histórico';

    // Get contact info
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone_number')
      .eq('id', item.contact_id)
      .single();

    // Build prompt based on sequence type
    let systemPrompt = `Você é um assistente de follow-up profissional. Sua tarefa é gerar uma mensagem de follow-up natural e persuasiva.`;
    
    if (sequence.follow_up_type === 'advanced') {
      if (sequence.persona_prompt) {
        systemPrompt += `\n\nPersona:\n${sequence.persona_prompt}`;
      }
      if (sequence.rules_content) {
        systemPrompt += `\n\nRegras:\n${sequence.rules_content}`;
      }
      if (sequence.knowledge_base_content) {
        systemPrompt += `\n\nBase de conhecimento:\n${sequence.knowledge_base_content}`;
      }
    }

    const userPrompt = `
Contexto da conversa:
${conversationContext}

Nome do contato: ${contact?.name || 'Cliente'}

Instrução para este follow-up:
${step.ai_instruction || 'Gere uma mensagem de follow-up amigável e profissional.'}

Gere APENAS a mensagem de follow-up, sem explicações adicionais. A mensagem deve ser natural e direta.
`.trim();

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return { success: false, error: 'API key não configurada', errorCode: 'config_error' };
    }

    const model = sequence.ai_model_type === 'advanced' 
      ? 'gemini-2.0-flash-exp'
      : 'gemini-2.0-flash-exp';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-followup-content] Gemini error:', errorText);
      return { success: false, error: 'Erro na API de IA', errorCode: 'ai_api_error' };
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      return { success: false, error: 'Resposta vazia da IA', errorCode: 'empty_response' };
    }

    // Estimate tokens used (rough estimate)
    const inputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    const totalTokens = inputTokens + outputTokens;

    // Consume credits
    await supabase.rpc('consume_ai_credits', {
      p_company_id: item.company_id,
      p_credit_type: creditType,
      p_tokens: totalTokens,
      p_function_name: 'process-followup-queue',
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens
    });

    return { success: true, content, tokensUsed: totalTokens };

  } catch (error: any) {
    console.error('[generate-followup-content] Error:', error);
    return { success: false, error: error.message, errorCode: 'generation_error' };
  }
}

async function sendWhatsAppMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  chatId: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/instances/${instanceName}/messages/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        to: chatId,
        text: content
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendWhatsAppMessage] UAZAPI error:', errorText);
      return { success: false, error: 'Falha ao enviar mensagem' };
    }

    const result = await response.json();
    return { success: true, messageId: result.key?.id };

  } catch (error: any) {
    console.error('[sendWhatsAppMessage] Error:', error);
    return { success: false, error: error.message };
  }
}

async function scheduleNextStep(
  supabase: any,
  currentItem: QueueItem,
  sequence: Sequence,
  currentStep: SequenceStep
) {
  // Get next step
  const { data: nextStep } = await supabase
    .from('follow_up_sequence_steps')
    .select('*')
    .eq('sequence_id', sequence.id)
    .eq('step_order', currentStep.step_order + 1)
    .single();

  if (!nextStep) {
    console.log(`[scheduleNextStep] No more steps for sequence ${sequence.id}`);
    return;
  }

  // Calculate scheduled time
  const now = new Date();
  let scheduledAt: Date;
  
  switch (nextStep.delay_unit) {
    case 'minutes':
      scheduledAt = new Date(now.getTime() + nextStep.delay_value * 60 * 1000);
      break;
    case 'hours':
      scheduledAt = new Date(now.getTime() + nextStep.delay_value * 60 * 60 * 1000);
      break;
    case 'days':
      scheduledAt = new Date(now.getTime() + nextStep.delay_value * 24 * 60 * 60 * 1000);
      break;
    default:
      scheduledAt = new Date(now.getTime() + 60 * 60 * 1000); // Default 1 hour
  }

  // Insert new queue item
  await supabase.from('follow_up_queue').insert({
    company_id: currentItem.company_id,
    contact_id: currentItem.contact_id,
    conversation_id: currentItem.conversation_id,
    sequence_id: sequence.id,
    current_step_id: nextStep.id,
    scheduled_at: scheduledAt.toISOString(),
    status: 'pending',
    reference_message_at: new Date().toISOString()
  });

  console.log(`[scheduleNextStep] Scheduled step ${nextStep.step_order} for ${scheduledAt.toISOString()}`);
}
