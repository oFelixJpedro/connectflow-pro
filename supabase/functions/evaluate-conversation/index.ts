import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaluationResult {
  overall_score: number;
  communication_score: number;
  objectivity_score: number;
  humanization_score: number;
  objection_handling_score: number;
  closing_score: number;
  response_time_score: number;
  lead_qualification: 'hot' | 'warm' | 'cold' | 'disqualified';
  lead_interest_level: number;
  strengths: string[];
  improvements: string[];
  ai_summary: string;
  lead_pain_points: string[];
}

const EVALUATION_PROMPT = `Você é um especialista em análise de qualidade de atendimento comercial via WhatsApp.

Analise a conversa abaixo e avalie o desempenho do atendente nos seguintes critérios (notas de 0 a 10):

1. **Comunicação** (communication_score): Clareza, gramática, ortografia e qualidade da comunicação escrita
2. **Objetividade** (objectivity_score): Foco nos objetivos comerciais, sem enrolação ou desvios
3. **Humanização** (humanization_score): Tratamento personalizado, empático, uso apropriado de emojis
4. **Tratamento de Objeções** (objection_handling_score): Capacidade de contornar objeções do cliente
5. **Fechamento** (closing_score): Uso de técnicas de fechamento de venda, call-to-action
6. **Tempo de Resposta** (response_time_score): Baseado nos timestamps, agilidade nas respostas

Também avalie:
- **Qualificação do Lead**: hot (muito interessado, pronto para comprar), warm (interessado, precisa de mais informações), cold (pouco interesse), disqualified (não é público alvo)
- **Nível de Interesse** (1-5): 1=nenhum, 5=máximo
- **Pontos Fortes**: Liste 2-4 aspectos positivos do atendimento
- **Melhorias**: Liste 2-4 sugestões de melhoria
- **Resumo**: Breve resumo da conversa e do resultado
- **Pontos de Dor do Lead**: Quais problemas/necessidades o cliente demonstrou

IMPORTANTE:
- Seja justo e preciso nas notas
- A nota geral (overall_score) deve ser a média ponderada dos 6 critérios
- Se não houver mensagens suficientes para avaliar um critério, use 5.0 como nota neutra
- Limite o campo "ai_summary" a no máximo 100 palavras
- Responda SOMENTE com JSON válido (sem markdown ou formatação extra)

Responda APENAS em JSON válido no seguinte formato:
{
  "overall_score": 7.5,
  "communication_score": 8.0,
  "objectivity_score": 7.0,
  "humanization_score": 8.5,
  "objection_handling_score": 6.5,
  "closing_score": 7.0,
  "response_time_score": 8.0,
  "lead_qualification": "warm",
  "lead_interest_level": 3,
  "strengths": ["Comunicação clara", "Atendimento cordial"],
  "improvements": ["Usar mais técnicas de fechamento", "Fazer follow-up"],
  "ai_summary": "Atendimento cordial com cliente interessado em produto X...",
  "lead_pain_points": ["Preço alto", "Prazo de entrega"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { conversation_id, company_id, evaluate_all } = await req.json();

    console.log(`[evaluate-conversation] Starting evaluation`, { conversation_id, company_id, evaluate_all });

    let conversationsToEvaluate: string[] = [];

    if (evaluate_all && company_id) {
      // Buscar todas as conversas fechadas da empresa
      const { data: allClosed, error: closedError } = await supabase
        .from('conversations')
        .select('id')
        .eq('company_id', company_id)
        .in('status', ['closed', 'resolved']);

      if (closedError) {
        console.error('[evaluate-conversation] Error fetching closed conversations:', closedError);
        throw new Error('Erro ao buscar conversas fechadas');
      }

      console.log(`[evaluate-conversation] Found ${allClosed?.length || 0} closed/resolved conversations`);

      // Buscar todas as conversas já avaliadas
      const { data: evaluated, error: evalError } = await supabase
        .from('conversation_evaluations')
        .select('conversation_id')
        .eq('company_id', company_id);

      if (evalError) {
        console.error('[evaluate-conversation] Error fetching evaluated conversations:', evalError);
      }

      console.log(`[evaluate-conversation] Found ${evaluated?.length || 0} already evaluated conversations`);

      // Filtrar no JavaScript para encontrar as não avaliadas
      const evaluatedIds = new Set(evaluated?.map(e => e.conversation_id) || []);
      conversationsToEvaluate = (allClosed || [])
        .filter(c => !evaluatedIds.has(c.id))
        .map(c => c.id);

      console.log(`[evaluate-conversation] Found ${conversationsToEvaluate.length} conversations to evaluate`);
    } else if (conversation_id) {
      conversationsToEvaluate = [conversation_id];
    } else {
      throw new Error('conversation_id ou evaluate_all + company_id são obrigatórios');
    }

    if (conversationsToEvaluate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma conversa para avaliar',
        evaluated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limitar a 10 conversas por vez para evitar timeout
    const toEvaluate = conversationsToEvaluate.slice(0, 10);
    const results: { conversation_id: string; success: boolean; error?: string }[] = [];

    for (const convId of toEvaluate) {
      try {
        // Buscar conversa com contato
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('id, company_id, contact:contacts(name, phone_number)')
          .eq('id', convId)
          .single();

        if (convError || !conversation) {
          console.error(`[evaluate-conversation] Conversation ${convId} not found:`, convError);
          results.push({ conversation_id: convId, success: false, error: 'Conversa não encontrada' });
          continue;
        }

        // Buscar mensagens da conversa
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('content, direction, sender_type, created_at, message_type')
          .eq('conversation_id', convId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        if (msgError) {
          console.error(`[evaluate-conversation] Error fetching messages for ${convId}:`, msgError);
          results.push({ conversation_id: convId, success: false, error: 'Erro ao buscar mensagens' });
          continue;
        }

        if (!messages || messages.length < 3) {
          console.log(`[evaluate-conversation] Conversation ${convId} has insufficient messages (${messages?.length || 0})`);
          results.push({ conversation_id: convId, success: false, error: 'Mensagens insuficientes' });
          continue;
        }

        // Formatar conversa para a IA
        const contact = conversation.contact as any;
        const contactName = contact?.name || 'Cliente';
        
        const formattedMessages = messages
          .filter(m => m.content && m.message_type === 'text')
          .map(m => {
            const sender = m.direction === 'incoming' ? contactName : 'Atendente';
            const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return `[${time}] ${sender}: ${m.content}`;
          })
          .join('\n');

        if (formattedMessages.length < 50) {
          console.log(`[evaluate-conversation] Conversation ${convId} has insufficient text content`);
          results.push({ conversation_id: convId, success: false, error: 'Conteúdo de texto insuficiente' });
          continue;
        }

        const prompt = `${EVALUATION_PROMPT}\n\n--- CONVERSA ---\n${formattedMessages}\n--- FIM DA CONVERSA ---`;

        // Chamar Gemini 3 Flash Preview
        console.log(`[evaluate-conversation] Calling Gemini for conversation ${convId}`);
        
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
              },
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`[evaluate-conversation] Gemini API error for ${convId}:`, errorText);
          results.push({ conversation_id: convId, success: false, error: 'Erro na API Gemini' });
          continue;
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          console.error(`[evaluate-conversation] No response from Gemini for ${convId}`);
          results.push({ conversation_id: convId, success: false, error: 'Resposta vazia da IA' });
          continue;
        }

        // Extrair JSON da resposta
        let evaluation: EvaluationResult;
        try {
          const extractJson = (text: string) => {
            let t = text.trim();

            // Remove possíveis blocos de markdown (```json ... ```)
            const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (fenced?.[1]) t = fenced[1].trim();

            // Extrai do primeiro "{" até o último "}" (fallback)
            const start = t.indexOf('{');
            const end = t.lastIndexOf('}');
            if (start === -1 || end === -1 || end <= start) return null;

            return t.slice(start, end + 1).trim();
          };

          const jsonText = extractJson(responseText);
          if (!jsonText) throw new Error('JSON não encontrado na resposta');

          evaluation = JSON.parse(jsonText);
        } catch (parseError) {
          console.error(`[evaluate-conversation] Error parsing Gemini response for ${convId}:`, parseError);
          console.log('Response text:', responseText);
          results.push({ conversation_id: convId, success: false, error: 'Erro ao processar resposta da IA' });
          continue;
        }

        // Salvar avaliação no banco
        const { error: insertError } = await supabase
          .from('conversation_evaluations')
          .upsert({
            conversation_id: convId,
            company_id: conversation.company_id,
            overall_score: evaluation.overall_score,
            communication_score: evaluation.communication_score,
            objectivity_score: evaluation.objectivity_score,
            humanization_score: evaluation.humanization_score,
            objection_handling_score: evaluation.objection_handling_score,
            closing_score: evaluation.closing_score,
            response_time_score: evaluation.response_time_score,
            lead_qualification: evaluation.lead_qualification,
            lead_interest_level: evaluation.lead_interest_level,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
            ai_summary: evaluation.ai_summary,
            lead_pain_points: evaluation.lead_pain_points,
            evaluated_at: new Date().toISOString(),
          }, {
            onConflict: 'conversation_id',
          });

        if (insertError) {
          console.error(`[evaluate-conversation] Error saving evaluation for ${convId}:`, insertError);
          results.push({ conversation_id: convId, success: false, error: 'Erro ao salvar avaliação' });
          continue;
        }

        console.log(`[evaluate-conversation] Successfully evaluated conversation ${convId}`);
        results.push({ conversation_id: convId, success: true });

      } catch (error) {
        console.error(`[evaluate-conversation] Unexpected error for ${convId}:`, error);
        results.push({ conversation_id: convId, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const remaining = conversationsToEvaluate.length - toEvaluate.length;

    console.log(`[evaluate-conversation] Completed: ${successCount} success, ${failCount} failed, ${remaining} remaining`);

    return new Response(JSON.stringify({
      success: true,
      evaluated: successCount,
      failed: failCount,
      remaining,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[evaluate-conversation] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
