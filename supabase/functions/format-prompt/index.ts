import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FORMATTING_PROMPT = `Você é um especialista em formatação de prompts para agentes de IA.

Sua ÚNICA tarefa é formatar visualmente o texto recebido, tornando-o mais legível e estruturado.

## REGRAS ABSOLUTAS:
1. NÃO altere, adicione ou remova NENHUMA palavra do conteúdo
2. O texto de saída deve ter EXATAMENTE as mesmas palavras do texto de entrada
3. Apenas reorganize visualmente usando formatação Markdown

## FORMATAÇÃO A APLICAR:
- Títulos principais: # + emoji relevante (📌 🚫 ✅ 🗣️ 📝 🔄 📂 💡 ⚠️ 🎯)
- Sub-títulos: ## + emoji relevante
- Separadores: --- entre seções principais
- Listas: usar - para itens
- Negrito: **texto** para palavras importantes
- Linhas em branco entre blocos para respiração visual
- Manter hierarquia lógica do conteúdo

## EMOJIS SUGERIDOS POR TEMA:
- Papel/Função: 📌
- Proibições: 🚫
- Aprovações/Qualificação: ✅
- Tom/Comunicação: 🗣️
- Notas/Observações: 📝
- Roteiro/Fluxo: 🔄
- Arquivos/Dados: 📂
- Dicas: 💡
- Alertas: ⚠️
- Objetivos: 🎯
- Etapas: 📍

Formate o texto abaixo mantendo 100% do conteúdo original:`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Texto não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Formatting prompt, text length:', text.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'system', content: FORMATTING_PROMPT },
          { role: 'user', content: text }
        ],
        max_completion_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao formatar texto' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const formattedText = data.choices?.[0]?.message?.content;

    if (!formattedText) {
      console.error('No content in response:', data);
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Formatting complete, output length:', formattedText.length);

    return new Response(
      JSON.stringify({ formattedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in format-prompt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
