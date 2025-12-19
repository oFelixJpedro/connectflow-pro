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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📝 Formatting prompt, text length:', text.length);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${FORMATTING_PROMPT}\n\n${text}` }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8000
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao formatar texto' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('📦 Gemini response received');
    const formattedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!formattedText) {
      console.error('❌ No content in response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Formatting complete, output length:', formattedText.length);

    return new Response(
      JSON.stringify({ formattedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in format-prompt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
