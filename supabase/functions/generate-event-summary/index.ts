import { createClient } from "npm:@supabase/supabase-js@2";
import { checkCredits, consumeCredits } from '../_shared/supabase-credits.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { eventId, companyId: requestCompanyId } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event with related data
    const { data: event, error: eventError } = await supabase
      .from("calendar_events")
      .select(`
        *,
        contact:contacts(id, name, phone_number, email, notes, tags),
        assigned_user:profiles!calendar_events_assigned_to_fkey(id, full_name, email),
        attendees:calendar_event_attendees(*)
      `)
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.error("Event not found:", eventError);
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get companyId from request or event
    const companyId = requestCompanyId || event.company_id;

    // 💰 Check credits before processing
    if (companyId) {
      const creditCheck = await checkCredits(supabase, companyId, 'standard_text', 1000);
      if (!creditCheck.hasCredits) {
        return new Response(JSON.stringify({ 
          error: creditCheck.errorMessage,
          code: 'INSUFFICIENT_CREDITS',
          creditType: 'standard_text',
          currentBalance: creditCheck.currentBalance
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If there's a contact, fetch recent conversation history
    let conversationContext = "";
    if (event.contact_id) {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, status, created_at, last_message_at")
        .eq("contact_id", event.contact_id)
        .order("last_message_at", { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        const { data: messages } = await supabase
          .from("messages")
          .select("content, direction, sender_type, created_at")
          .eq("conversation_id", conversations[0].id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (messages && messages.length > 0) {
          conversationContext = messages
            .reverse()
            .map((m) => `[${m.sender_type === "contact" ? "Cliente" : "Equipe"}]: ${m.content || "(mídia)"}`)
            .join("\n");
        }
      }
    }

    // Build context for AI
    const eventDate = new Date(event.start_date);
    const eventTypeLabels: Record<string, string> = {
      meeting: "Reunião",
      reminder: "Lembrete",
      task: "Tarefa",
      other: "Outro",
    };

    const prompt = `Você é um assistente especializado em preparação de reuniões e eventos comerciais.

Gere um resumo completo e útil para o seguinte evento:

**DADOS DO EVENTO:**
- Título: ${event.title}
- Tipo: ${eventTypeLabels[event.event_type] || event.event_type}
- Data/Hora: ${eventDate.toLocaleString("pt-BR")}
- Local: ${event.location || "Não especificado"}
- Descrição: ${event.description || "Não informada"}

**CONTATO RELACIONADO:**
${event.contact ? `
- Nome: ${event.contact.name || "Não informado"}
- Telefone: ${event.contact.phone_number}
- Email: ${event.contact.email || "Não informado"}
- Tags: ${event.contact.tags?.join(", ") || "Nenhuma"}
- Notas: ${event.contact.notes || "Nenhuma"}
` : "Nenhum contato vinculado"}

**RESPONSÁVEL:**
${event.assigned_user ? `${event.assigned_user.full_name} (${event.assigned_user.email})` : "Não atribuído"}

**PARTICIPANTES:**
${event.attendees?.length > 0 ? event.attendees.map((a: any) => `- ${a.name || a.email || "Participante"} (${a.status})`).join("\n") : "Nenhum participante adicional"}

${conversationContext ? `**HISTÓRICO RECENTE DE CONVERSAS:**
${conversationContext}` : ""}

---

Gere um resumo estruturado no seguinte formato:

📋 RESUMO DO EVENTO

🎯 Objetivo: [Propósito principal da reunião/compromisso baseado no contexto]

👤 Participantes:
[Lista de participantes com status]

📝 Contexto:
[Resumo do histórico relevante com o contato/cliente, se disponível]

💬 Últimas Interações:
[Pontos principais das conversas recentes, se disponível]

⚡ Pontos de Atenção:
[Tópicos importantes a abordar, pendências, oportunidades]

📌 Preparação Sugerida:
[O que preparar antes da reunião, documentos necessários, informações a revisar]

Seja conciso, prático e focado em informações acionáveis.`;

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: use GEMINI_API_KEY if available
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "No AI API key configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use Gemini directly
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 1.0,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", errorText);
        return new Response(JSON.stringify({ error: "AI generation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const geminiData = await geminiResponse.json();
      const summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // 💰 Consume credits after successful generation
      if (companyId) {
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(summary.length / 4);
        await consumeCredits(
          supabase,
          companyId,
          'standard_text',
          inputTokens + outputTokens,
          'generate-event-summary',
          inputTokens,
          outputTokens
        );
        console.log('💰 Créditos consumidos:', inputTokens + outputTokens);
      }

      // Update event with summary
      await supabase
        .from("calendar_events")
        .update({ summary })
        .eq("id", eventId);

      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", errorText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "";

    // 💰 Consume credits after successful generation
    if (companyId) {
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(summary.length / 4);
      await consumeCredits(
        supabase,
        companyId,
        'standard_text',
        inputTokens + outputTokens,
        'generate-event-summary',
        inputTokens,
        outputTokens
      );
      console.log('💰 Créditos consumidos:', inputTokens + outputTokens);
    }

    // Update event with summary
    await supabase
      .from("calendar_events")
      .update({ summary })
      .eq("id", eventId);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
