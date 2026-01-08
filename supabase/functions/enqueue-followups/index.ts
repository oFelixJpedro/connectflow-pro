import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnqueueRequest {
  contact_id?: string;
  conversation_id?: string;
  company_id?: string;
  trigger_type?: 'inactivity' | 'crm_stage' | 'tag' | 'manual';
  sequence_id?: string; // Optional: specify a specific sequence
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[enqueue-followups] Starting...');

  try {
    const body: EnqueueRequest = await req.json().catch(() => ({}));
    const { contact_id, conversation_id, company_id, trigger_type, sequence_id } = body;

    // If specific contact provided, enqueue for that contact
    if (contact_id && company_id) {
      const result = await enqueueForContact(supabase, contact_id, company_id, sequence_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Otherwise, scan for contacts that need follow-up based on inactivity
    const results = await scanAndEnqueueInactiveContacts(supabase);
    
    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[enqueue-followups] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function enqueueForContact(
  supabase: any,
  contactId: string,
  companyId: string,
  sequenceId?: string
): Promise<{ success: boolean; message: string; enqueued?: boolean }> {
  console.log(`[enqueue-followups] Enqueuing for contact ${contactId}`);

  // Check if contact is already in a sequence
  const { data: existingState } = await supabase
    .from('follow_up_contact_state')
    .select('*')
    .eq('contact_id', contactId)
    .single();

  if (existingState?.active_sequence_id && !sequenceId) {
    return { success: true, message: 'Contato já está em uma sequência', enqueued: false };
  }

  if (existingState?.opted_out) {
    return { success: true, message: 'Contato optou por não receber follow-ups', enqueued: false };
  }

  // Find applicable sequence
  let sequence;
  if (sequenceId) {
    const { data } = await supabase
      .from('follow_up_sequences')
      .select('*')
      .eq('id', sequenceId)
      .eq('status', 'active')
      .single();
    sequence = data;
  } else {
    // Find sequence that matches contact's filters
    const { data: contact } = await supabase
      .from('contacts')
      .select('tags')
      .eq('id', contactId)
      .single();

    const { data: conversation } = await supabase
      .from('conversations')
      .select('connection_id, crm_stage_id')
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single();

    // Get all active sequences for this company
    const { data: sequences } = await supabase
      .from('follow_up_sequences')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('priority', { ascending: false });

    // Find first matching sequence
    for (const seq of sequences || []) {
      const matchesConnection = seq.connection_ids.length === 0 || 
        (conversation?.connection_id && seq.connection_ids.includes(conversation.connection_id));
      
      const matchesCrmStage = seq.crm_stage_ids.length === 0 ||
        (conversation?.crm_stage_id && seq.crm_stage_ids.includes(conversation.crm_stage_id));
      
      const matchesTags = seq.tag_filters.length === 0 ||
        (contact?.tags && seq.tag_filters.some((tag: string) => contact.tags.includes(tag)));
      
      if (matchesConnection && matchesCrmStage && matchesTags) {
        sequence = seq;
        break;
      }
    }
  }

  if (!sequence) {
    return { success: true, message: 'Nenhuma sequência aplicável encontrada', enqueued: false };
  }

  // Get first step
  const { data: firstStep } = await supabase
    .from('follow_up_sequence_steps')
    .select('*')
    .eq('sequence_id', sequence.id)
    .eq('step_order', 1)
    .single();

  if (!firstStep) {
    return { success: true, message: 'Sequência sem etapas configuradas', enqueued: false };
  }

  // Get conversation for reference
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, last_message_at')
    .eq('contact_id', contactId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  // Calculate scheduled time based on first step delay
  const now = new Date();
  let scheduledAt: Date;
  
  switch (firstStep.delay_unit) {
    case 'minutes':
      scheduledAt = new Date(now.getTime() + firstStep.delay_value * 60 * 1000);
      break;
    case 'hours':
      scheduledAt = new Date(now.getTime() + firstStep.delay_value * 60 * 60 * 1000);
      break;
    case 'days':
      scheduledAt = new Date(now.getTime() + firstStep.delay_value * 24 * 60 * 60 * 1000);
      break;
    default:
      scheduledAt = new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Check if there's already a pending item for this contact+sequence
  const { data: existingQueue } = await supabase
    .from('follow_up_queue')
    .select('id')
    .eq('contact_id', contactId)
    .eq('sequence_id', sequence.id)
    .eq('status', 'pending')
    .limit(1);

  if (existingQueue && existingQueue.length > 0) {
    return { success: true, message: 'Follow-up já agendado para este contato', enqueued: false };
  }

  // Insert into queue
  const { error: insertError } = await supabase
    .from('follow_up_queue')
    .insert({
      company_id: companyId,
      contact_id: contactId,
      conversation_id: conversation?.id,
      sequence_id: sequence.id,
      current_step_id: firstStep.id,
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
      reference_message_at: conversation?.last_message_at || now.toISOString()
    });

  if (insertError) {
    throw new Error(`Erro ao agendar follow-up: ${insertError.message}`);
  }

  // Update contact state
  await supabase
    .from('follow_up_contact_state')
    .upsert({
      contact_id: contactId,
      company_id: companyId,
      active_sequence_id: sequence.id,
      current_step_order: 0
    }, { onConflict: 'contact_id' });

  console.log(`[enqueue-followups] Enqueued contact ${contactId} for sequence ${sequence.name}`);
  
  return { success: true, message: `Follow-up agendado para ${scheduledAt.toISOString()}`, enqueued: true };
}

async function scanAndEnqueueInactiveContacts(supabase: any): Promise<{ scanned: number; enqueued: number }> {
  console.log('[enqueue-followups] Scanning for inactive contacts...');
  
  // Get all companies with active follow-up sequences
  const { data: sequences } = await supabase
    .from('follow_up_sequences')
    .select('id, company_id, connection_ids, crm_stage_ids, tag_filters, priority')
    .eq('status', 'active');

  if (!sequences || sequences.length === 0) {
    return { scanned: 0, enqueued: 0 };
  }

  // Group sequences by company
  const companiesWithSequences = new Map<string, any[]>();
  for (const seq of sequences) {
    const existing = companiesWithSequences.get(seq.company_id) || [];
    existing.push(seq);
    companiesWithSequences.set(seq.company_id, existing);
  }

  let totalScanned = 0;
  let totalEnqueued = 0;

  for (const [companyId, companySequences] of companiesWithSequences) {
    // Get conversations with recent activity but no agent response in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: inactiveConversations } = await supabase
      .from('conversations')
      .select(`
        id,
        contact_id,
        connection_id,
        crm_stage_id,
        last_message_at,
        contacts!inner(id, tags, company_id)
      `)
      .eq('contacts.company_id', companyId)
      .lte('last_message_at', oneDayAgo)
      .limit(100);

    totalScanned += inactiveConversations?.length || 0;

    for (const conv of inactiveConversations || []) {
      // Check if already has pending follow-up
      const { data: existingQueue } = await supabase
        .from('follow_up_queue')
        .select('id')
        .eq('contact_id', conv.contact_id)
        .eq('status', 'pending')
        .limit(1);

      if (existingQueue && existingQueue.length > 0) continue;

      // Check if opted out
      const { data: contactState } = await supabase
        .from('follow_up_contact_state')
        .select('opted_out')
        .eq('contact_id', conv.contact_id)
        .single();

      if (contactState?.opted_out) continue;

      // Find matching sequence
      let matchedSequence = null;
      for (const seq of companySequences.sort((a: any, b: any) => b.priority - a.priority)) {
        const matchesConnection = seq.connection_ids.length === 0 || 
          seq.connection_ids.includes(conv.connection_id);
        
        const matchesCrmStage = seq.crm_stage_ids.length === 0 ||
          seq.crm_stage_ids.includes(conv.crm_stage_id);
        
        const contactTags = conv.contacts?.tags || [];
        const matchesTags = seq.tag_filters.length === 0 ||
          seq.tag_filters.some((tag: string) => contactTags.includes(tag));
        
        if (matchesConnection && matchesCrmStage && matchesTags) {
          matchedSequence = seq;
          break;
        }
      }

      if (matchedSequence) {
        const result = await enqueueForContact(supabase, conv.contact_id, companyId, matchedSequence.id);
        if (result.enqueued) {
          totalEnqueued++;
        }
      }
    }
  }

  console.log(`[enqueue-followups] Scan complete: ${totalScanned} scanned, ${totalEnqueued} enqueued`);
  return { scanned: totalScanned, enqueued: totalEnqueued };
}
